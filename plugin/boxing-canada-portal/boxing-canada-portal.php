<?php
/**
 * Plugin Name:       Boxing Canada Portal
 * Plugin URI:        https://github.com/BoxingCanadaAdmin/boxing_canada_portal
 * Update URI:        https://github.com/BoxingCanadaAdmin/boxing_canada_portal
 * Description:       The Boxing Canada National Portal: Digital Record Books, medical forms, sanctions, events, travel passes, coach relationships, club managers, certification and Safe Sport. Add the [boxing_canada_portal] shortcode to a page, or use the page the plugin creates on activation.
 * Version:           0.2.3
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            Boxing Canada
 * License:           GPL-2.0-or-later
 * Text Domain:       boxing-canada-portal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BCP_VERSION', '0.2.3' );
define( 'BCP_DB_VERSION', '2' );
define( 'BCP_FILE', __FILE__ );
define( 'BCP_DIR', plugin_dir_path( __FILE__ ) );
define( 'BCP_URL', plugin_dir_url( __FILE__ ) );
define( 'BCP_DEMO_DATE', '2026-10-24' );
define( 'BCP_DEMO_PASSWORD', 'Password123!' );

require_once BCP_DIR . 'includes/class-bcp-store.php';
require_once BCP_DIR . 'includes/class-bcp-access.php';
require_once BCP_DIR . 'includes/class-bcp-accounts.php';
require_once BCP_DIR . 'includes/class-bcp-rest.php';
require_once BCP_DIR . 'includes/class-bcp-coach-eval.php';
require_once BCP_DIR . 'includes/class-bcp-updater.php';
require_once BCP_DIR . 'includes/class-bcp-frontend.php';
require_once BCP_DIR . 'includes/class-bcp-admin.php';

register_activation_hook( __FILE__, array( 'BCP_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'BCP_Plugin', 'deactivate' ) );

/**
 * Bootstraps the plugin.
 */
class BCP_Plugin {

	/** Settings with their defaults. */
	public static function defaults() {
		return array(
			'test_mode'   => 1,   // Demo sign-in cards, quick role switching, fixed demo date.
			'send_emails' => 0,   // Send outgoing portal emails with wp_mail().
			'page_id'     => 0,   // Page that shows the portal.
			'from_name'   => 'Boxing Canada',
			// Coach evaluations.
			'intake_key'      => '',                       // Secret in the inbound-email webhook URL.
			'intake_senders'  => 'squareup.com, square.site, boxingcanada.org',
			'eval_from_email' => '',                       // For example coach@boxingcanada.org (your SMTP service must allow it).
			'eval_cc'         => 'coach@boxingcanada.org', // Copied on evaluation emails to coaches.
			// Updates from the GitHub repository's releases.
			'auto_update'        => 1, // Install new releases automatically (WordPress checks twice a day).
			'update_prereleases' => 0, // Also follow pre-releases (for a test site).
		);
	}

	public static function settings() {
		return wp_parse_args( get_option( 'bcp_settings', array() ), self::defaults() );
	}

	public static function update_settings( $changes ) {
		update_option( 'bcp_settings', array_merge( self::settings(), $changes ) );
	}

	public static function activate() {
		BCP_Store::install();
		BCP_Accounts::register_role();
		$s = self::settings();
		if ( ! $s['page_id'] || ! get_post( $s['page_id'] ) ) {
			$page_id = wp_insert_post(
				array(
					'post_title'   => 'Portal',
					'post_name'    => 'portal',
					'post_content' => '[boxing_canada_portal]',
					'post_status'  => 'publish',
					'post_type'    => 'page',
				)
			);
			if ( $page_id && ! is_wp_error( $page_id ) ) {
				self::update_settings( array( 'page_id' => $page_id ) );
			}
		}
		// First activation: start with the fictional demo data so the portal can be tried straight away.
		if ( 0 === BCP_Store::count() ) {
			BCP_Store::import_dataset( json_decode( file_get_contents( BCP_DIR . 'data/demo-seed.json' ), true ) );
			BCP_Accounts::create_demo_logins();
		}
		BCP_Coach_Eval::migrate();
		if ( ! wp_next_scheduled( 'bcp_daily' ) ) {
			wp_schedule_event( time() + 300, 'daily', 'bcp_daily' );
		}
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( 'bcp_daily' );
		wp_clear_scheduled_hook( 'bcp_self_update' );
	}

	public static function init() {
		if ( get_option( 'bcp_db_version' ) !== BCP_DB_VERSION ) {
			BCP_Store::install();
			BCP_Coach_Eval::migrate();
		}
		BCP_REST::init();
		BCP_Coach_Eval::init();
		BCP_Updater::init();
		BCP_Frontend::init();
		BCP_Admin::init();
		add_action( 'bcp_daily', array( 'BCP_Store', 'daily_maintenance' ) );
	}

	/** Today's date for the portal: the fixed demo date in test mode, otherwise today in the site's time zone. */
	public static function ref_date() {
		$s = self::settings();
		return $s['test_mode'] ? BCP_DEMO_DATE : wp_date( 'Y-m-d' );
	}
}

add_action( 'plugins_loaded', array( 'BCP_Plugin', 'init' ) );
