<?php
/**
 * Tools › Boxing Canada Portal: settings, data, backups and administrator accounts.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_post_bcp_action', array( __CLASS__, 'handle' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( BCP_FILE ), array( __CLASS__, 'links' ) );
	}

	public static function links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'tools.php?page=bcp' ) ) . '">Settings</a>' );
		return $links;
	}

	public static function menu() {
		add_management_page( 'Boxing Canada Portal', 'Boxing Canada Portal', 'manage_options', 'bcp', array( __CLASS__, 'page' ) );
	}

	private static function seed_file() {
		return BCP_DIR . 'data/demo-seed.json';
	}

	/** Reference data for a portal with no members yet. */
	private static function empty_dataset() {
		$seed  = json_decode( file_get_contents( self::seed_file() ), true );
		$empty = array();
		foreach ( $seed as $k => $v ) {
			$empty[ $k ] = is_array( $v ) && array_keys( $v ) === range( 0, count( $v ) - 1 ) ? array() : $v;
		}
		$empty['programs']        = $seed['programs'];
		$empty['version']         = $seed['version'];
		$empty['nccp']            = array( 'records' => array(), 'imports' => array() );
		$empty['logos']           = array();
		$empty['membershipLinks'] = array();
		$empty['safeSport']       = array();
		// Organization pages keep their structure, without the demo people.
		$orgs = array();
		foreach ( (array) $seed['orgProfiles'] as $k => $o ) {
			$orgs[ $k ] = array_merge( (array) $o, array( 'people' => array() ) );
		}
		$empty['orgProfiles'] = $orgs;
		return $empty;
	}

	public static function handle() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'bcp_action' );
		$do  = isset( $_POST['do'] ) ? sanitize_key( $_POST['do'] ) : '';
		$msg = '';
		switch ( $do ) {
			case 'settings':
				$page_id = isset( $_POST['page_id'] ) ? (int) $_POST['page_id'] : 0;
				BCP_Plugin::update_settings(
					array(
						'test_mode'   => empty( $_POST['test_mode'] ) ? 0 : 1,
						'send_emails' => empty( $_POST['send_emails'] ) ? 0 : 1,
						'from_name'   => sanitize_text_field( wp_unslash( isset( $_POST['from_name'] ) ? $_POST['from_name'] : 'Boxing Canada' ) ),
						'page_id'     => $page_id,
					)
				);
				if ( ! empty( $_POST['front_page'] ) && $page_id ) {
					update_option( 'show_on_front', 'page' );
					update_option( 'page_on_front', $page_id );
				}
				$msg = 'Settings saved.';
				break;

			case 'demo':
				if ( empty( $_POST['confirm'] ) ) {
					$msg = 'Tick the confirmation box to replace all portal data.';
					break;
				}
				BCP_Accounts::delete_demo_logins();
				BCP_Store::wipe();
				BCP_Store::import_dataset( json_decode( file_get_contents( self::seed_file() ), true ) );
				$n = BCP_Accounts::create_demo_logins();
				BCP_Plugin::update_settings( array( 'test_mode' => 1 ) );
				$msg = "Demo data loaded (fictional people only). $n demo sign-in accounts use the password " . BCP_DEMO_PASSWORD . '. Test mode is on.';
				break;

			case 'empty':
				if ( empty( $_POST['confirm'] ) ) {
					$msg = 'Tick the confirmation box to replace all portal data.';
					break;
				}
				BCP_Accounts::delete_demo_logins();
				BCP_Store::wipe();
				BCP_Store::import_dataset( self::empty_dataset() );
				$msg = 'The portal is now empty, apart from reference data such as the certification pathways. Next, link your WordPress account as an NSO Administrator below.';
				break;

			case 'export':
				$data = BCP_Store::export_dataset();
				nocache_headers();
				header( 'Content-Type: application/json; charset=utf-8' );
				header( 'Content-Disposition: attachment; filename="boxing-canada-portal-backup-' . gmdate( 'Y-m-d-His' ) . '.json"' );
				echo wp_json_encode( $data );
				exit;

			case 'import':
				if ( empty( $_POST['confirm'] ) || empty( $_FILES['backup']['tmp_name'] ) ) {
					$msg = 'Choose a backup file and tick the confirmation box.';
					break;
				}
				$data = json_decode( file_get_contents( $_FILES['backup']['tmp_name'] ), true );
				if ( ! is_array( $data ) || empty( $data['users'] ) || ! isset( $data['version'] ) ) {
					$msg = 'That file isn’t a Boxing Canada portal backup.';
					break;
				}
				BCP_Store::wipe();
				BCP_Store::import_dataset( $data );
				$msg = 'Backup restored. Existing WordPress sign-in accounts stay linked to their members.';
				break;

			case 'update_now':
				$log = BCP_Updater::self_update( true );
				$msg = ! $log ? 'Nothing to install: you have the latest version (' . BCP_VERSION . '), or updates are blocked (see Updates below).' : ( $log['ok'] ? "Updated to {$log['to']}." : "The update failed: {$log['message']}" );
				break;

			case 'updates':
				$was = BCP_Plugin::settings();
				BCP_Plugin::update_settings( array( 'auto_update' => empty( $_POST['auto_update'] ) ? 0 : 1, 'update_prereleases' => empty( $_POST['update_prereleases'] ) ? 0 : 1 ) );
				if ( ! empty( $_POST['check_now'] ) || (int) $was['update_prereleases'] !== ( empty( $_POST['update_prereleases'] ) ? 0 : 1 ) ) {
					$r   = BCP_Updater::check_now();
					$st  = BCP_Updater::status();
					$msg = $st['error'] ? 'Couldn’t check GitHub: ' . $st['error'] : ( $r && version_compare( $r['version'], BCP_VERSION, '>' ) ? "Version {$r['version']} is available. " . ( ! empty( $_POST['auto_update'] ) ? 'It will install automatically within 12 hours, or install it now under Dashboard › Updates.' : 'Install it under Dashboard › Updates.' ) : 'You have the latest version (' . BCP_VERSION . ').' );
				} else {
					$msg = 'Update settings saved.';
				}
				break;

			case 'link_me':
				$me  = wp_get_current_user();
				$doc = BCP_Accounts::portal_user_for_wp( $me->ID );
				if ( $doc ) {
					$msg = 'Your account is already linked to ' . $doc['membershipId'] . '.';
					break;
				}
				$id  = 'u-' . strtolower( wp_generate_password( 8, false ) );
				$doc = array(
					'id'               => $id,
					'firstName'        => sanitize_text_field( wp_unslash( $_POST['first'] ) ),
					'lastName'         => sanitize_text_field( wp_unslash( $_POST['last'] ) ),
					'role'             => 'nsoadmin',
					'gender'           => 'M',
					'dob'              => '',
					'province'         => sanitize_text_field( wp_unslash( $_POST['province'] ) ),
					'email'            => $me->user_email,
					'membershipId'     => BCP_Accounts::new_membership_id( 'nsoadmin' ),
					'status'           => 'approved',
					'selectedCoachIds' => array(),
					'club'             => '',
					'certs'            => (object) array(),
					'evaluatorPrograms' => array(),
					'_o'               => count( BCP_Store::all( 's_users' ) ),
				);
				BCP_Store::put( 's_users', $id, $doc );
				update_user_meta( $me->ID, 'bcp_user_id', $id );
				$msg = 'You’re now an NSO Administrator in the portal (' . $doc['membershipId'] . '). Open the portal to continue.';
				break;

			case 'link_user':
				$wp  = get_user_by( 'email', sanitize_email( wp_unslash( $_POST['wp_email'] ) ) );
				$doc = BCP_Accounts::find_member( sanitize_text_field( wp_unslash( $_POST['member'] ) ) );
				if ( ! $wp || ! $doc ) {
					$msg = 'Couldn’t find that WordPress user or portal member.';
					break;
				}
				update_user_meta( $wp->ID, 'bcp_user_id', $doc['id'] );
				$msg = "Linked {$wp->user_email} to {$doc['firstName']} {$doc['lastName']} ({$doc['membershipId']}).";
				break;
		}
		wp_safe_redirect( add_query_arg( array( 'page' => 'bcp', 'bcp_msg' => rawurlencode( $msg ) ), admin_url( 'tools.php' ) ) );
		exit;
	}

	public static function page() {
		$s     = BCP_Plugin::settings();
		$count = BCP_Store::count();
		$me    = BCP_Accounts::portal_user_for_wp( get_current_user_id() );
		$url   = BCP_REST::portal_url();
		$msg   = isset( $_GET['bcp_msg'] ) ? sanitize_text_field( wp_unslash( $_GET['bcp_msg'] ) ) : '';
		$form  = function ( $do, $inner, $button, $class = 'button button-primary', $multipart = false ) {
			echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"' . ( $multipart ? ' enctype="multipart/form-data"' : '' ) . '>';
			wp_nonce_field( 'bcp_action' );
			echo '<input type="hidden" name="action" value="bcp_action"><input type="hidden" name="do" value="' . esc_attr( $do ) . '">';
			echo $inner; // phpcs:ignore WordPress.Security.EscapeOutput -- built from escaped parts below.
			echo '<p><button class="' . esc_attr( $class ) . '">' . esc_html( $button ) . '</button></p></form>';
		};
		$provinces = array( 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT' );
		?>
		<div class="wrap">
			<h1>Boxing Canada Portal</h1>
			<?php if ( $msg ) : ?><div class="notice notice-info"><p><?php echo esc_html( $msg ); ?></p></div><?php endif; ?>
			<p>
				<a class="button button-primary" href="<?php echo esc_url( $url ); ?>" target="_blank">Open the portal</a>
				&nbsp; <?php echo esc_html( number_format_i18n( $count ) ); ?> records stored.
				<?php if ( $s['test_mode'] ) : ?><strong style="color:#b32d2e">&nbsp; Test mode is on: fictional data only.</strong><?php endif; ?>
			</p>

			<h2>Settings</h2>
			<?php
			$pages = get_pages();
			$opts  = '';
			foreach ( $pages as $p ) {
				$opts .= '<option value="' . (int) $p->ID . '"' . selected( $s['page_id'], $p->ID, false ) . '>' . esc_html( $p->post_title ) . '</option>';
			}
			$form(
				'settings',
				'<table class="form-table"><tr><th>Portal page</th><td><select name="page_id">' . $opts . '</select><p><label><input type="checkbox" name="front_page" value="1"' . checked( (int) get_option( 'page_on_front' ), (int) $s['page_id'], false ) . '> Make it this site’s home page (recommended for portal.boxingcanada.org)</label></p></td></tr>'
				. '<tr><th>Test mode</th><td><label><input type="checkbox" name="test_mode" value="1"' . checked( $s['test_mode'], 1, false ) . '> Show demo sign-in cards and quick role switching, and use the demo date (' . esc_html( BCP_DEMO_DATE ) . ')</label><p class="description">Turn off before real members use the portal. With test mode off, the portal uses today’s date.</p></td></tr>'
				. '<tr><th>Email</th><td><label><input type="checkbox" name="send_emails" value="1"' . checked( $s['send_emails'], 1, false ) . '> Send portal emails (account activation, parent/guardian links)</label><p class="description">Emails go only to the member concerned or their parent/guardian. Use an email-delivery plugin (SMTP) for reliable delivery. Leave off while testing with fictional people.</p>'
				. '<p>Sender name <input type="text" name="from_name" value="' . esc_attr( $s['from_name'] ) . '"></p></td></tr></table>',
				'Save settings'
			);
			?>

			<h2>Updates</h2>
			<?php
			$st  = BCP_Updater::status();
			$rel = $st['release'];
			$upd = '<p>Installed version: <strong>' . esc_html( BCP_VERSION ) . '</strong>. Updates come from the releases of <a href="https://github.com/' . esc_attr( BCP_Updater::REPO ) . '/releases" target="_blank">' . esc_html( BCP_Updater::REPO ) . '</a>.';
			if ( $st['checked'] ) {
				$upd .= ' Last checked ' . esc_html( human_time_diff( $st['checked'] ) ) . ' ago: ' . ( $st['error'] ? '<span style="color:#b32d2e">' . esc_html( $st['error'] ) . '</span>' : ( $rel ? 'latest release ' . esc_html( $rel['version'] ) . ( $rel['prerelease'] ? ' (pre-release)' : '' ) . ( version_compare( $rel['version'], BCP_VERSION, '>' ) ? ' <strong>is available</strong>' : '' ) : 'no releases yet' ) ) . '.';
			}
			$upd .= '</p><table class="form-table"><tr><th>Automatic updates</th><td><label><input type="checkbox" name="auto_update" value="1"' . checked( $s['auto_update'], 1, false ) . '> Install new releases automatically</label><p class="description">WordPress checks twice a day and installs in the background. Portal data is kept; any data changes in a release run on the next page load. Take a backup before major releases.</p></td></tr>'
				. '<tr><th>Pre-releases</th><td><label><input type="checkbox" name="update_prereleases" value="1"' . checked( $s['update_prereleases'], 1, false ) . '> Also install pre-releases (for a test site, not portal.boxingcanada.org)</label></td></tr>'
				. '<tr><th></th><td><label><input type="checkbox" name="check_now" value="1" checked> Check GitHub now</label></td></tr></table>';
			$diag = '<ul style="margin:0 0 1em">';
			foreach ( BCP_Updater::diagnostics() as $d ) {
				$diag .= '<li>' . array( 'ok' => '✅', 'warn' => '⚠️', 'bad' => '❌' )[ $d[0] ] . ' ' . esc_html( $d[1] ) . '</li>';
			}
			echo '<h3>How updates install on this site</h3>' . $diag . '</ul>'; // phpcs:ignore WordPress.Security.EscapeOutput -- built from escaped parts.
			if ( $rel && version_compare( $rel['version'], BCP_VERSION, '>' ) ) {
				$form( 'update_now', '<p>Version <strong>' . esc_html( $rel['version'] ) . '</strong> is available.</p>', 'Update now' );
			}
			$form( 'updates', $upd, 'Save update settings' );
			?>

			<h2>Your administrator account</h2>
			<?php if ( $me ) : ?>
				<p>Your WordPress account is linked to <strong><?php echo esc_html( $me['firstName'] . ' ' . $me['lastName'] ); ?></strong> (<?php echo esc_html( $me['membershipId'] ); ?>, <?php echo esc_html( $me['role'] ); ?>).</p>
			<?php else : ?>
				<p>Your WordPress account isn’t linked to a portal member yet. Create an NSO Administrator member for yourself:</p>
				<?php
				$po = '';
				foreach ( $provinces as $p ) {
					$po .= '<option' . selected( 'ON', $p, false ) . '>' . esc_html( $p ) . '</option>';
				}
				$u = wp_get_current_user();
				$form( 'link_me', '<p><input name="first" placeholder="First name" value="' . esc_attr( $u->first_name ) . '" required> <input name="last" placeholder="Last name" value="' . esc_attr( $u->last_name ) . '" required> <select name="province">' . $po . '</select></p>', 'Make me an NSO Administrator' );
				?>
			<?php endif; ?>
			<h3>Link another WordPress user to a member</h3>
			<?php $form( 'link_user', '<p><input name="wp_email" type="email" placeholder="WordPress user’s email" required> <input name="member" placeholder="Membership ID or member email" required></p>', 'Link', 'button' ); ?>

			<h2>Data</h2>
			<p>Download a backup before any change below. Backups contain personal and medical information: store them securely.</p>
			<?php $form( 'export', '', 'Download backup (JSON)', 'button' ); ?>
			<table class="widefat" style="max-width:900px"><tbody>
				<tr><td style="width:50%"><strong>Load demo data</strong><br>Replaces everything with the fictional demo data and creates demo sign-in accounts (password <?php echo esc_html( BCP_DEMO_PASSWORD ); ?>).
					<?php $form( 'demo', '<label><input type="checkbox" name="confirm" value="1"> Yes, replace all portal data</label>', 'Load demo data', 'button' ); ?></td>
				<td><strong>Start with an empty portal</strong><br>Deletes all members and records, keeping reference data such as the certification pathways. Use this before going live.
					<?php $form( 'empty', '<label><input type="checkbox" name="confirm" value="1"> Yes, delete all portal data</label>', 'Empty the portal', 'button' ); ?></td></tr>
				<tr><td colspan="2"><strong>Restore a backup</strong><br>
					<?php $form( 'import', '<input type="file" name="backup" accept="application/json,.json"> <label><input type="checkbox" name="confirm" value="1"> Yes, replace all portal data</label>', 'Restore backup', 'button', true ); ?></td></tr>
			</tbody></table>
		</div>
		<?php
	}
}
