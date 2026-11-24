<?php
/**
 * Record storage.
 *
 * The portal keeps each record (a member, an event, a medical, and so on) as a
 * JSON document in one table, keyed by collection and id. Every change gets a
 * new revision number so browsers can fetch only what changed since they last
 * looked. Deleted records leave a tombstone so other browsers learn about them.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_Store {

	/** Per-request cache of decoded collections. */
	private static $cache = array();

	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'bcp_records';
	}

	public static function seq_table() {
		global $wpdb;
		return $wpdb->prefix . 'bcp_seq';
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();
		$t       = self::table();
		$q       = self::seq_table();
		dbDelta(
			"CREATE TABLE $t (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				coll varchar(40) NOT NULL,
				doc_id varchar(190) NOT NULL,
				data longtext NULL,
				rev bigint(20) unsigned NOT NULL DEFAULT 0,
				deleted tinyint(1) NOT NULL DEFAULT 0,
				updated_at datetime NOT NULL,
				updated_by bigint(20) unsigned NOT NULL DEFAULT 0,
				PRIMARY KEY  (id),
				UNIQUE KEY coll_doc (coll,doc_id),
				KEY rev (rev)
			) $charset;"
		);
		dbDelta(
			"CREATE TABLE $q (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				PRIMARY KEY  (id)
			) $charset;"
		);
		update_option( 'bcp_db_version', BCP_DB_VERSION );
	}

	/** Next revision number. */
	public static function next_rev() {
		global $wpdb;
		$wpdb->query( 'INSERT INTO ' . self::seq_table() . ' (id) VALUES (NULL)' );
		return (int) $wpdb->insert_id;
	}

	public static function current_rev() {
		global $wpdb;
		return (int) $wpdb->get_var( 'SELECT MAX(rev) FROM ' . self::table() );
	}

	/** Rows changed after $since (all rows when $since is 0). */
	public static function changed_since( $since ) {
		global $wpdb;
		$t = self::table();
		if ( $since > 0 ) {
			return $wpdb->get_results( $wpdb->prepare( "SELECT coll, doc_id, data, rev, deleted FROM $t WHERE rev > %d ORDER BY rev", $since ), ARRAY_A );
		}
		return $wpdb->get_results( "SELECT coll, doc_id, data, rev, deleted FROM $t WHERE deleted = 0 ORDER BY rev", ARRAY_A );
	}

	public static function get( $coll, $doc_id ) {
		global $wpdb;
		$t   = self::table();
		$raw = $wpdb->get_var( $wpdb->prepare( "SELECT data FROM $t WHERE coll = %s AND doc_id = %s AND deleted = 0", $coll, $doc_id ) );
		return null === $raw ? null : json_decode( $raw, true );
	}

	/** All live documents in a collection, keyed by id (cached for the request). */
	public static function all( $coll ) {
		global $wpdb;
		if ( isset( self::$cache[ $coll ] ) ) {
			return self::$cache[ $coll ];
		}
		$t    = self::table();
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT doc_id, data FROM $t WHERE coll = %s AND deleted = 0", $coll ), ARRAY_A );
		$out  = array();
		foreach ( $rows as $r ) {
			$out[ $r['doc_id'] ] = json_decode( $r['data'], true );
		}
		self::$cache[ $coll ] = $out;
		return $out;
	}

	/** Find the first document in a collection matching a callback. */
	public static function find( $coll, $fn ) {
		foreach ( self::all( $coll ) as $id => $doc ) {
			if ( is_array( $doc ) && $fn( $doc ) ) {
				return $doc;
			}
		}
		return null;
	}

	/**
	 * Create, replace or delete (null) a document.
	 *
	 * @return int The new revision.
	 */
	public static function put( $coll, $doc_id, $data, $user_id = 0 ) {
		global $wpdb;
		$t    = self::table();
		$rev  = self::next_rev();
		$now  = current_time( 'mysql', true );
		$json = null === $data ? null : wp_json_encode( $data );
		$id   = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $t WHERE coll = %s AND doc_id = %s", $coll, $doc_id ) );
		$row  = array(
			'data'       => $json,
			'rev'        => $rev,
			'deleted'    => null === $data ? 1 : 0,
			'updated_at' => $now,
			'updated_by' => (int) $user_id,
		);
		if ( $id ) {
			$wpdb->update( $t, $row, array( 'id' => $id ) );
		} elseif ( null !== $data ) {
			$wpdb->insert( $t, array_merge( array( 'coll' => $coll, 'doc_id' => $doc_id ), $row ) );
		}
		unset( self::$cache[ $coll ] );
		return $rev;
	}

	public static function count() {
		global $wpdb;
		return (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::table() . ' WHERE deleted = 0' );
	}

	public static function wipe() {
		global $wpdb;
		$wpdb->query( 'DELETE FROM ' . self::table() );
		$wpdb->query( 'DELETE FROM ' . self::seq_table() );
		self::$cache = array();
	}

	/** Same id rules as the portal's browser code, so both sides agree on ids. */
	public static function safe_id( $id, $i = 0 ) {
		$s = substr( preg_replace( '/[^A-Za-z0-9_\-.~:@+]/', '_', (string) ( null === $id ? 'i' . $i : $id ) ), 0, 180 );
		return ( '' === $s || '.' === $s || '..' === $s ) ? 'i' . $i : $s;
	}

	/**
	 * Load a whole portal data set (as exported from the portal) into the table.
	 * Passwords are never stored here: sign-in is handled by WordPress accounts.
	 */
	public static function import_dataset( $d ) {
		$meta_keys = array( 'version', 'membershipLinks', 'orgProfiles', 'safeSport' );
		foreach ( $d as $key => $value ) {
			if ( is_array( $value ) && array_keys( $value ) === range( 0, count( $value ) - 1 ) ) {
				foreach ( $value as $i => $item ) {
					if ( 'users' === $key ) {
						unset( $item['password'] );
					}
					$item['_o'] = $i;
					self::put( 's_' . $key, self::safe_id( isset( $item['id'] ) ? $item['id'] : null, $i ), $item );
				}
			} elseif ( 'nccp' === $key && is_array( $value ) ) {
				$records = isset( $value['records'] ) ? $value['records'] : array();
				foreach ( $records as $no => $rec ) {
					self::put( 's_nccp', self::safe_id( $no ), $rec );
				}
				unset( $value['records'] );
				self::put( 'meta', 'nccp', array( 'v' => $value ) );
			} elseif ( 'logos' === $key && is_array( $value ) ) {
				foreach ( $value as $prov => $logo ) {
					self::put( 's_logos', self::safe_id( $prov ), is_array( $logo ) ? $logo : array( 'v' => $logo ) );
				}
			} elseif ( in_array( $key, $meta_keys, true ) || ! is_array( $value ) ) {
				self::put( 'meta', $key, array( 'v' => $value ) );
			}
		}
		self::$cache = array();
	}

	/** Rebuild a portal data set from the table (used for backups). */
	public static function export_dataset() {
		global $wpdb;
		$rows = $wpdb->get_results( 'SELECT coll, doc_id, data FROM ' . self::table() . ' WHERE deleted = 0', ARRAY_A );
		$out  = array( 'nccp' => array( 'records' => array() ), 'logos' => array() );
		$ord  = array();
		foreach ( $rows as $r ) {
			$doc = json_decode( $r['data'], true );
			if ( 'meta' === $r['coll'] ) {
				if ( 'nccp' === $r['doc_id'] ) {
					$out['nccp'] = array_merge( (array) ( isset( $doc['v'] ) ? $doc['v'] : array() ), array( 'records' => $out['nccp']['records'] ) );
				} else {
					$out[ $r['doc_id'] ] = isset( $doc['v'] ) ? $doc['v'] : null;
				}
			} elseif ( 's_nccp' === $r['coll'] ) {
				$out['nccp']['records'][ isset( $doc['no'] ) ? $doc['no'] : $r['doc_id'] ] = $doc;
			} elseif ( 's_logos' === $r['coll'] ) {
				$out['logos'][ $r['doc_id'] ] = $doc;
			} elseif ( 0 === strpos( $r['coll'], 's_' ) ) {
				$key = substr( $r['coll'], 2 );
				$o   = isset( $doc['_o'] ) ? $doc['_o'] : 0;
				unset( $doc['_o'] );
				$ord[ $key ][] = array( $o, $doc );
			}
		}
		foreach ( $ord as $key => $items ) {
			usort( $items, function ( $a, $b ) { return $a[0] <=> $b[0]; } );
			$out[ $key ] = array_map( function ( $x ) { return $x[1]; }, $items );
		}
		return $out;
	}

	/** Daily: trim old revision counters and tombstones. */
	public static function daily_maintenance() {
		global $wpdb;
		$max = self::current_rev();
		$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . self::seq_table() . ' WHERE id < %d', max( 0, $max - 1000 ) ) );
		$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . self::table() . ' WHERE deleted = 1 AND updated_at < %s', gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS ) ) );
	}
}
