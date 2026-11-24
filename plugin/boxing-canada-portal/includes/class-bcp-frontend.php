<?php
/**
 * Shows the portal: a full-screen page with its own styles, so the WordPress
 * theme and the portal never interfere with each other.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_Frontend {

	public static function init() {
		add_shortcode( 'boxing_canada_portal', array( __CLASS__, 'shortcode' ) );
		add_filter( 'template_include', array( __CLASS__, 'template' ), 99 );
		add_action( 'template_redirect', array( __CLASS__, 'standalone' ), 1 );
		add_filter( 'show_admin_bar', array( __CLASS__, 'admin_bar' ) );
		add_action( 'admin_init', array( __CLASS__, 'keep_members_out_of_dashboard' ) );
	}

	private static function is_portal_page() {
		$s = BCP_Plugin::settings();
		if ( $s['page_id'] && is_page( (int) $s['page_id'] ) ) {
			return true;
		}
		$post = get_queried_object();
		return $post instanceof WP_Post && has_shortcode( $post->post_content, 'boxing_canada_portal' );
	}

	public static function template( $template ) {
		if ( is_singular() && self::is_portal_page() ) {
			return BCP_DIR . 'templates/portal.php';
		}
		return $template;
	}

	/** /?bcp_portal=1 shows the portal on any site (used by the shortcode's fallback frame). */
	public static function standalone() {
		if ( isset( $_GET['bcp_portal'] ) ) {
			include BCP_DIR . 'templates/portal.php';
			exit;
		}
	}

	/** If a page builder renders the shortcode inside a theme, show the portal in a frame. */
	public static function shortcode() {
		$src = add_query_arg( 'bcp_portal', '1', home_url( '/' ) );
		return '<iframe src="' . esc_url( $src ) . '" title="Boxing Canada Portal" style="width:100%;min-height:90vh;border:0"></iframe>';
	}

	public static function admin_bar( $show ) {
		if ( self::is_member_only() ) {
			return false;
		}
		return $show;
	}

	private static function is_member_only() {
		$u = wp_get_current_user();
		return $u && $u->exists() && in_array( 'bcp_member', (array) $u->roles, true ) && ! $u->has_cap( 'edit_posts' );
	}

	public static function keep_members_out_of_dashboard() {
		if ( self::is_member_only() && ! wp_doing_ajax() ) {
			wp_safe_redirect( BCP_REST::portal_url() );
			exit;
		}
	}

	/** Configuration handed to the portal's browser code. */
	public static function config() {
		$s    = BCP_Plugin::settings();
		$wpid = get_current_user_id();
		$doc  = BCP_Accounts::portal_user_for_wp( $wpid );
		$wpu  = $wpid ? wp_get_current_user() : null;
		return array(
			'rest'         => esc_url_raw( rest_url( BCP_REST::NS . '/' ) ),
			'nonce'        => wp_create_nonce( 'wp_rest' ),
			'portalUserId' => $doc && 'approved' === $doc['status'] ? $doc['id'] : null,
			'wpUser'       => $wpu && ! $doc ? $wpu->display_name : null,
			'testMode'     => (bool) $s['test_mode'],
			'refDate'      => BCP_Plugin::ref_date(),
			'liveClock'    => ! $s['test_mode'],
			'demoUsers'    => $s['test_mode'] ? BCP_Accounts::demo_cards() : array(),
			'coaches'      => BCP_Accounts::public_coaches(),
			'portalUrl'    => BCP_REST::portal_url(),
			'lostPassword' => wp_lostpassword_url( BCP_REST::portal_url() ),
			'version'      => BCP_VERSION,
			'maxUpload'    => (int) min( BCP_Coach_Eval::MAX_FILE, wp_max_upload_size() ),
		);
	}
}
