<?php
/**
 * REST API used by the portal's browser code: /wp-json/bcp/v1/...
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_REST {

	const NS = 'bcp/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes() {
		$public = array( 'permission_callback' => '__return_true' );
		$r      = function ( $path, $methods, $cb ) use ( $public ) {
			register_rest_route( self::NS, $path, array_merge( $public, array( 'methods' => $methods, 'callback' => array( __CLASS__, $cb ) ) ) );
		};
		$r( '/sync', 'GET', 'sync' );
		$r( '/write', 'POST', 'write' );
		$r( '/lock', 'POST', 'lock' );
		$r( '/login', 'POST', 'login' );
		$r( '/logout', 'POST', 'logout' );
		$r( '/register', 'POST', 'register' );
		$r( '/activate/check', 'POST', 'activate_check' );
		$r( '/activate', 'POST', 'activate' );
		$r( '/activate/resend', 'POST', 'activate_resend' );
		$r( '/guardian/request', 'POST', 'guardian_request' );
		$r( '/admin/password', 'POST', 'admin_password' );
	}

	private static function guardian_header( $req ) {
		return (string) $req->get_header( 'x_bcp_guardian' );
	}

	private static function err( $code, $message, $status = 400 ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}

	/* ------------------------------------------------------------------ Data */

	public static function sync( WP_REST_Request $req ) {
		$c     = BCP_Access::context( self::guardian_header( $req ) );
		$key   = BCP_Access::scope_key( $c );
		$since = max( 0, (int) $req->get_param( 'since' ) );
		$full  = 0 === $since || (string) $req->get_param( 'scope' ) !== $key;
		// Overlap slightly so a change saved while another request was in progress isn't missed.
		$rows = BCP_Store::changed_since( $full ? 0 : max( 0, $since - 25 ) );
		$docs = array();
		foreach ( $rows as $row ) {
			if ( (int) $row['deleted'] ) {
				if ( ! $full ) {
					$docs[] = array( 'c' => $row['coll'], 'id' => $row['doc_id'], 'd' => 0 );
				}
				continue;
			}
			$data = BCP_Access::read( $row['coll'], $row['doc_id'], json_decode( $row['data'], true ), $c );
			if ( null !== $data ) {
				$docs[] = array( 'c' => $row['coll'], 'id' => $row['doc_id'], 'd' => 1, 'data' => $data );
			} elseif ( ! $full ) {
				$docs[] = array( 'c' => $row['coll'], 'id' => $row['doc_id'], 'd' => 0 );
			}
		}
		$res = new WP_REST_Response(
			array(
				'rev'   => BCP_Store::current_rev(),
				'scope' => $key,
				'full'  => $full,
				'role'  => $c['role'],
				'docs'  => $docs,
			)
		);
		$res->header( 'Cache-Control', 'no-store' );
		return $res;
	}

	public static function lock() {
		// The browser never seeds data: the server does it from the admin screen.
		return array( 'acquired' => false );
	}

	public static function write( WP_REST_Request $req ) {
		$ops = (array) $req->get_param( 'ops' );
		if ( count( $ops ) > 500 ) {
			return self::err( 'bcp_too_many', 'Too many changes at once.' );
		}
		$out = array();
		foreach ( $ops as $op ) {
			$coll = isset( $op['c'] ) ? (string) $op['c'] : '';
			$id   = isset( $op['id'] ) ? (string) $op['id'] : '';
			if ( ! preg_match( '/^[A-Za-z_]{1,40}$/', $coll ) || BCP_Store::safe_id( $id ) !== $id ) {
				$out[] = array( 'status' => 'denied', 'message' => 'Invalid record.' );
				continue;
			}
			BCP_Access::reset_context();
			$c   = BCP_Access::context( self::guardian_header( $req ) );
			$old = BCP_Store::get( $coll, $id );
			$new = isset( $op['data'] ) && is_array( $op['data'] ) ? $op['data'] : null;
			list( $verdict, $data, $why ) = BCP_Access::write( $coll, $id, $old, $new, $c );
			if ( 'skip' === $verdict ) {
				$out[] = array( 'status' => 'skip' );
				continue;
			}
			if ( 'ok' !== $verdict ) {
				$out[] = array( 'status' => 'denied', 'message' => $why );
				continue;
			}
			if ( 's_outbox' === $coll && null === $old && null !== $data ) {
				$data = BCP_Coach_Eval::prepare_mail( self::prepare_outbox( $data ) );
			}
			BCP_Store::put( $coll, $id, $data, get_current_user_id() );
			if ( 's_outbox' === $coll && null === $old && null !== $data ) {
				self::send_mail( $data );
			}
			do_action( 'bcp_after_write', $coll, $id, $old, $data, $c );
			$out[] = array( 'status' => 'ok', 'data' => BCP_Access::read( $coll, $id, $data, BCP_Access::context( self::guardian_header( $req ) ) ) );
		}
		BCP_Access::reset_context();
		return array( 'results' => $out, 'rev' => BCP_Store::current_rev() );
	}

	/* ------------------------------------------------------------------ Email */

	public static function portal_url() {
		$s = BCP_Plugin::settings();
		$u = $s['page_id'] ? get_permalink( $s['page_id'] ) : '';
		return $u ? $u : home_url( '/' );
	}

	/**
	 * Parent/guardian emails: the code is always made here, never by a browser,
	 * and the email always goes to the parent email on the boxer's membership.
	 */
	private static function prepare_outbox( $mail ) {
		if ( 'guardian' !== ( isset( $mail['kind'] ) ? $mail['kind'] : '' ) ) {
			return $mail;
		}
		$all = BCP_Store::all( 's_users' );
		$sid = BCP_Store::safe_id( isset( $mail['userId'] ) ? $mail['userId'] : '' );
		$b   = isset( $all[ $sid ] ) ? $all[ $sid ] : null;
		$to  = $b ? self::guardian_email( $b ) : '';
		if ( ! $b || ! $to ) {
			$mail['to']   = '';
			$mail['body'] = 'Not sent: no parent or guardian email is on this membership.';
			return $mail;
		}
		$old_code     = isset( $mail['code'] ) ? (string) $mail['code'] : '';
		$code         = self::issue_guardian_code( $b );
		$mail['to']   = $to;
		$mail['code'] = $code;
		foreach ( array( 'body', 'subject' ) as $k ) {
			if ( isset( $mail[ $k ] ) ) {
				$mail[ $k ] = $old_code ? str_replace( $old_code, $code, $mail[ $k ] ) : $mail[ $k ];
				$mail[ $k ] = preg_replace( '#https?://[^\s]*\#guardian-#', self::portal_url() . '#guardian-', $mail[ $k ] );
			}
		}
		return $mail;
	}

	private static function guardian_email( $b ) {
		return isset( $b['trackie']['PARENT/GUARDIAN EMAIL'] ) ? sanitize_email( $b['trackie']['PARENT/GUARDIAN EMAIL'] ) : '';
	}

	private static function issue_guardian_code( $b ) {
		$code = BCP_Accounts::new_code();
		BCP_Store::put(
			's_guardianCodes',
			'gc-' . strtolower( $code ),
			array(
				'id'        => 'gc-' . strtolower( $code ),
				'code'      => $code,
				'boxerId'   => $b['id'],
				'email'     => self::guardian_email( $b ),
				'createdAt' => gmdate( 'c' ),
				'expiresAt' => gmdate( 'c', time() + 7 * DAY_IN_SECONDS ),
			)
		);
		return $code;
	}

	/** Send an outbox email, only to the member it concerns or their parent/guardian. */
	public static function send_mail( $mail ) {
		$s = BCP_Plugin::settings();
		if ( ! $s['send_emails'] || empty( $mail['to'] ) ) {
			return false;
		}
		$all = BCP_Store::all( 's_users' );
		$sid = BCP_Store::safe_id( isset( $mail['userId'] ) ? $mail['userId'] : '' );
		$u   = isset( $all[ $sid ] ) ? $all[ $sid ] : null;
		$to  = strtolower( $mail['to'] );
		if ( ! $u || ( strtolower( (string) $u['email'] ) !== $to && strtolower( self::guardian_email( $u ) ) !== $to ) ) {
			return false;
		}
		$from    = is_email( $s['eval_from_email'] ) && 0 === strpos( isset( $mail['kind'] ) ? (string) $mail['kind'] : '', 'eval_' ) ? $s['eval_from_email'] : get_option( 'admin_email' );
		$name    = ! empty( $mail['fromName'] ) ? $mail['fromName'] : $s['from_name'];
		$headers = array( 'From: ' . str_replace( array( '"', "\r", "\n", '<', '>' ), '', $name ) . ' <' . $from . '>' );
		if ( ! empty( $mail['replyTo'] ) && is_email( $mail['replyTo'] ) ) {
			$headers[] = 'Reply-To: ' . $mail['replyTo'];
		}
		if ( ! empty( $mail['cc'] ) && is_email( $mail['cc'] ) ) {
			$headers[] = 'Cc: ' . $mail['cc'];
		}
		return wp_mail( $mail['to'], wp_strip_all_tags( isset( $mail['subject'] ) ? $mail['subject'] : 'Boxing Canada' ), isset( $mail['body'] ) ? $mail['body'] : '', $headers );
	}

	public static function queue_mail( $mail ) {
		$mail['id'] = 'mail-' . strtolower( wp_generate_password( 8, false ) );
		$mail['at'] = gmdate( 'Y-m-d\TH:i:s' );
		BCP_Store::put( 's_outbox', $mail['id'], $mail );
		self::send_mail( $mail );
	}

	public static function notify( $to, $text, $tab ) {
		$id = 'nt-' . strtolower( wp_generate_password( 8, false ) );
		BCP_Store::put( 's_notifications', $id, array( 'id' => $id, 'to' => $to, 'text' => $text, 'tab' => $tab, 'at' => gmdate( 'Y-m-d\TH:i:s' ), 'readBy' => array(), '_o' => -time() ) );
	}

	/* ------------------------------------------------------------------ Sign-in */

	private static function too_many_attempts( $login ) {
		$key = 'bcp_login_' . md5( strtolower( $login ) . '|' . ( isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '' ) );
		$n   = (int) get_transient( $key );
		set_transient( $key, $n + 1, 15 * MINUTE_IN_SECONDS );
		return $n >= 8;
	}

	public static function login( WP_REST_Request $req ) {
		$login = trim( (string) $req->get_param( 'login' ) );
		$pass  = (string) $req->get_param( 'password' );
		if ( '' === $login || '' === $pass ) {
			return self::err( 'bcp_login', 'Enter your email or membership ID and your password.' );
		}
		if ( self::too_many_attempts( $login ) ) {
			return self::err( 'bcp_login_limit', 'Too many attempts. Wait 15 minutes and try again.', 429 );
		}
		$bad = 'Email, membership ID or password is incorrect.';
		$doc = BCP_Accounts::find_member( $login );
		$wp  = $doc ? BCP_Accounts::wp_user_for( $doc ) : null;
		if ( ! $doc ) {
			// A WordPress account (for example a site administrator) linked to a member.
			$wp  = get_user_by( is_email( $login ) ? 'email' : 'login', $login );
			$doc = $wp ? BCP_Accounts::portal_user_for_wp( $wp->ID ) : null;
			if ( $wp && ! $doc && wp_check_password( $pass, $wp->user_pass, $wp->ID ) ) {
				return self::err( 'bcp_not_linked', 'This WordPress account isn’t linked to a portal member. An administrator can link it under Boxing Canada › Settings.', 403 );
			}
		}
		if ( ! $doc || ! $wp || ! wp_check_password( $pass, $wp->user_pass, $wp->ID ) ) {
			if ( $doc && ! $wp && in_array( $doc['status'], array( 'invited', 'lapsed' ), true ) ) {
				return self::err( 'bcp_not_activated', 'This membership hasn’t been activated yet. Use the code in your welcome email under “Activate My Account”.', 403 );
			}
			return self::err( 'bcp_login', $bad, 403 );
		}
		if ( 'approved' !== $doc['status'] ) {
			$msg = 'pending' === $doc['status'] ? 'Your account is waiting for approval by a PTSO or Boxing Canada administrator.' : ( in_array( $doc['status'], array( 'invited', 'lapsed' ), true ) ? 'This membership hasn’t been activated yet. Use the code in your welcome email under “Activate My Account”.' : 'This account isn’t active. Contact your PTSO.' );
			return self::err( 'bcp_status', $msg, 403 );
		}
		wp_clear_auth_cookie();
		wp_set_current_user( $wp->ID );
		wp_set_auth_cookie( $wp->ID, true, is_ssl() );
		do_action( 'wp_login', $wp->user_login, $wp );
		return array( 'ok' => true, 'userId' => $doc['id'] );
	}

	public static function logout() {
		wp_logout();
		return array( 'ok' => true );
	}

	/* ------------------------------------------------------------------ Registration */

	public static function register( WP_REST_Request $req ) {
		$p    = $req->get_json_params();
		$need = array( 'firstName', 'lastName', 'dob', 'email', 'password', 'role', 'province', 'gender' );
		foreach ( $need as $k ) {
			if ( empty( $p[ $k ] ) || ! is_string( $p[ $k ] ) ) {
				return self::err( 'bcp_missing', 'Fill in every field to create the account.' );
			}
		}
		if ( ! in_array( $p['role'], array( 'boxer', 'coach', 'official', 'medical' ), true ) ) {
			return self::err( 'bcp_role', 'Administrator accounts are set up by Boxing Canada.' );
		}
		$email = sanitize_email( $p['email'] );
		if ( ! is_email( $email ) ) {
			return self::err( 'bcp_email', 'Enter a valid email address.' );
		}
		if ( strlen( $p['password'] ) < 8 ) {
			return self::err( 'bcp_pw', 'Use a password of at least 8 characters.' );
		}
		if ( BCP_Accounts::find_member( $email ) || email_exists( $email ) ) {
			return self::err( 'bcp_exists', 'An account already uses this email. Sign in instead.' );
		}
		if ( self::too_many_attempts( 'register' ) ) {
			return self::err( 'bcp_limit', 'Too many attempts. Try again later.', 429 );
		}
		$coach = null;
		if ( ! empty( $p['coachId'] ) ) {
			$all   = BCP_Store::all( 's_users' );
			$sid   = BCP_Store::safe_id( $p['coachId'] );
			$coach = isset( $all[ $sid ] ) && 'coach' === $all[ $sid ]['role'] ? $all[ $sid ] : null;
		}
		$id  = 'u-' . strtolower( wp_generate_password( 8, false ) );
		$doc = array(
			'id'               => $id,
			'firstName'        => sanitize_text_field( $p['firstName'] ),
			'lastName'         => sanitize_text_field( $p['lastName'] ),
			'role'             => $p['role'],
			'gender'           => 'F' === $p['gender'] ? 'F' : 'M',
			'dob'              => preg_match( '/^\d{4}-\d{2}-\d{2}$/', $p['dob'] ) ? $p['dob'] : '',
			'province'         => sanitize_text_field( $p['province'] ),
			'email'            => $email,
			'membershipId'     => BCP_Accounts::new_membership_id( $p['role'] ),
			'status'           => 'pending',
			'selectedCoachIds' => array(),
			'club'             => $coach && isset( $coach['club'] ) ? $coach['club'] : '',
			'certs'            => (object) array(),
			'evaluatorPrograms' => array(),
			'createdAt'        => gmdate( 'Y-m-d\TH:i:s' ),
			'_o'               => count( BCP_Store::all( 's_users' ) ),
		);
		if ( 'medical' === $p['role'] ) {
			$doc['honorific'] = 'Dr.';
		}
		BCP_Store::put( 's_users', $id, $doc );
		$wp = BCP_Accounts::ensure_wp_user( $doc, $p['password'] );
		if ( is_wp_error( $wp ) ) {
			BCP_Store::put( 's_users', $id, null );
			return self::err( 'bcp_wp', $wp->get_error_message() );
		}
		if ( $coach && 'boxer' === $p['role'] ) {
			$rid = 'rel-' . strtolower( wp_generate_password( 8, false ) );
			$now = gmdate( 'Y-m-d\TH:i:s' );
			BCP_Store::put( 's_coachRequests', $rid, array( 'id' => $rid, 'boxerId' => $id, 'coachId' => $coach['id'], 'type' => 'start', 'status' => 'pending_coach', 'requestedBy' => $id, 'otherCoaches' => array(), 'at' => $now, 'pendingCoachAt' => $now, 'note' => 'Requested when creating my account.', 'history' => array( array( 'at' => $now, 'by' => $id, 'text' => 'Requested' ) ), '_o' => -time() ) );
		}
		$name = $doc['firstName'] . ' ' . $doc['lastName'];
		self::notify( 'role:nsoadmin', "New registration waiting for approval: $name ({$doc['province']}).", 'USERS' );
		foreach ( BCP_Store::all( 's_users' ) as $u ) {
			if ( 'ptso' === $u['role'] && 'approved' === $u['status'] && $u['province'] === $doc['province'] ) {
				self::notify( $u['id'], "New registration waiting for approval: $name.", 'USERS' );
			}
		}
		return array( 'ok' => true, 'membershipId' => $doc['membershipId'], 'message' => "Thanks, {$doc['firstName']}. Your account request ({$doc['membershipId']}) was sent to your PTSO for approval. You’ll be able to sign in once it’s approved." );
	}

	/* ------------------------------------------------------------------ Activation */

	private static function invite_for_code( $code ) {
		$code = strtoupper( trim( (string) $code ) );
		if ( '' === $code ) {
			return null;
		}
		return BCP_Store::find( 's_users', function ( $u ) use ( $code ) { return 'invited' === $u['status'] && isset( $u['activation']['code'] ) && strtoupper( $u['activation']['code'] ) === $code; } );
	}

	public static function activate_check( WP_REST_Request $req ) {
		if ( self::too_many_attempts( 'activate' ) ) {
			return self::err( 'bcp_limit', 'Too many attempts. Wait 15 minutes and try again.', 429 );
		}
		$u = self::invite_for_code( $req->get_param( 'code' ) );
		if ( ! $u ) {
			return self::err( 'bcp_code', 'That activation code isn’t valid or has already been used.', 404 );
		}
		if ( strtotime( $u['activation']['expiresAt'] ) < time() ) {
			return self::err( 'bcp_expired', 'That code has expired. Request a new one below.', 410 );
		}
		return array( 'ok' => true, 'member' => array( 'id' => $u['id'], 'firstName' => $u['firstName'], 'membershipId' => $u['membershipId'], 'role' => $u['role'], 'province' => $u['province'], 'email' => $u['email'] ) );
	}

	public static function activate( WP_REST_Request $req ) {
		$u  = self::invite_for_code( $req->get_param( 'code' ) );
		$pw = (string) $req->get_param( 'password' );
		if ( ! $u || strtotime( $u['activation']['expiresAt'] ) < time() ) {
			return self::err( 'bcp_code', 'That activation code isn’t valid or has expired.', 404 );
		}
		if ( strlen( $pw ) < 8 ) {
			return self::err( 'bcp_pw', 'Use a password of at least 8 characters.' );
		}
		$wp = BCP_Accounts::ensure_wp_user( $u, $pw );
		if ( is_wp_error( $wp ) ) {
			return self::err( 'bcp_wp', $wp->get_error_message() );
		}
		$u['status']              = 'approved';
		$u['activatedAt']         = gmdate( 'Y-m-d\TH:i:s' );
		$u['activation']['usedAt'] = gmdate( 'Y-m-d\TH:i:s' );
		BCP_Store::put( 's_users', BCP_Store::safe_id( $u['id'] ), $u );
		foreach ( BCP_Store::all( 's_interests' ) as $iid => $i ) {
			if ( isset( $i['email'] ) && strtolower( $i['email'] ) === strtolower( $u['email'] ) ) {
				$i['status'] = 'joined';
				BCP_Store::put( 's_interests', $iid, $i );
			}
		}
		self::notify( 'role:nsoadmin', "{$u['firstName']} {$u['lastName']} activated their portal account.", 'USERS' );
		wp_set_current_user( $wp->ID );
		wp_set_auth_cookie( $wp->ID, true, is_ssl() );
		return array( 'ok' => true, 'userId' => $u['id'] );
	}

	public static function activate_resend( WP_REST_Request $req ) {
		$email = strtolower( sanitize_email( (string) $req->get_param( 'email' ) ) );
		$msg   = 'If that email belongs to a new member, a fresh activation code is on its way. Check your inbox and spam folder.';
		if ( ! $email || self::too_many_attempts( 'resend' . $email ) ) {
			return array( 'ok' => true, 'message' => $msg );
		}
		$u = BCP_Store::find( 's_users', function ( $x ) use ( $email ) { return in_array( $x['status'], array( 'invited', 'lapsed' ), true ) && strtolower( (string) $x['email'] ) === $email; } );
		if ( $u ) {
			$code            = BCP_Accounts::new_code();
			$u['status']     = 'invited';
			$u['activation'] = array( 'code' => $code, 'createdAt' => gmdate( 'c' ), 'expiresAt' => gmdate( 'c', time() + 14 * DAY_IN_SECONDS ) );
			BCP_Store::put( 's_users', BCP_Store::safe_id( $u['id'] ), $u );
			$link = self::portal_url() . '#activate-' . $code;
			self::queue_mail( array( 'kind' => 'activation', 'to' => $u['email'], 'userId' => $u['id'], 'code' => $code, 'subject' => 'Welcome to Boxing Canada: activate your portal account', 'body' => "Hi {$u['firstName']},\n\nHere is a new code to activate your Boxing Canada portal account.\n\nActivation link: $link\nOr go to the portal, choose “Activate My Account” and enter this code: $code\n\nThe code expires in 14 days.\n\nBoxing Canada" ) );
		}
		return array( 'ok' => true, 'message' => $msg );
	}

	/* ------------------------------------------------------------------ Parents & guardians */

	public static function guardian_request( WP_REST_Request $req ) {
		$mid   = strtoupper( trim( (string) $req->get_param( 'membershipId' ) ) );
		$email = strtolower( sanitize_email( (string) $req->get_param( 'email' ) ) );
		$msg   = 'If that membership ID and email match our records, a secure link is on its way to that email.';
		if ( ! $mid || ! $email || self::too_many_attempts( 'guardian' . $mid ) ) {
			return array( 'ok' => true, 'message' => $msg );
		}
		$b = BCP_Store::find( 's_users', function ( $u ) use ( $mid ) { return 'boxer' === $u['role'] && strtoupper( (string) $u['membershipId'] ) === $mid; } );
		if ( $b && strtolower( self::guardian_email( $b ) ) === $email ) {
			$code = self::issue_guardian_code( $b );
			$link = self::portal_url() . '#guardian-' . $code;
			self::queue_mail( array( 'kind' => 'guardian', 'to' => self::guardian_email( $b ), 'userId' => $b['id'], 'code' => $code, 'subject' => "Boxing Canada: {$b['firstName']}’s coach relationships", 'body' => "Hello,\n\nYou asked for access to {$b['firstName']} {$b['lastName']}’s coach relationships.\n\nOpen this link: $link\nOr go to the portal, choose “Parents & Guardians” and enter this code: $code\n\nThe link works for 7 days.\n\nBoxing Canada" ) );
		}
		return array( 'ok' => true, 'message' => $msg );
	}

	/* ------------------------------------------------------------------ Administrators */

	public static function admin_password( WP_REST_Request $req ) {
		$c = BCP_Access::context();
		if ( ! BCP_Access::is_admin( $c ) ) {
			return self::err( 'bcp_forbidden', 'Only administrators can set passwords.', 403 );
		}
		$all = BCP_Store::all( 's_users' );
		$sid = BCP_Store::safe_id( (string) $req->get_param( 'userId' ) );
		$doc = isset( $all[ $sid ] ) ? $all[ $sid ] : null;
		$pw  = (string) $req->get_param( 'password' );
		if ( ! $doc ) {
			return self::err( 'bcp_missing', 'Member not found.', 404 );
		}
		if ( 'ptso' === $c['role'] && $doc['province'] !== $c['province'] ) {
			return self::err( 'bcp_forbidden', 'PTSO administrators can only reset passwords in their own province.', 403 );
		}
		if ( in_array( $doc['role'], BCP_Access::ADMIN_ROLES, true ) && 'nsoadmin' !== $c['role'] ) {
			return self::err( 'bcp_forbidden', 'Only Boxing Canada can reset administrator passwords.', 403 );
		}
		if ( strlen( $pw ) < 8 ) {
			return self::err( 'bcp_pw', 'Use a password of at least 8 characters.' );
		}
		$wp = BCP_Accounts::ensure_wp_user( $doc, $pw );
		return is_wp_error( $wp ) ? self::err( 'bcp_wp', $wp->get_error_message() ) : array( 'ok' => true );
	}
}
