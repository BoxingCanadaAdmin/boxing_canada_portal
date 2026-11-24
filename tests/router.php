<?php
// PHP built-in server router for the test WordPress site (pretty permalinks).
$site = getenv( 'BCP_WP_SITE' ) ?: __DIR__ . '/.wordpress/site';
$path = parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
if ( '/' !== $path && file_exists( $site . $path ) && ! is_dir( $site . $path ) ) {
	return false;
}
chdir( $site );
$_SERVER['SCRIPT_NAME'] = '/index.php';
require $site . '/index.php';
