<?php
/**
 * Coach evaluations: Square order emails in, evaluation files, and the
 * server-side steps of an evaluation.
 *
 * - A Square order email for a coach evaluation reaches the portal through an
 *   inbound-email service (Postmark, Mailgun or SendGrid) that forwards it to
 *   POST /wp-json/bcp/v1/intake/email?key=..., or an NSO administrator pastes
 *   it into the portal. The email is parsed, matched to a member by NCCP #,
 *   then email, and becomes an evaluation request waiting for an evaluator.
 * - Coaches and evaluators upload evaluation files (photos and PDFs of
 *   templates) to private storage; downloads are checked against the
 *   evaluation request.
 * - When an evaluator records a "certified" outcome, the coach's certified
 *   level is updated here (evaluators can't change member records directly).
 * - The coaching pathway (levels, names, renames, requirements and tasks)
 *   ships in data/coach-pathway.json and is copied into the portal's
 *   programs, where NSO administrators can edit it.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_Coach_Eval {

	const MAX_FILE    = 20971520; // 20 MB.
	const MAX_EMAIL   = 1048576;  // 1 MB of email text.
	const RAW_KEEP    = 30000;    // Characters of the original email kept for review.
	const OPEN_STATES = array( 'paid', 'assigned', 'not_ready', 'in_progress' );

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'bcp_after_write', array( __CLASS__, 'after_write' ), 10, 5 );
		add_action( 'bcp_daily', array( __CLASS__, 'daily' ) );
	}

	public static function routes() {
		$ns = BCP_REST::NS;
		register_rest_route( $ns, '/intake/email', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'intake_email' ), 'permission_callback' => '__return_true' ) );
		register_rest_route( $ns, '/intake/paste', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'intake_paste' ), 'permission_callback' => '__return_true' ) );
		register_rest_route( $ns, '/intake/resolve', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'intake_resolve' ), 'permission_callback' => '__return_true' ) );
		register_rest_route( $ns, '/files', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'upload' ), 'permission_callback' => '__return_true' ) );
		register_rest_route( $ns, '/files/(?P<id>[a-z0-9]{8,40})', array(
			array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'download' ), 'permission_callback' => '__return_true' ),
			array( 'methods' => 'DELETE', 'callback' => array( __CLASS__, 'delete_file' ), 'permission_callback' => '__return_true' ),
		) );
	}

	private static function err( $code, $message, $status = 400 ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}

	private static function now() {
		return gmdate( 'Y-m-d\TH:i:s' );
	}

	private static function rid( $prefix ) {
		return $prefix . '-' . strtolower( wp_generate_password( 10, false ) );
	}

	/* ================================================================
	 * Pathway (levels, renames, requirements, tasks)
	 * ================================================================ */

	public static function pathway() {
		static $p = null;
		if ( null === $p ) {
			$p = json_decode( (string) file_get_contents( BCP_DIR . 'data/coach-pathway.json' ), true );
		}
		return $p;
	}

	public static function program() {
		$p = BCP_Store::get( 's_programs', 'prog-coach' );
		return is_array( $p ) ? $p : null;
	}

	public static function level( $level_id ) {
		$p = self::program();
		foreach ( (array) ( $p ? $p['levels'] : array() ) as $l ) {
			if ( isset( $l['id'] ) && $l['id'] === $level_id ) {
				return $l;
			}
		}
		return null;
	}

	/** The level's name in effect today (scheduled renames apply from their date). */
	public static function level_name( $l, $lang = 'en' ) {
		if ( ! $l ) {
			return 'Unknown level';
		}
		$today = BCP_Plugin::ref_date();
		$name  = 'fr' === $lang && ! empty( $l['nameFr'] ) ? $l['nameFr'] : $l['name'];
		$best  = '';
		foreach ( (array) ( isset( $l['renames'] ) ? $l['renames'] : array() ) as $r ) {
			if ( ! empty( $r['from'] ) && $r['from'] <= $today && $r['from'] >= $best ) {
				$best = $r['from'];
				$name = 'fr' === $lang && ! empty( $r['nameFr'] ) ? $r['nameFr'] : $r['name'];
			}
		}
		return $name;
	}

	/**
	 * Bring the coaching program up to the current pathway structure.
	 * Fees, the open/closed switch and any levels added by Boxing Canada are kept;
	 * earlier NCCP requirements are kept on each level as legacyReqs.
	 */
	public static function migrate() {
		$def = self::pathway();
		if ( ! $def ) {
			return false;
		}
		$p = self::program();
		if ( $p && isset( $p['schema'] ) && (int) $p['schema'] >= (int) $def['schema'] ) {
			return false;
		}
		$out = $def['program'];
		if ( $p ) {
			foreach ( array( 'evaluationsEnabled', '_o' ) as $k ) {
				if ( isset( $p[ $k ] ) ) {
					$out[ $k ] = $p[ $k ];
				}
			}
		} else {
			$out['_o'] = 0;
		}
		$old_levels = array();
		foreach ( (array) ( $p ? $p['levels'] : array() ) as $l ) {
			$old_levels[ $l['id'] ] = $l;
		}
		$levels = array();
		foreach ( $def['levels'] as $l ) {
			if ( isset( $old_levels[ $l['id'] ] ) ) {
				$o = $old_levels[ $l['id'] ];
				if ( isset( $o['fee'] ) ) {
					$l['fee'] = $o['fee'];
				}
				if ( ! empty( $o['reqs'] ) ) {
					$l['legacyReqs'] = $o['reqs'];
				}
				$l['legacyName'] = isset( $o['name'] ) ? $o['name'] : '';
				unset( $old_levels[ $l['id'] ] );
			}
			$levels[] = $l;
		}
		foreach ( $old_levels as $o ) {
			$levels[] = $o; // Levels Boxing Canada added itself.
		}
		$out['levels']         = $levels;
		$out['emailTemplates'] = $def['emailTemplates'];
		$out['schema']         = $def['schema'];
		BCP_Store::put( 's_programs', 'prog-coach', $out );
		return true;
	}

	/* ================================================================
	 * Settings
	 * ================================================================ */

	public static function intake_key() {
		$s = BCP_Plugin::settings();
		if ( empty( $s['intake_key'] ) ) {
			$s['intake_key'] = wp_generate_password( 32, false );
			BCP_Plugin::update_settings( array( 'intake_key' => $s['intake_key'] ) );
		}
		return $s['intake_key'];
	}

	public static function intake_url() {
		return add_query_arg( 'key', self::intake_key(), rest_url( BCP_REST::NS . '/intake/email' ) );
	}

	private static function allowed_senders() {
		$s = BCP_Plugin::settings();
		return array_filter( array_map( 'trim', explode( ',', strtolower( (string) $s['intake_senders'] ) ) ) );
	}

	/* ================================================================
	 * Square email intake
	 * ================================================================ */

	/** Inbound email from Postmark (JSON), Mailgun or SendGrid (form posts). */
	public static function intake_email( WP_REST_Request $req ) {
		$key = (string) $req->get_param( 'key' );
		if ( '' === $key || ! hash_equals( self::intake_key(), $key ) ) {
			return self::err( 'bcp_key', 'Not allowed.', 403 );
		}
		$j       = (array) $req->get_json_params();
		$p       = array_merge( (array) $req->get_body_params(), $j );
		$pick    = function ( $keys ) use ( $p ) {
			foreach ( $keys as $k ) {
				if ( isset( $p[ $k ] ) && is_string( $p[ $k ] ) && '' !== $p[ $k ] ) {
					return $p[ $k ];
				}
			}
			return '';
		};
		$mail = array(
			'subject'   => $pick( array( 'Subject', 'subject' ) ),
			'from'      => $pick( array( 'From', 'from', 'sender' ) ),
			'text'      => $pick( array( 'TextBody', 'body-plain', 'stripped-text', 'text' ) ),
			'html'      => $pick( array( 'HtmlBody', 'body-html', 'html' ) ),
			'messageId' => $pick( array( 'MessageID', 'Message-Id', 'message-id' ) ),
			'source'    => isset( $j['TextBody'] ) || isset( $j['HtmlBody'] ) ? 'postmark' : ( isset( $p['body-plain'] ) ? 'mailgun' : 'email' ),
		);
		if ( strlen( $mail['text'] ) + strlen( $mail['html'] ) > self::MAX_EMAIL ) {
			return self::err( 'bcp_big', 'Email too large.', 413 );
		}
		$res = self::process( $mail, 0 );
		// Inbound services retry on errors, so always answer 200 once the email is recorded.
		return array( 'ok' => true, 'status' => $res['intake']['status'] );
	}

	/** An NSO administrator pastes an order email (or checks how it would be read). */
	public static function intake_paste( WP_REST_Request $req ) {
		$c = BCP_Access::context();
		if ( 'nsoadmin' !== $c['role'] ) {
			return self::err( 'bcp_forbidden', 'Only Boxing Canada administrators can add evaluation orders.', 403 );
		}
		$text = (string) $req->get_param( 'text' );
		if ( '' === trim( $text ) || strlen( $text ) > self::MAX_EMAIL ) {
			return self::err( 'bcp_text', 'Paste the full order email.' );
		}
		$mail = array( 'subject' => (string) $req->get_param( 'subject' ), 'from' => 'pasted', 'text' => $text, 'html' => '', 'messageId' => '', 'source' => 'paste' );
		if ( $req->get_param( 'preview' ) ) {
			$parsed = self::parse( $mail['subject'], $text );
			$match  = self::match_member( $parsed );
			return array( 'ok' => true, 'parsed' => $parsed, 'member' => $match['user'] ? $match['user']['id'] : null, 'matchedBy' => $match['by'], 'suggest' => $match['suggest'] );
		}
		$res = self::process( $mail, $c['id'] );
		return array( 'ok' => true, 'intake' => $res['intake'], 'requestId' => $res['request'] ? $res['request']['id'] : null );
	}

	/** An NSO administrator matches an unmatched order to a member and creates the request. */
	public static function intake_resolve( WP_REST_Request $req ) {
		$c = BCP_Access::context();
		if ( 'nsoadmin' !== $c['role'] ) {
			return self::err( 'bcp_forbidden', 'Only Boxing Canada administrators can do this.', 403 );
		}
		$iid    = BCP_Store::safe_id( (string) $req->get_param( 'intakeId' ) );
		$intake = BCP_Store::get( 's_evalIntake', $iid );
		if ( ! $intake ) {
			return self::err( 'bcp_missing', 'Order not found.', 404 );
		}
		if ( ! empty( $intake['requestId'] ) ) {
			return self::err( 'bcp_done', 'This order already has an evaluation request.' );
		}
		$users = BCP_Store::all( 's_users' );
		$uid   = BCP_Store::safe_id( (string) $req->get_param( 'userId' ) );
		$user  = isset( $users[ $uid ] ) ? $users[ $uid ] : null;
		$level = self::level( (string) $req->get_param( 'levelId' ) );
		if ( ! $user || ! $level ) {
			return self::err( 'bcp_missing', 'Choose the member and the level.' );
		}
		$track = 'challenge' === $req->get_param( 'track' ) ? 'challenge' : 'regular';
		$nccp  = preg_replace( '/\D/', '', (string) $req->get_param( 'nccp' ) );
		if ( $nccp ) {
			$intake['parsed']['nccp'] = $nccp;
		}
		$request             = self::create_request( $intake, $user, $level, $track, $c['id'] );
		$intake['status']    = 'matched';
		$intake['requestId'] = $request['id'];
		$intake['userId']    = $user['id'];
		$intake['matchedBy'] = 'administrator';
		$intake['resolvedBy'] = $c['id'];
		$intake['resolvedAt'] = self::now();
		BCP_Store::put( 's_evalIntake', $iid, $intake );
		return array( 'ok' => true, 'requestId' => $request['id'] );
	}

	/**
	 * Record an order email, and create the evaluation request when the member and level are clear.
	 *
	 * @return array { intake, request|null }
	 */
	public static function process( $mail, $by ) {
		$text = trim( (string) $mail['text'] );
		if ( '' === $text && '' !== $mail['html'] ) {
			$text = self::html_to_text( $mail['html'] );
		}
		$all    = BCP_Store::all( 's_evalIntake' );
		$parsed = self::parse( (string) $mail['subject'], $text );
		$id     = self::rid( 'in' );
		$intake = array(
			'id'        => $id,
			'at'        => self::now(),
			'source'    => $mail['source'],
			'by'        => $by,
			'subject'   => sanitize_text_field( (string) $mail['subject'] ),
			'from'      => sanitize_text_field( str_replace( array( '<', '>' ), array( '(', ')' ), (string) $mail['from'] ) ),
			'messageId' => sanitize_text_field( (string) $mail['messageId'] ),
			'raw'       => function_exists( 'mb_substr' ) ? mb_substr( $text, 0, self::RAW_KEEP ) : substr( $text, 0, self::RAW_KEEP ),
			'parsed'    => $parsed,
			'status'    => 'unmatched',
			'notes'     => array(),
			'_o'        => -time(),
		);

		// The email should come from Square (directly, or forwarded by coach@).
		if ( 'paste' !== $mail['source'] ) {
			$hay = strtolower( (string) $mail['from'] . "\n" . substr( $text, 0, 4000 ) );
			$ok  = false;
			foreach ( self::allowed_senders() as $dom ) {
				if ( false !== strpos( $hay, $dom ) ) {
					$ok = true;
					break;
				}
			}
			if ( ! $ok ) {
				$intake['status']  = 'ignored';
				$intake['notes'][] = 'Not from an allowed sender (see Boxing Canada › Settings). Kept for review, no request created.';
				BCP_Store::put( 's_evalIntake', $id, $intake );
				return array( 'intake' => $intake, 'request' => null );
			}
		}

		// The same order twice (a resent or re-forwarded email).
		foreach ( $all as $x ) {
			$same = ( $intake['messageId'] && isset( $x['messageId'] ) && $x['messageId'] === $intake['messageId'] )
				|| ( ! empty( $parsed['orderNo'] ) && isset( $x['parsed']['orderNo'] ) && $x['parsed']['orderNo'] === $parsed['orderNo'] && 'duplicate' !== $x['status'] );
			if ( $same ) {
				$intake['status']    = 'duplicate';
				$intake['duplicateOf'] = $x['id'];
				$intake['notes'][]   = 'Same order as an email received ' . $x['at'] . '. No new request created.';
				BCP_Store::put( 's_evalIntake', $id, $intake );
				return array( 'intake' => $intake, 'request' => null );
			}
		}

		$match = self::match_member( $parsed );
		$level = $parsed['levelId'] ? self::level( $parsed['levelId'] ) : null;
		$intake['matchedBy'] = $match['by'];
		$intake['suggest']   = $match['suggest'];
		$name = trim( $parsed['firstName'] . ' ' . $parsed['lastName'] );
		$name = $name ? $name : 'Unknown coach';

		if ( ! $match['user'] || ! $level ) {
			$why = array();
			if ( ! $match['user'] ) {
				$why[] = $parsed['nccp'] ? 'no member has NCCP # ' . $parsed['nccp'] . ( $parsed['email'] ? ' or email ' . $parsed['email'] : '' ) : 'no NCCP # or matching member email was found in the email';
			}
			if ( ! $level ) {
				$why[] = 'the level couldn’t be read';
			}
			$intake['notes'][] = 'Needs review: ' . implode( '; ', $why ) . '.';
			BCP_Store::put( 's_evalIntake', $id, $intake );
			BCP_REST::notify( 'role:nsoadmin', "A Square evaluation order needs review: $name" . ( $parsed['nccp'] ? ", NCCP {$parsed['nccp']}" : '' ) . '. Match it to a member in Coach Programs.', 'COACHPROG' );
			return array( 'intake' => $intake, 'request' => null );
		}

		$user = $match['user'];
		foreach ( BCP_Store::all( 's_evalRequests' ) as $r ) {
			if ( $r['requesterId'] === $user['id'] && $r['levelId'] === $level['id'] && in_array( $r['status'], self::OPEN_STATES, true ) ) {
				$intake['status']    = 'review';
				$intake['userId']    = $user['id'];
				$intake['openRequestId'] = $r['id'];
				$intake['notes'][]   = 'This coach already has an open ' . self::level_name( $level ) . ' evaluation request. Check whether this is a second payment before creating another request.';
				BCP_Store::put( 's_evalIntake', $id, $intake );
				BCP_REST::notify( 'role:nsoadmin', "Possible duplicate Square evaluation order: {$user['firstName']} {$user['lastName']} already has an open " . self::level_name( $level ) . ' request.', 'COACHPROG' );
				return array( 'intake' => $intake, 'request' => null );
			}
		}

		$request             = self::create_request( $intake, $user, $level, $parsed['track'], $by );
		$intake['status']    = 'matched';
		$intake['userId']    = $user['id'];
		$intake['requestId'] = $request['id'];
		BCP_Store::put( 's_evalIntake', $id, $intake );
		return array( 'intake' => $intake, 'request' => $request );
	}

	private static function create_request( $intake, $user, $level, $track, $by ) {
		$p      = $intake['parsed'];
		$id     = self::rid( 'er' );
		$now    = self::now();
		$order  = ! empty( $p['orderNo'] ) ? $p['orderNo'] : '';
		$nccp   = ! empty( $p['nccp'] ) ? $p['nccp'] : ( isset( $user['nccp'] ) ? (string) $user['nccp'] : '' );
		$lname  = self::level_name( $level );
		$req    = array(
			'id'          => $id,
			'programId'   => 'prog-coach',
			'levelId'     => $level['id'],
			'requesterId' => $user['id'],
			'status'      => 'paid',
			'track'       => 'challenge' === $track ? 'challenge' : 'regular',
			'source'      => 'square',
			'intakeId'    => $intake['id'],
			'nccp'        => $nccp,
			'notes'       => '',
			'availability' => '',
			'createdAt'   => $now,
			'payment'     => array(
				'provider'      => 'Square',
				'transactionId' => $order ? $order : 'Square order',
				'amount'        => isset( $p['amount'] ) && $p['amount'] ? (float) $p['amount'] : ( isset( $level['fee'] ) ? (float) $level['fee'] : 0 ),
				'currency'      => 'CAD',
				'status'        => 'Paid',
				'paidAt'        => $now,
			),
			'tasks'       => array(),
			'messages'    => array(),
			'history'     => array( array( 'id' => self::rid( 'h' ), 'at' => $now, 'by' => $by ? $by : 'square', 'text' => 'Paid in the Square store' . ( $order ? " (order $order)" : '' ) . '. Request created from the order email.' ) ),
			'_o'          => -time(),
		);
		BCP_Store::put( 's_evalRequests', $id, $req );
		$name = $user['firstName'] . ' ' . $user['lastName'];
		BCP_REST::notify( 'role:nsoadmin', "New $lname evaluation request from Square: $name ({$user['province']})" . ( 'challenge' === $req['track'] ? ', Challenge evaluation' : '' ) . '. Assign an evaluator.', 'COACHPROG' );
		BCP_REST::notify( $user['id'], "Boxing Canada received your $lname evaluation request. An evaluator will contact you soon.", 'EVALS' );
		return $req;
	}

	/* ---------------------------------------------------------------- Parsing */

	public static function html_to_text( $html ) {
		$h = preg_replace( '#<(script|style)[^>]*>.*?</\1>#si', '', (string) $html );
		$h = preg_replace( '#<br\s*/?>#i', "\n", $h );
		$h = preg_replace( '#</(p|div|tr|li|h[1-6]|table)>#i', "\n", $h );
		$h = preg_replace( '#</t[dh]>#i', "\n", $h );
		$h = wp_strip_all_tags( $h, false );
		$h = html_entity_decode( $h, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$h = preg_replace( "/[ \t\x{00A0}]+/u", ' ', $h );
		$h = preg_replace( "/\n\s*\n+/", "\n", $h );
		return trim( $h );
	}

	private static function fold( $s ) {
		$s = strtolower( remove_accents( (string) $s ) );
		return trim( preg_replace( '/[^a-z0-9@.+\-]+/', ' ', $s ) );
	}

	/**
	 * Read a Square order email: coach name, NCCP #, email, level, Regular or
	 * Challenge evaluation, order number and amount. Square lays its emails out
	 * as "Label: value" or a label with the value on the next line; both work.
	 */
	public static function parse( $subject, $text ) {
		$text  = str_replace( array( "\r\n", "\r" ), "\n", (string) $text );
		$lines = array_values( array_filter( array_map( 'trim', explode( "\n", $text ) ), 'strlen' ) );
		$out   = array( 'firstName' => '', 'lastName' => '', 'fullName' => '', 'nccp' => '', 'email' => '', 'phone' => '', 'province' => '', 'levelText' => '', 'levelId' => '', 'track' => 'regular', 'orderNo' => '', 'amount' => 0 );

		// Label → value pairs.
		$pairs = array();
		foreach ( $lines as $i => $ln ) {
			if ( preg_match( '/^([^:]{2,60}?)\s*[:：]\s*(.+)$/u', $ln, $m ) && ! preg_match( '#^https?$#i', $m[1] ) ) {
				$pairs[] = array( self::fold( $m[1] ), trim( $m[2] ) );
			} elseif ( isset( $lines[ $i + 1 ] ) && strlen( $ln ) <= 60 && ! preg_match( '/[.!?]$/', $ln ) ) {
				$pairs[] = array( self::fold( rtrim( $ln, ':' ) ), $lines[ $i + 1 ] );
			}
		}
		$label = function ( $re ) use ( $pairs ) {
			foreach ( $pairs as $pr ) {
				if ( preg_match( $re, $pr[0] ) && '' !== trim( $pr[1] ) ) {
					return trim( $pr[1] );
				}
			}
			return '';
		};

		// NCCP #.
		$v = $label( '/(^|\b)(nccp|pnce|ccn|cc number|coach (id|number|no|num)|numero (d )?entraineur|locker)/' );
		if ( preg_match( '/\b(\d{5,8})\b/', $v, $m ) ) {
			$out['nccp'] = $m[1];
		} elseif ( preg_match( '/(?:NCCP|PNCE|CC\s*#)[^0-9\n]{0,40}(\d{5,8})\b/i', $text, $m ) ) {
			$out['nccp'] = $m[1];
		}

		// Name.
		$first = $label( '/^(coach s )?(first name|prenom|given name)/' );
		$last  = $label( '/^(coach s )?(last name|nom de famille|surname|family name)/' );
		$full  = $label( '/^(coach s name|coach name|name of (the )?coach|nom de l entraineur|full name|nom complet|participant|name|nom|customer|client|buyer)$/' );
		if ( ! $full && ! $first ) {
			$full = $label( '/(coach s name|coach name|nom de l entraineur|full name|nom complet)/' );
		}
		$full = trim( preg_replace( '/\s+/', ' ', preg_replace( '/[<(].*$/', '', $full ) ) );
		if ( $first || $last ) {
			$out['firstName'] = sanitize_text_field( $first );
			$out['lastName']  = sanitize_text_field( $last );
		} elseif ( $full && ! is_email( $full ) ) {
			$bits             = explode( ' ', $full );
			$out['lastName']  = sanitize_text_field( count( $bits ) > 1 ? array_pop( $bits ) : '' );
			$out['firstName'] = sanitize_text_field( implode( ' ', $bits ) );
		}
		$out['fullName'] = trim( $out['firstName'] . ' ' . $out['lastName'] );

		// Email: a labelled one first, otherwise the first that isn't Boxing Canada's or Square's.
		$skip = array( 'boxingcanada.org', 'squareup.com', 'square.site', 'squarespace', 'noreply', 'no-reply', 'postmarkapp', 'mailgun', 'sendgrid' );
		$v    = $label( '/(e ?mail|courriel)/' );
		$cands = array();
		if ( preg_match( '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $v, $m ) ) {
			$cands[] = $m[0];
		}
		preg_match_all( '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $text, $mm );
		$cands = array_merge( $cands, $mm[0] );
		foreach ( $cands as $e ) {
			$ok = true;
			foreach ( $skip as $s ) {
				if ( false !== stripos( $e, $s ) ) {
					$ok = false;
				}
			}
			if ( $ok && is_email( $e ) ) {
				$out['email'] = strtolower( sanitize_email( $e ) );
				break;
			}
		}

		$v = $label( '/(phone|telephone|tel|cell)/' );
		if ( preg_match( '/[\d()+][\d()\-. ]{6,}\d/', $v, $m ) ) {
			$out['phone'] = sanitize_text_field( $m[0] );
		}
		$v = $label( '/^(province|prov|province territory|state)$/' );
		if ( preg_match( '/\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/', strtoupper( $v ), $m ) ) {
			$out['province'] = $m[1];
		}

		// Level: a labelled line first, then anywhere in the email (longest name wins, URLs ignored).
		$plain = preg_replace( '#https?://\S+#', ' ', $subject . "\n" . $text );
		$lv    = $label( '/(level|niveau|course|cours|evaluation for|evaluation level|option|variation|item|article)/' );
		$found = self::find_level( $lv );
		if ( ! $found ) {
			$found = self::find_level( $plain );
		}
		if ( $found ) {
			$out['levelId']   = $found[0];
			$out['levelText'] = $found[1];
		}

		// Regular or Challenge evaluation (Square product option).
		if ( preg_match( '/\bchallenge\b|\bd[ée]fi\b/iu', $plain ) ) {
			$out['track'] = 'challenge';
		}

		// Order number and amount.
		if ( preg_match( '/(?:order|commande|receipt|re[çc]u)\s*(?:#|no\.?|number|num[ée]ro|n[°º])?\s*[:#]?\s*((?=[A-Z0-9\-]*\d)[A-Z0-9][A-Z0-9\-]{3,})/iu', $subject . "\n" . $text, $m ) ) {
			$out['orderNo'] = sanitize_text_field( $m[1] );
		}
		if ( preg_match( '/(?:total|amount paid|amount|montant)[^$\d]{0,25}\$?\s*(\d{1,4}(?:[.,]\d{2}))/i', $text, $m ) ) {
			$out['amount'] = (float) str_replace( ',', '.', $m[1] );
		}
		return $out;
	}

	/** @return array|null [ level id, the text that matched ] */
	private static function find_level( $text ) {
		$hay = ' ' . self::fold( $text ) . ' ';
		if ( '  ' === $hay ) {
			return null;
		}
		$p    = self::program();
		$best = null;
		foreach ( (array) ( $p ? $p['levels'] : array() ) as $l ) {
			$names = array_merge( array( $l['name'] ), isset( $l['nameFr'] ) ? array( $l['nameFr'] ) : array(), (array) ( isset( $l['aliases'] ) ? $l['aliases'] : array() ) );
			foreach ( (array) ( isset( $l['renames'] ) ? $l['renames'] : array() ) as $r ) {
				$names[] = $r['name'];
				if ( ! empty( $r['nameFr'] ) ) {
					$names[] = $r['nameFr'];
				}
			}
			foreach ( $names as $n ) {
				$f = self::fold( $n );
				if ( strlen( $f ) < 4 ) {
					continue;
				}
				$pos = strpos( $hay, ' ' . $f . ' ' );
				if ( false !== $pos && ( ! $best || strlen( $f ) > strlen( $best[2] ) ) ) {
					$best = array( $l['id'], $n, $f );
				}
			}
		}
		return $best ? array( $best[0], $best[1] ) : null;
	}

	/** Find the member: NCCP # first, then email. A unique name match is only suggested. */
	public static function match_member( $parsed ) {
		$users = BCP_Store::all( 's_users' );
		$live  = function ( $u ) {
			return is_array( $u ) && in_array( isset( $u['status'] ) ? $u['status'] : '', array( 'approved', 'invited', 'lapsed', 'pending' ), true );
		};
		$rank  = function ( $list ) {
			usort( $list, function ( $a, $b ) {
				$sa = ( 'coach' === $a['role'] ? 2 : 0 ) + ( 'approved' === $a['status'] ? 1 : 0 );
				$sb = ( 'coach' === $b['role'] ? 2 : 0 ) + ( 'approved' === $b['status'] ? 1 : 0 );
				return $sb - $sa;
			} );
			return $list ? $list[0] : null;
		};
		if ( ! empty( $parsed['nccp'] ) ) {
			$hits = array();
			foreach ( $users as $u ) {
				$no = isset( $u['trackie']['NCCP #'] ) && $u['trackie']['NCCP #'] ? $u['trackie']['NCCP #'] : ( isset( $u['nccp'] ) ? $u['nccp'] : '' );
				if ( $live( $u ) && preg_replace( '/\D/', '', (string) $no ) === $parsed['nccp'] ) {
					$hits[] = $u;
				}
			}
			if ( $hits ) {
				return array( 'user' => $rank( $hits ), 'by' => 'nccp', 'suggest' => array() );
			}
		}
		if ( ! empty( $parsed['email'] ) ) {
			$hits = array();
			foreach ( $users as $u ) {
				$e2 = isset( $u['trackie']['INDIVIDUAL EMAIL'] ) ? strtolower( $u['trackie']['INDIVIDUAL EMAIL'] ) : '';
				if ( $live( $u ) && ( strtolower( (string) $u['email'] ) === $parsed['email'] || $e2 === $parsed['email'] ) ) {
					$hits[] = $u;
				}
			}
			if ( $hits ) {
				return array( 'user' => $rank( $hits ), 'by' => 'email', 'suggest' => array() );
			}
		}
		$suggest = array();
		if ( ! empty( $parsed['lastName'] ) ) {
			$fl = self::fold( $parsed['lastName'] );
			$ff = self::fold( $parsed['firstName'] );
			foreach ( $users as $u ) {
				if ( $live( $u ) && self::fold( $u['lastName'] ) === $fl && ( ! $ff || 0 === strpos( self::fold( $u['firstName'] ), substr( $ff, 0, 3 ) ) ) ) {
					$suggest[] = $u['id'];
				}
			}
		}
		return array( 'user' => null, 'by' => '', 'suggest' => array_slice( $suggest, 0, 5 ) );
	}

	/* ================================================================
	 * Evaluation files
	 * ================================================================ */

	private static function dir() {
		$up  = wp_upload_dir( null, false );
		$dir = trailingslashit( $up['basedir'] ) . 'bcp-private';
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		if ( ! file_exists( $dir . '/.htaccess' ) ) {
			file_put_contents( $dir . '/.htaccess', "# Boxing Canada Portal private files\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n" );
			file_put_contents( $dir . '/index.php', "<?php\n// Silence.\n" );
		}
		return $dir;
	}

	private static function mimes() {
		return array(
			'jpg|jpeg|jpe' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp', 'heic' => 'image/heic', 'heif' => 'image/heif',
			'pdf' => 'application/pdf', 'txt' => 'text/plain',
			'doc' => 'application/msword', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'ppt' => 'application/vnd.ms-powerpoint', 'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'xls' => 'application/vnd.ms-excel', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'mp4|m4v' => 'video/mp4', 'mov|qt' => 'video/quicktime',
		);
	}

	/** May this person add files to (or read files of) this request? */
	private static function party( $req, $c ) {
		if ( ! $req ) {
			return false;
		}
		if ( 'nsoadmin' === $c['role'] ) {
			return true;
		}
		return $c['id'] && ( $req['requesterId'] === $c['id'] || ( isset( $req['assignedEvaluatorId'] ) && $req['assignedEvaluatorId'] === $c['id'] ) );
	}

	public static function upload( WP_REST_Request $req ) {
		$c = BCP_Access::context();
		if ( in_array( $c['role'], array( 'public', 'guardian' ), true ) ) {
			return self::err( 'bcp_forbidden', 'Sign in to upload files.', 403 );
		}
		$rid = BCP_Store::safe_id( (string) $req->get_param( 'requestId' ) );
		$er  = BCP_Store::get( 's_evalRequests', $rid );
		if ( ! self::party( $er, $c ) ) {
			return self::err( 'bcp_forbidden', 'You can only add files to your own evaluation.', 403 );
		}
		$files = $req->get_file_params();
		$f     = isset( $files['file'] ) ? $files['file'] : null;
		if ( ! $f || ! empty( $f['error'] ) || empty( $f['tmp_name'] ) || ! is_uploaded_file( $f['tmp_name'] ) ) {
			$big = $f && in_array( (int) $f['error'], array( UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE ), true );
			return self::err( 'bcp_upload', $big ? 'That file is larger than this server accepts. Share videos as a link instead.' : 'The file didn’t arrive. Try again.' );
		}
		if ( (int) $f['size'] > self::MAX_FILE ) {
			return self::err( 'bcp_big', 'Files can be up to 20 MB. Share videos as a YouTube or Google Drive link instead.', 413 );
		}
		$name  = sanitize_file_name( wp_basename( (string) $f['name'] ) );
		$check = wp_check_filetype_and_ext( $f['tmp_name'], $name, self::mimes() );
		if ( empty( $check['ext'] ) || empty( $check['type'] ) ) {
			return self::err( 'bcp_type', 'Upload a photo, PDF, Word, PowerPoint or Excel file (or a short video).' );
		}
		$fid  = strtolower( wp_generate_password( 32, false ) );
		$sub  = gmdate( 'Y' );
		$dir  = self::dir() . '/' . $sub;
		wp_mkdir_p( $dir );
		$rel  = $sub . '/' . $fid . '.' . $check['ext'];
		if ( ! move_uploaded_file( $f['tmp_name'], self::dir() . '/' . $rel ) ) {
			return self::err( 'bcp_store', 'The file couldn’t be saved on the server.', 500 );
		}
		$doc = array(
			'id'        => $fid,
			'name'      => $name ? $name : 'file.' . $check['ext'],
			'mime'      => $check['type'],
			'size'      => (int) $f['size'],
			'path'      => $rel,
			'requestId' => $rid,
			'by'        => $c['id'],
			'at'        => self::now(),
		);
		BCP_Store::put( 's_files', $fid, $doc );
		return array( 'ok' => true, 'file' => array( 'fileId' => $fid, 'name' => $doc['name'], 'mime' => $doc['mime'], 'size' => $doc['size'] ) );
	}

	public static function download( WP_REST_Request $req ) {
		$c   = BCP_Access::context();
		$doc = BCP_Store::get( 's_files', BCP_Store::safe_id( (string) $req['id'] ) );
		$er  = $doc ? BCP_Store::get( 's_evalRequests', $doc['requestId'] ) : null;
		$can = $er && ( self::party( $er, $c ) || ( 'ptso' === $c['role'] && null !== BCP_Access::read( 's_evalRequests', $er['id'], $er, $c ) ) );
		if ( ! $doc || ! $can ) {
			return self::err( 'bcp_forbidden', 'File not found, or you don’t have access to it.', 404 );
		}
		$path = self::dir() . '/' . $doc['path'];
		if ( ! file_exists( $path ) ) {
			return self::err( 'bcp_gone', 'This file is no longer on the server.', 410 );
		}
		$inline = (bool) preg_match( '#^(image/(jpeg|png|gif|webp)|application/pdf|video/)#', $doc['mime'] );
		nocache_headers();
		header( 'Content-Type: ' . $doc['mime'] );
		header( 'Content-Length: ' . filesize( $path ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( "Content-Security-Policy: default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox" );
		header( 'Content-Disposition: ' . ( $inline ? 'inline' : 'attachment' ) . '; filename="' . str_replace( '"', '', $doc['name'] ) . '"' );
		readfile( $path );
		exit;
	}

	public static function delete_file( WP_REST_Request $req ) {
		$c   = BCP_Access::context();
		$fid = BCP_Store::safe_id( (string) $req['id'] );
		$doc = BCP_Store::get( 's_files', $fid );
		if ( ! $doc || ( $doc['by'] !== $c['id'] && 'nsoadmin' !== $c['role'] ) ) {
			return self::err( 'bcp_forbidden', 'Only the person who uploaded a file can remove it.', 403 );
		}
		$path = self::dir() . '/' . $doc['path'];
		if ( file_exists( $path ) ) {
			wp_delete_file( $path );
		}
		BCP_Store::put( 's_files', $fid, null );
		return array( 'ok' => true );
	}

	/* ================================================================
	 * Server-side steps after a change is saved
	 * ================================================================ */

	public static function after_write( $coll, $id, $old, $new, $c ) {
		if ( 's_evalRequests' !== $coll || null === $new ) {
			return;
		}
		$level = self::level( $new['levelId'] );
		$users = BCP_Store::all( 's_users' );

		// A new or changed evaluator: email them the assignment.
		$was = $old && isset( $old['assignedEvaluatorId'] ) ? $old['assignedEvaluatorId'] : '';
		$now = isset( $new['assignedEvaluatorId'] ) ? $new['assignedEvaluatorId'] : '';
		if ( $now && $now !== $was && isset( $users[ BCP_Store::safe_id( $now ) ] ) ) {
			$ev    = $users[ BCP_Store::safe_id( $now ) ];
			$coach = isset( $users[ BCP_Store::safe_id( $new['requesterId'] ) ] ) ? $users[ BCP_Store::safe_id( $new['requesterId'] ) ] : null;
			$p     = self::program();
			$lang  = self::lang_of( $ev );
			$tpl   = isset( $p['emailTemplates']['assigned'][ $lang ] ) ? $p['emailTemplates']['assigned'][ $lang ] : null;
			if ( $tpl && $coach ) {
				$vars = array(
					'evaluatorName' => $ev['firstName'] . ' ' . $ev['lastName'],
					'coachName'     => $coach['firstName'] . ' ' . $coach['lastName'],
					'levelName'     => self::level_name( $level, $lang ),
					'trackNote'     => 'challenge' === ( isset( $new['track'] ) ? $new['track'] : '' ) ? ( 'fr' === $lang ? ' (évaluation de type défi)' : ' (Challenge evaluation)' ) : '',
					'nccp'          => ! empty( $new['nccp'] ) ? $new['nccp'] : '—',
					'province'      => $coach['province'],
					'orderNo'       => isset( $new['payment']['transactionId'] ) ? $new['payment']['transactionId'] : '—',
					'portalUrl'     => BCP_REST::portal_url(),
				);
				BCP_REST::queue_mail( array( 'kind' => 'eval_assigned', 'to' => $ev['email'], 'userId' => $ev['id'], 'requestId' => $new['id'], 'subject' => self::fill( $tpl['subject'], $vars ), 'body' => self::fill( $tpl['body'], $vars ) ) );
			}
		}

		// A certified outcome: record the coach's new level.
		$done = 'completed' === $new['status'] && ( ! $old || 'completed' !== $old['status'] ) && isset( $new['outcome']['result'] ) && 'certified' === $new['outcome']['result'];
		if ( $done ) {
			$sid = BCP_Store::safe_id( $new['requesterId'] );
			$u   = isset( $users[ $sid ] ) ? $users[ $sid ] : null;
			if ( $u ) {
				$certs = isset( $u['certs'] ) && is_array( $u['certs'] ) ? $u['certs'] : array();
				$p     = self::program();
				$rank  = function ( $lid ) use ( $p ) {
					foreach ( (array) $p['levels'] as $i => $l ) {
						if ( $l['id'] === $lid ) {
							return $i;
						}
					}
					return -1;
				};
				$cur = isset( $certs[ $new['programId'] ] ) ? $certs[ $new['programId'] ] : '';
				if ( $rank( $new['levelId'] ) > $rank( $cur ) ) {
					$certs[ $new['programId'] ] = $new['levelId'];
					$u['certs']                 = $certs;
					$u['certHistory']           = array_merge( (array) ( isset( $u['certHistory'] ) ? $u['certHistory'] : array() ), array( array( 'programId' => $new['programId'], 'levelId' => $new['levelId'], 'at' => self::now(), 'by' => isset( $new['outcome']['by'] ) ? $new['outcome']['by'] : $c['id'], 'note' => 'Certified by evaluation ' . $new['id'], 'requestId' => $new['id'] ) ) );
					BCP_Store::put( 's_users', $sid, $u );
				}
			}
		}
	}

	public static function lang_of( $u ) {
		$l = strtolower( (string) ( isset( $u['lang'] ) ? $u['lang'] : ( isset( $u['trackie']['LANGUAGE'] ) ? $u['trackie']['LANGUAGE'] : ( isset( $u['trackie']['PREFERRED LANGUAGE'] ) ? $u['trackie']['PREFERRED LANGUAGE'] : '' ) ) ) );
		return 0 === strpos( $l, 'fr' ) ? 'fr' : 'en';
	}

	public static function fill( $tpl, $vars ) {
		return preg_replace_callback( '/\{(\w+)\}/', function ( $m ) use ( $vars ) {
			return array_key_exists( $m[1], $vars ) ? (string) $vars[ $m[1] ] : $m[0];
		}, (string) $tpl );
	}

	/**
	 * Evaluation emails written in the portal by an evaluator: they always go to
	 * the coach of that evaluation, with replies to the evaluator.
	 */
	public static function prepare_mail( $mail ) {
		$kind = isset( $mail['kind'] ) ? (string) $mail['kind'] : '';
		if ( 0 !== strpos( $kind, 'eval_' ) ) {
			return $mail;
		}
		$c   = BCP_Access::context();
		$rid = BCP_Store::safe_id( isset( $mail['requestId'] ) ? $mail['requestId'] : '' );
		$er  = BCP_Store::get( 's_evalRequests', $rid );
		$ok  = $er && ( 'nsoadmin' === $c['role'] || ( isset( $er['assignedEvaluatorId'] ) && $er['assignedEvaluatorId'] === $c['id'] ) );
		$users = BCP_Store::all( 's_users' );
		$coach = $er && isset( $users[ BCP_Store::safe_id( $er['requesterId'] ) ] ) ? $users[ BCP_Store::safe_id( $er['requesterId'] ) ] : null;
		if ( 'eval_assigned' === $kind || ! $ok || ! $coach || ! is_email( $coach['email'] ) ) {
			$mail['to']   = '';
			$mail['body'] = 'Not sent: only the assigned evaluator can email the coach of an evaluation.';
			return $mail;
		}
		$ev = isset( $er['assignedEvaluatorId'] ) && isset( $users[ BCP_Store::safe_id( $er['assignedEvaluatorId'] ) ] ) ? $users[ BCP_Store::safe_id( $er['assignedEvaluatorId'] ) ] : $c['doc'];
		$mail['to']      = $coach['email'];
		$mail['userId']  = $coach['id'];
		$mail['replyTo'] = $ev && is_email( $ev['email'] ) ? $ev['email'] : '';
		$mail['fromName'] = $ev ? $ev['firstName'] . ' ' . $ev['lastName'] . ' (Boxing Canada)' : '';
		$s = BCP_Plugin::settings();
		$mail['cc'] = is_email( $s['eval_cc'] ) ? $s['eval_cc'] : '';
		$mail['subject'] = sanitize_text_field( isset( $mail['subject'] ) ? $mail['subject'] : '' );
		$mail['body']    = sanitize_textarea_field( isset( $mail['body'] ) ? $mail['body'] : '' );
		return $mail;
	}

	/* ================================================================
	 * Daily reminders (service expectation: 1 business day)
	 * ================================================================ */

	public static function daily() {
		$users = BCP_Store::all( 's_users' );
		$cut   = gmdate( 'Y-m-d\TH:i:s', time() - DAY_IN_SECONDS );
		$waiting = 0;
		foreach ( BCP_Store::all( 's_evalRequests' ) as $id => $r ) {
			if ( 'paid' === $r['status'] && $r['createdAt'] < $cut ) {
				$waiting++;
			}
			if ( 'assigned' === $r['status'] && ! empty( $r['assignedAt'] ) && $r['assignedAt'] < $cut && empty( $r['readinessRemindedAt'] ) && ! empty( $r['assignedEvaluatorId'] ) ) {
				$coach = isset( $users[ BCP_Store::safe_id( $r['requesterId'] ) ] ) ? $users[ BCP_Store::safe_id( $r['requesterId'] ) ] : null;
				BCP_REST::notify( $r['assignedEvaluatorId'], 'Reminder: check ' . ( $coach ? $coach['firstName'] . ' ' . $coach['lastName'] . '’s' : 'the coach’s' ) . ' NCCP record and send the readiness email.', 'EVALUATOR' );
				$r['readinessRemindedAt'] = self::now();
				BCP_Store::put( 's_evalRequests', $id, $r );
			}
		}
		if ( $waiting ) {
			BCP_REST::notify( 'role:nsoadmin', "$waiting coach evaluation request" . ( 1 === $waiting ? ' has' : 's have' ) . ' waited more than a day for an evaluator.', 'COACHPROG' );
		}
	}
}
