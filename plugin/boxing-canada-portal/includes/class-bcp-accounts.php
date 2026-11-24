<?php
/**
 * Links portal members to WordPress accounts.
 *
 * Each member who can sign in has a WordPress user (role "Portal member", which
 * can't reach the WordPress dashboard) with the user meta bcp_user_id pointing
 * at their portal member record. WordPress handles passwords, sessions and
 * password resets.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_Accounts {

	const ID_PREFIX = array(
		'boxer'    => 'BC-2026-',
		'coach'    => 'BC-COA-',
		'official' => 'BC-OFF-',
		'medical'  => 'BC-MED-',
		'ptso'     => 'BC-PTSO-',
		'nsoadmin' => 'BC-NSO-',
	);

	/** Demo accounts shown as one-click sign-in cards in test mode. */
	const DEMO_IDS = array( 'u-b1', 'u-b2', 'u-c1', 'u-c2', 'u-c5', 'u-o1', 'u-m1', 'u-p1', 'u-s1' );

	public static function register_role() {
		if ( ! get_role( 'bcp_member' ) ) {
			add_role( 'bcp_member', 'Portal member', array( 'read' => true ) );
		}
	}

	/** The portal member record linked to a WordPress user. */
	public static function portal_user_for_wp( $wp_id ) {
		if ( ! $wp_id ) {
			return null;
		}
		$pid = get_user_meta( $wp_id, 'bcp_user_id', true );
		if ( ! $pid ) {
			return null;
		}
		$all = BCP_Store::all( 's_users' );
		$sid = BCP_Store::safe_id( $pid );
		return isset( $all[ $sid ] ) ? $all[ $sid ] : null;
	}

	/** Find a member by email address or membership ID. */
	public static function find_member( $login ) {
		$login = strtolower( trim( (string) $login ) );
		if ( '' === $login ) {
			return null;
		}
		return BCP_Store::find(
			's_users',
			function ( $u ) use ( $login ) {
				return strtolower( (string) ( isset( $u['email'] ) ? $u['email'] : '' ) ) === $login || strtolower( (string) ( isset( $u['membershipId'] ) ? $u['membershipId'] : '' ) ) === $login;
			}
		);
	}

	/** The WordPress user linked to a member, if any. */
	public static function wp_user_for( $doc ) {
		$found = get_users( array( 'meta_key' => 'bcp_user_id', 'meta_value' => $doc['id'], 'number' => 1 ) );
		if ( $found ) {
			return $found[0];
		}
		return null;
	}

	/**
	 * Make sure a member has a WordPress account, creating one if needed.
	 * A new account gets $password, or a random one if none is given.
	 *
	 * @return WP_User|WP_Error
	 */
	public static function ensure_wp_user( $doc, $password = null ) {
		$user = self::wp_user_for( $doc );
		if ( $user ) {
			if ( $password ) {
				wp_set_password( $password, $user->ID );
				// wp_set_password() ends the current session for that user: they sign in again.
			}
			return $user;
		}
		$email = isset( $doc['email'] ) ? sanitize_email( $doc['email'] ) : '';
		if ( $email && email_exists( $email ) ) {
			$existing = get_user_by( 'email', $email );
			$linked   = get_user_meta( $existing->ID, 'bcp_user_id', true );
			if ( $linked && $linked !== $doc['id'] ) {
				return new WP_Error( 'bcp_email_taken', 'This email is already used by another portal member.' );
			}
			update_user_meta( $existing->ID, 'bcp_user_id', $doc['id'] );
			if ( $password ) {
				wp_set_password( $password, $existing->ID );
			}
			return get_user_by( 'id', $existing->ID );
		}
		$login = sanitize_user( strtolower( isset( $doc['membershipId'] ) && $doc['membershipId'] ? $doc['membershipId'] : $doc['id'] ), true );
		if ( username_exists( $login ) ) {
			$login .= '-' . wp_generate_password( 4, false );
		}
		$id = wp_insert_user(
			array(
				'user_login'   => $login,
				'user_email'   => $email,
				'user_pass'    => $password ? $password : wp_generate_password( 24 ),
				'first_name'   => isset( $doc['firstName'] ) ? $doc['firstName'] : '',
				'last_name'    => isset( $doc['lastName'] ) ? $doc['lastName'] : '',
				'display_name' => trim( ( isset( $doc['firstName'] ) ? $doc['firstName'] : '' ) . ' ' . ( isset( $doc['lastName'] ) ? $doc['lastName'] : '' ) ),
				'role'         => 'bcp_member',
			)
		);
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		update_user_meta( $id, 'bcp_user_id', $doc['id'] );
		return get_user_by( 'id', $id );
	}

	/** Create sign-in accounts for the demo members (test mode). */
	public static function create_demo_logins() {
		$n = 0;
		foreach ( BCP_Store::all( 's_users' ) as $doc ) {
			if ( ! is_array( $doc ) || ! empty( $doc['testData'] ) || 'approved' !== $doc['status'] || 0 !== strpos( $doc['id'], 'u-' ) ) {
				continue;
			}
			$u = self::ensure_wp_user( $doc, BCP_DEMO_PASSWORD );
			if ( ! is_wp_error( $u ) ) {
				$n++;
			}
		}
		return $n;
	}

	/** Remove the WordPress accounts of demo members (leaves administrators alone). */
	public static function delete_demo_logins() {
		require_once ABSPATH . 'wp-admin/includes/user.php';
		$users = get_users( array( 'role' => 'bcp_member', 'meta_key' => 'bcp_user_id', 'fields' => array( 'ID' ) ) );
		foreach ( $users as $u ) {
			if ( 0 === strpos( (string) get_user_meta( $u->ID, 'bcp_user_id', true ), 'u-' ) ) {
				wp_delete_user( $u->ID );
			}
		}
	}

	/** New membership ID for a role. */
	public static function new_membership_id( $role ) {
		$prefix = isset( self::ID_PREFIX[ $role ] ) ? self::ID_PREFIX[ $role ] : 'BC-';
		do {
			$id = $prefix . wp_rand( 1000, 99999 );
		} while ( self::find_member( $id ) );
		return $id;
	}

	public static function new_code( $len = 8 ) {
		$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		$s     = '';
		for ( $i = 0; $i < $len; $i++ ) {
			$s .= $chars[ wp_rand( 0, strlen( $chars ) - 1 ) ];
		}
		return $s;
	}

	/** Public summary of the demo accounts (test mode sign-in cards). */
	public static function demo_cards() {
		$out = array();
		foreach ( self::DEMO_IDS as $id ) {
			$all = BCP_Store::all( 's_users' );
			if ( isset( $all[ $id ] ) && self::wp_user_for( $all[ $id ] ) ) {
				$u     = $all[ $id ];
				$out[] = array(
					'id'           => $u['id'],
					'firstName'    => $u['firstName'],
					'lastName'     => $u['lastName'],
					'honorific'    => isset( $u['honorific'] ) ? $u['honorific'] : '',
					'role'         => $u['role'],
					'membershipId' => $u['membershipId'],
					'email'        => $u['email'],
					'province'     => $u['province'],
					'status'       => $u['status'],
					'password'     => BCP_DEMO_PASSWORD,
				);
			}
		}
		return $out;
	}

	/** Coaches a new boxer can pick when registering (name, club, province only). */
	public static function public_coaches() {
		$out = array();
		foreach ( BCP_Store::all( 's_users' ) as $u ) {
			if ( is_array( $u ) && 'coach' === $u['role'] && 'approved' === $u['status'] && empty( $u['testData'] ) ) {
				$out[] = array(
					'id'        => $u['id'],
					'firstName' => $u['firstName'],
					'lastName'  => $u['lastName'],
					'role'      => 'coach',
					'status'    => 'approved',
					'club'      => isset( $u['club'] ) ? $u['club'] : '',
					'province'  => $u['province'],
					'email'     => '',
					'membershipId' => '',
				);
			}
		}
		return $out;
	}
}
