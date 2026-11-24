<?php
/**
 * Deleting the plugin keeps the portal's data by default, so member and
 * medical records are never lost by accident. To remove everything, delete
 * the tables wp_bcp_records and wp_bcp_seq after taking a backup.
 */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}
delete_option( 'bcp_db_version' );
