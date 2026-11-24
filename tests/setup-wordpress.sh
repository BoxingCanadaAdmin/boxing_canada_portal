#!/usr/bin/env bash
# Sets up a throwaway WordPress test site (SQLite, no MySQL needed) in tests/.wordpress
# with this repo's plugin linked in and activated, then serves it on http://localhost:8080.
# Needs PHP 8.1+ with pdo_sqlite, and git.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
W="$HERE/.wordpress"
mkdir -p "$W"
[ -d "$W/wp" ] || git clone -q --depth 1 --branch 6.8.3 https://github.com/WordPress/WordPress.git "$W/wp"
[ -d "$W/sqlite" ] || git clone -q --depth 1 --branch v2.2.15 https://github.com/WordPress/sqlite-database-integration.git "$W/sqlite"
rm -rf "$W/site" && cp -r "$W/wp" "$W/site"
P="$W/site/wp-content/plugins/sqlite-database-integration"
cp -r "$W/sqlite" "$P"
sed -e "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$P#" -e "s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" "$P/db.copy" > "$W/site/wp-content/db.php"
ln -s "$REPO/plugin/boxing-canada-portal" "$W/site/wp-content/plugins/boxing-canada-portal"
mkdir -p "$W/site/wp-content/database"
cat > "$W/site/wp-config.php" <<'CFG'
<?php
define( 'DB_NAME', 'wp' ); define( 'DB_USER', '' ); define( 'DB_PASSWORD', '' ); define( 'DB_HOST', '' );
define( 'DB_CHARSET', 'utf8mb4' ); define( 'DB_COLLATE', '' );
define( 'DB_DIR', __DIR__ . '/wp-content/database/' ); define( 'DB_FILE', 'wp.sqlite' );
foreach ( array( 'AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY', 'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT' ) as $k ) { define( $k, 'test-only-' . $k ); }
$table_prefix = 'wp_';
define( 'WP_DEBUG', true ); define( 'WP_DEBUG_LOG', __DIR__ . '/debug.log' ); define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_HOME', 'http://localhost:8080' ); define( 'WP_SITEURL', 'http://localhost:8080' );
if ( ! defined( 'ABSPATH' ) ) define( 'ABSPATH', __DIR__ . '/' );
require_once ABSPATH . 'wp-settings.php';
CFG
SITE="$W/site" php -r '
define( "WP_INSTALLING", true ); $_SERVER["HTTP_HOST"] = "localhost:8080"; $_SERVER["REQUEST_URI"] = "/";
require getenv( "SITE" ) . "/wp-config.php"; require_once ABSPATH . "wp-admin/includes/upgrade.php";
wp_install( "Boxing Canada Portal test", "admin", "admin@example.org", true, "", "adminpass123" );
update_option( "permalink_structure", "/%postname%/" );'
php "$HERE/wpcli.php" '$r = activate_plugin( "boxing-canada-portal/boxing-canada-portal.php" ); echo is_wp_error( $r ) ? $r->get_error_message() : "Plugin activated", "\n";'
echo "Test site ready. Serve it with:  php -S localhost:8080 -t $W/site $HERE/router.php"
echo "WordPress admin: admin / adminpass123. Portal demo accounts: password Password123!"
