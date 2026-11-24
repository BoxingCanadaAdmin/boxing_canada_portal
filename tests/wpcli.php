<?php
// Runs PHP inside the test WordPress site: php tests/wpcli.php '<php code>'
$_SERVER['HTTP_HOST'] = 'localhost:8080'; $_SERVER['REQUEST_URI'] = '/';
require ( getenv( 'BCP_WP_SITE' ) ?: __DIR__ . '/.wordpress/site' ) . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
eval( $argv[1] );
