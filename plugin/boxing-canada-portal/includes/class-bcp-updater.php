<?php
/**
 * Updates from GitHub.
 *
 * WordPress normally gets plugin updates from wordpress.org. This plugin gets
 * them from the releases of its GitHub repository instead: each release
 * (tag vX.Y.Z) carries a boxing-canada-portal.zip built by the repository's
 * release workflow. The portal shows the update under Dashboard › Updates and
 * Plugins like any other, and installs it automatically when "Install updates
 * automatically" is on (Tools › Boxing Canada Portal).
 *
 * - Stable sites follow the latest full release; a test site can also follow
 *   pre-releases (tags such as v0.3.0-beta.1).
 * - Managed hosts often switch WordPress's background updater off. When they
 *   do, the plugin installs its own releases from a twice-daily scheduled
 *   task (bcp_self_update), using WordPress's plugin upgrader and the same
 *   lock as WordPress, so the two never run at once. The settings screen
 *   shows what, if anything, blocks updates on the site.
 * - Public repository: no credentials needed. Private repository: define
 *   BCP_GITHUB_TOKEN in wp-config.php (a fine-grained token with read-only
 *   access to the repository's contents).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_Updater {

	const REPO      = 'BoxingCanadaAdmin/boxing_canada_portal';
	const ASSET     = 'boxing-canada-portal.zip';
	const CACHE     = 'bcp_github_release';
	const CACHE_TTL = 21600; // 6 hours.
	const HOOK      = 'bcp_self_update';
	const LOG       = 'bcp_self_update_log';

	public static function init() {
		add_filter( 'pre_set_site_transient_update_plugins', array( __CLASS__, 'inject' ) );
		add_filter( 'plugins_api', array( __CLASS__, 'info' ), 20, 3 );
		add_filter( 'upgrader_pre_download', array( __CLASS__, 'download' ), 10, 3 );
		add_filter( 'auto_update_plugin', array( __CLASS__, 'auto' ), 10, 2 );
		add_action( 'upgrader_process_complete', array( __CLASS__, 'after_update' ), 10, 2 );
		add_action( self::HOOK, array( __CLASS__, 'self_update' ) );
		add_action( 'init', array( __CLASS__, 'schedule' ) );
		add_filter( 'plugin_row_meta', array( __CLASS__, 'row_links' ), 10, 2 );
		add_action( 'admin_post_bcp_updates', array( __CLASS__, 'row_action' ) );
	}

	/** "Check for updates | Auto-update: on (Turn off)" on the Plugins screen. */
	public static function row_links( $links, $file ) {
		if ( self::basename() !== $file || ! current_user_can( 'update_plugins' ) ) {
			return $links;
		}
		$s   = BCP_Plugin::settings();
		$on  = ! empty( $s['auto_update'] );
		$url = function ( $do ) {
			return wp_nonce_url( admin_url( 'admin-post.php?action=bcp_updates&do=' . $do ), 'bcp_updates' );
		};
		$links[] = '<a href="' . esc_url( $url( 'check' ) ) . '">Check for updates</a>';
		$links[] = $on
			? '<span style="color:#1d7a3a;font-weight:600">Auto-update: on</span> (<a href="' . esc_url( $url( 'auto_off' ) ) . '">Turn off</a>)'
			: '<span style="font-weight:600">Auto-update: off</span> (<a href="' . esc_url( $url( 'auto_on' ) ) . '">Turn on</a>)';
		return $links;
	}

	public static function row_action() {
		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'bcp_updates' );
		$do = isset( $_GET['do'] ) ? sanitize_key( $_GET['do'] ) : '';
		if ( 'auto_on' === $do || 'auto_off' === $do ) {
			BCP_Plugin::update_settings( array( 'auto_update' => 'auto_on' === $do ? 1 : 0 ) );
		} else {
			self::check_now();
		}
		wp_safe_redirect( admin_url( 'plugins.php' ) );
		exit;
	}

	public static function schedule() {
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + 15 * MINUTE_IN_SECONDS, 'twicedaily', self::HOOK );
		}
	}

	private static function load_admin() {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/misc.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
	}

	/** Is WordPress's own background updater able to update this plugin? */
	private static function core_can_auto_update() {
		self::load_admin();
		$u = new WP_Automatic_Updater();
		if ( $u->is_disabled() || $u->is_vcs_checkout( WP_PLUGIN_DIR ) ) {
			return false;
		}
		$item = (object) array( 'plugin' => self::basename(), 'slug' => 'boxing-canada-portal', 'new_version' => '999', 'package' => '' );
		return (bool) apply_filters( 'auto_update_plugin', false, $item );
	}

	/**
	 * What decides whether updates install on this site.
	 *
	 * @return array[] Each: [ state ok|warn|bad, text ].
	 */
	public static function diagnostics() {
		self::load_admin();
		$s   = BCP_Plugin::settings();
		$out = array();
		if ( ! wp_is_file_mod_allowed( 'automatic_updater' ) ) {
			$out[] = array( 'bad', 'This site blocks all plugin installs and updates (DISALLOW_FILE_MODS or the host’s settings). Updates can’t install, automatically or by hand. Ask your host to allow plugin updates.' );
			return $out;
		}
		$fs = get_filesystem_method( array(), WP_PLUGIN_DIR );
		$out[] = 'direct' === $fs ? array( 'ok', 'WordPress can write plugin files directly.' ) : array( 'bad', 'WordPress needs FTP details to change plugin files (“' . $fs . '”), so updates can’t install in the background. Ask your host to set FS_METHOD to direct.' );
		if ( empty( $s['auto_update'] ) ) {
			$out[] = array( 'warn', 'Automatic updates are off in these settings: updates install only when you click Update.' );
		} elseif ( self::core_can_auto_update() ) {
			$out[] = array( 'ok', 'WordPress’s background updater will install portal releases.' );
		} else {
			$out[] = array( 'ok', 'WordPress’s background updater is switched off on this site (common on managed hosting), so the portal installs its own releases twice a day.' );
		}
		if ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ) {
			$out[] = array( 'warn', 'WP-Cron is triggered by the host rather than by visits (DISABLE_WP_CRON). Most managed hosts run it every few minutes; if updates never arrive, ask your host whether wp-cron.php runs on a schedule.' );
		}
		$next = wp_next_scheduled( self::HOOK );
		if ( ! empty( $s['auto_update'] ) && $next ) {
			$out[] = array( 'ok', 'Next update check by the portal: ' . human_time_diff( $next ) . ( $next > time() ? ' from now.' : ' ago (waiting for WP-Cron to run).' ) );
		}
		$log = get_option( self::LOG );
		if ( is_array( $log ) ) {
			$out[] = array( $log['ok'] ? 'ok' : 'bad', ( $log['ok'] ? 'Last automatic update: ' : 'Last automatic update failed: ' ) . $log['from'] . ' → ' . $log['to'] . ', ' . human_time_diff( $log['at'] ) . ' ago' . ( $log['ok'] ? '.' : ': ' . $log['message'] ) );
		}
		return $out;
	}

	/**
	 * Install a newer release without WordPress's background updater.
	 * Runs from the scheduled task when automatic updates are on and WordPress
	 * won't do it, or straight away from "Update now" on the settings screen.
	 *
	 * @return array|null What happened, or null when there was nothing to do.
	 */
	public static function self_update( $manual = false ) {
		$s = BCP_Plugin::settings();
		if ( ! $manual && ( empty( $s['auto_update'] ) || self::core_can_auto_update() ) ) {
			return null;
		}
		self::load_admin();
		$r = self::latest( (bool) $manual );
		if ( ! $r || ! version_compare( $r['version'], BCP_VERSION, '>' ) || ! wp_is_file_mod_allowed( 'automatic_updater' ) ) {
			return null;
		}
		$log = array( 'at' => time(), 'from' => BCP_VERSION, 'to' => $r['version'], 'ok' => false, 'message' => '' );
		if ( 'direct' !== get_filesystem_method( array(), WP_PLUGIN_DIR ) ) {
			$log['message'] = 'WordPress can’t write plugin files without FTP details.';
		} elseif ( ! WP_Upgrader::create_lock( 'auto_updater', HOUR_IN_SECONDS ) ) {
			return null; // WordPress or another request is updating right now.
		} else {
			// Make sure WordPress's list of updates includes this release.
			set_site_transient( 'update_plugins', get_site_transient( 'update_plugins' ) ?: new stdClass() );
			$was_active = is_plugin_active( self::basename() );
			$up  = new Plugin_Upgrader( new Automatic_Upgrader_Skin() );
			$res = $up->upgrade( self::basename() );
			if ( $was_active && ! is_plugin_active( self::basename() ) ) {
				activate_plugin( self::basename(), '', false, true );
			}
			WP_Upgrader::release_lock( 'auto_updater' );
			$log['ok']      = true === $res;
			$log['message'] = is_wp_error( $res ) ? $res->get_error_message() : ( true === $res ? '' : wp_strip_all_tags( implode( ' ', (array) $up->skin->get_upgrade_messages() ) ) );
		}
		update_option( self::LOG, $log, false );
		BCP_REST::notify( 'role:nsoadmin', $log['ok'] ? "The portal was updated from {$log['from']} to {$log['to']}." : "The portal couldn’t update itself to {$log['to']}: {$log['message']} Update it under Dashboard › Updates.", 'DASHBOARD' );
		return $log;
	}

	private static function basename() {
		return plugin_basename( BCP_FILE );
	}

	private static function token() {
		return defined( 'BCP_GITHUB_TOKEN' ) && BCP_GITHUB_TOKEN ? (string) BCP_GITHUB_TOKEN : '';
	}

	private static function api( $path, $args = array() ) {
		$headers = array( 'Accept' => 'application/vnd.github+json', 'User-Agent' => 'boxing-canada-portal/' . BCP_VERSION, 'X-GitHub-Api-Version' => '2022-11-28' );
		if ( self::token() ) {
			$headers['Authorization'] = 'Bearer ' . self::token();
		}
		return wp_remote_get( 'https://api.github.com/repos/' . self::REPO . $path, array_merge( array( 'timeout' => 15, 'headers' => $headers ), $args ) );
	}

	/** "v0.3.0" → "0.3.0". */
	private static function version_of( $tag ) {
		return ltrim( (string) $tag, 'vV' );
	}

	/**
	 * The newest release that has the plugin zip attached (cached).
	 *
	 * @return array|null { version, tag, url, asset_api, asset_url, notes, published, prerelease }
	 */
	public static function latest( $force = false ) {
		$cached = get_site_transient( self::CACHE );
		if ( ! $force && is_array( $cached ) ) {
			return $cached['release'];
		}
		$s     = BCP_Plugin::settings();
		$pre   = ! empty( $s['update_prereleases'] );
		$res   = self::api( '/releases?per_page=20' );
		$error = '';
		$best  = null;
		if ( is_wp_error( $res ) ) {
			$error = $res->get_error_message();
		} elseif ( 200 !== (int) wp_remote_retrieve_response_code( $res ) ) {
			$error = 'GitHub answered ' . wp_remote_retrieve_response_code( $res ) . ( 404 === (int) wp_remote_retrieve_response_code( $res ) ? ' (if the repository is private, define BCP_GITHUB_TOKEN in wp-config.php)' : '' );
		} else {
			foreach ( (array) json_decode( wp_remote_retrieve_body( $res ), true ) as $r ) {
				if ( ! empty( $r['draft'] ) || ( ! $pre && ! empty( $r['prerelease'] ) ) ) {
					continue;
				}
				$asset = null;
				foreach ( (array) $r['assets'] as $a ) {
					if ( self::ASSET === $a['name'] ) {
						$asset = $a;
					}
				}
				$v = self::version_of( $r['tag_name'] );
				if ( ! $asset || ! preg_match( '/^\d+\.\d+\.\d+/', $v ) ) {
					continue;
				}
				if ( ! $best || version_compare( $v, $best['version'], '>' ) ) {
					$best = array(
						'version'    => $v,
						'tag'        => $r['tag_name'],
						'url'        => $r['html_url'],
						'asset_api'  => $asset['url'],
						'asset_url'  => $asset['browser_download_url'],
						'notes'      => (string) $r['body'],
						'published'  => $r['published_at'],
						'prerelease' => ! empty( $r['prerelease'] ),
					);
				}
			}
		}
		// After a failed check, try again in an hour rather than six.
		set_site_transient( self::CACHE, array( 'release' => $best, 'error' => $error, 'checked' => time() ), $error ? HOUR_IN_SECONDS : self::CACHE_TTL );
		return $best;
	}

	/** Last check, for the settings screen. */
	public static function status() {
		$c = get_site_transient( self::CACHE );
		return is_array( $c ) ? $c : array( 'release' => null, 'error' => '', 'checked' => 0 );
	}

	/** Offer the update to WordPress. */
	public static function inject( $transient ) {
		if ( ! is_object( $transient ) ) {
			$transient = new stdClass();
		}
		$r    = self::latest();
		$base = self::basename();
		$item = (object) array(
			'id'            => 'github.com/' . self::REPO,
			'slug'          => 'boxing-canada-portal',
			'plugin'        => $base,
			'new_version'   => $r ? $r['version'] : BCP_VERSION,
			'url'           => 'https://github.com/' . self::REPO,
			'package'       => $r ? self::package_url( $r ) : '',
			'icons'         => array( 'default' => BCP_URL . 'assets/img/icon.png' ),
			'tested'        => get_bloginfo( 'version' ),
			'requires_php'  => '7.4',
		);
		if ( $r && version_compare( $r['version'], BCP_VERSION, '>' ) ) {
			$transient->response[ $base ] = $item;
			unset( $transient->no_update[ $base ] );
		} else {
			// Listing it as up to date lets the "Enable auto-updates" link appear on the Plugins screen.
			$transient->no_update[ $base ] = $item;
			unset( $transient->response[ $base ] );
		}
		return $transient;
	}

	/** Public repositories download the asset directly; private ones go through the API (see download()). */
	private static function package_url( $r ) {
		return self::token() ? $r['asset_api'] : $r['asset_url'];
	}

	/** "View details" on the Plugins and Updates screens. */
	public static function info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || ! isset( $args->slug ) || 'boxing-canada-portal' !== $args->slug ) {
			return $result;
		}
		$r = self::latest();
		return (object) array(
			'name'          => 'Boxing Canada Portal',
			'slug'          => 'boxing-canada-portal',
			'version'       => $r ? $r['version'] : BCP_VERSION,
			'author'        => 'Boxing Canada',
			'homepage'      => 'https://github.com/' . self::REPO,
			'requires_php'  => '7.4',
			'last_updated'  => $r ? $r['published'] : '',
			'download_link' => $r ? self::package_url( $r ) : '',
			'sections'      => array(
				'changelog'   => $r ? '<h4>' . esc_html( $r['tag'] ) . '</h4>' . wpautop( esc_html( $r['notes'] ) ) . '<p><a href="' . esc_url( $r['url'] ) . '" target="_blank">See the release on GitHub</a></p>' : '<p>No releases yet.</p>',
				'description' => '<p>The Boxing Canada National Portal. Updates come from the GitHub releases of ' . esc_html( self::REPO ) . '.</p>',
			),
		);
	}

	/**
	 * Private repositories: GitHub answers the API asset URL with a redirect to a
	 * short-lived signed link, which must be fetched without the token.
	 */
	public static function download( $reply, $package, $upgrader ) {
		if ( ! self::token() || 0 !== strpos( (string) $package, 'https://api.github.com/repos/' . self::REPO . '/releases/assets/' ) ) {
			return $reply;
		}
		$res = wp_remote_get( $package, array( 'timeout' => 30, 'redirection' => 0, 'headers' => array( 'Accept' => 'application/octet-stream', 'Authorization' => 'Bearer ' . self::token(), 'User-Agent' => 'boxing-canada-portal/' . BCP_VERSION ) ) );
		$to  = is_wp_error( $res ) ? '' : wp_remote_retrieve_header( $res, 'location' );
		if ( ! $to ) {
			return new WP_Error( 'bcp_download', 'Couldn’t download the update from GitHub. Check BCP_GITHUB_TOKEN.' );
		}
		return download_url( $to, 300 );
	}

	/** Install updates of this plugin automatically when the setting is on. */
	public static function auto( $update, $item ) {
		if ( isset( $item->plugin ) && self::basename() === $item->plugin ) {
			$s = BCP_Plugin::settings();
			return ! empty( $s['auto_update'] ) ? true : $update;
		}
		return $update;
	}

	/** Forget the cached release after this plugin is updated, so the screens show the new state. */
	public static function after_update( $upgrader, $extra ) {
		if ( isset( $extra['type'], $extra['plugins'] ) && 'plugin' === $extra['type'] && in_array( self::basename(), (array) $extra['plugins'], true ) ) {
			delete_site_transient( self::CACHE );
			delete_site_transient( 'update_plugins' );
		}
	}

	/** "Check for updates now" on the settings screen. */
	public static function check_now() {
		delete_site_transient( self::CACHE );
		$r = self::latest( true );
		delete_site_transient( 'update_plugins' );
		wp_update_plugins();
		return $r;
	}
}
