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

	public static function init() {
		add_filter( 'pre_set_site_transient_update_plugins', array( __CLASS__, 'inject' ) );
		add_filter( 'plugins_api', array( __CLASS__, 'info' ), 20, 3 );
		add_filter( 'upgrader_pre_download', array( __CLASS__, 'download' ), 10, 3 );
		add_filter( 'auto_update_plugin', array( __CLASS__, 'auto' ), 10, 2 );
		add_action( 'upgrader_process_complete', array( __CLASS__, 'after_update' ), 10, 2 );
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
