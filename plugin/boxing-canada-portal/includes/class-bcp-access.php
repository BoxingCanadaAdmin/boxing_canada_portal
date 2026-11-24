<?php
/**
 * Access rules: who may read and change each kind of record.
 *
 * Every record leaves the server only after read() approves it, sometimes in a
 * reduced "status only" form (for example a club manager sees that a boxer's
 * Annual Medical is valid, not its clinical contents). Every change from a
 * browser passes through write() first. These rules mirror the portal's
 * screens, so the browser cannot be used to see or change more than its
 * screens allow.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class BCP_Access {

	const ADMIN_ROLES    = array( 'ptso', 'nsoadmin' );
	const CLINICAL       = array( 's_annualMedicals', 's_ringsideExams', 's_restPeriodExams' );
	const ADMIN_ONLY_COL = array( 's_programs', 's_nccp', 's_logos', 's_docs', 's_interests' );

	/** User fields only administrators can change. */
	const PROTECTED_USER_FIELDS = array( 'role', 'status', 'province', 'membershipId', 'nationalTeam', 'ntHistory', 'certs', 'certHistory', 'evaluatorPrograms', 'clubManagerOf', 'clubManagerSince', 'activation', 'trackie', 'trackieSyncedAt', 'classification', 'classHistory', 'testData', 'wpUserId', 'nccp' );

	/** Fields of a member visible to other members. */
	const PROFILE_FIELDS = array( 'id', 'firstName', 'lastName', 'honorific', 'role', 'gender', 'province', 'club', 'membershipId', 'status', 'classification', 'nationalTeam', 'certs', 'evaluatorPrograms', 'clubManagerOf', 'nccp', '_o' );

	/* ------------------------------------------------------------------
	 * Who is asking
	 * ------------------------------------------------------------------ */

	private static $ctx = null;

	/**
	 * The access context for this request.
	 * Roles: public, guardian, boxer, coach, official, medical, ptso, nsoadmin.
	 */
	public static function context( $guardian_code = '' ) {
		if ( null !== self::$ctx ) {
			return self::$ctx;
		}
		$c = array(
			'role'      => 'public',
			'id'        => null,
			'doc'       => null,
			'province'  => null,
			'coached'   => array(),
			'club'      => null,
			'clubBoxers' => array(),
			'events'    => array(),
			'evalFor'   => array(),
			'evalNccp'  => array(),
			'child'     => null,
			'code'      => null,
			'wp'        => get_current_user_id(),
		);
		$doc = BCP_Accounts::portal_user_for_wp( $c['wp'] );
		if ( $doc && 'approved' === ( isset( $doc['status'] ) ? $doc['status'] : '' ) ) {
			$c['role']     = $doc['role'];
			$c['id']       = $doc['id'];
			$c['doc']      = $doc;
			$c['province'] = isset( $doc['province'] ) ? $doc['province'] : null;
			foreach ( BCP_Store::all( 's_users' ) as $u ) {
				if ( ! is_array( $u ) ) {
					continue;
				}
				if ( 'boxer' === $u['role'] && in_array( $doc['id'], (array) ( isset( $u['selectedCoachIds'] ) ? $u['selectedCoachIds'] : array() ), true ) ) {
					$c['coached'][] = $u['id'];
				}
			}
			if ( ! empty( $doc['clubManagerOf'] ) && in_array( $doc['role'], array( 'coach', 'official' ), true ) ) {
				$c['club'] = $doc['clubManagerOf'];
				foreach ( BCP_Store::all( 's_users' ) as $u ) {
					if ( is_array( $u ) && 'boxer' === $u['role'] && isset( $u['club'] ) && $u['club'] === $c['club'] ) {
						$c['clubBoxers'][] = $u['id'];
					}
				}
			}
			foreach ( BCP_Store::all( 's_events' ) as $ev ) {
				$staff = array_merge( array_column( (array) ( isset( $ev['officials'] ) ? $ev['officials'] : array() ), 'userId' ), (array) ( isset( $ev['physicianIds'] ) ? $ev['physicianIds'] : array() ) );
				if ( in_array( $doc['id'], $staff, true ) ) {
					$c['events'][] = $ev['id'];
				}
			}
			foreach ( BCP_Store::all( 's_evalRequests' ) as $r ) {
				if ( isset( $r['assignedEvaluatorId'] ) && $r['assignedEvaluatorId'] === $doc['id'] ) {
					$c['evalFor'][] = $r['requesterId'];
					if ( ! empty( $r['nccp'] ) ) {
						$c['evalNccp'][] = (string) $r['nccp'];
					}
				}
			}
		} elseif ( $guardian_code ) {
			$g = self::guardian_code( $guardian_code );
			if ( $g ) {
				$c['role']  = 'guardian';
				$c['child'] = $g['boxerId'];
				$c['code']  = $g['code'];
			}
		}
		self::$ctx = $c;
		return $c;
	}

	public static function reset_context() {
		self::$ctx = null;
	}

	/** A key that changes whenever what this person may see changes. */
	public static function scope_key( $c ) {
		$doc = $c['doc'] ? $c['doc'] : array();
		return md5( wp_json_encode( array( $c['role'], $c['id'], $c['province'], $c['coached'], $c['club'], $c['clubBoxers'], $c['events'], $c['evalFor'], $c['evalNccp'], $c['child'], isset( $doc['nationalTeam'] ) ? $doc['nationalTeam'] : null ) ) );
	}

	public static function guardian_code( $code ) {
		$code = strtoupper( preg_replace( '/[^A-Za-z0-9]/', '', (string) $code ) );
		if ( '' === $code ) {
			return null;
		}
		$g = BCP_Store::find( 's_guardianCodes', function ( $x ) use ( $code ) { return isset( $x['code'] ) && strtoupper( $x['code'] ) === $code; } );
		if ( ! $g || strtotime( $g['expiresAt'] ) < time() ) {
			return null;
		}
		return $g;
	}

	/* ------------------------------------------------------------------
	 * Helpers
	 * ------------------------------------------------------------------ */

	public static function is_admin( $c ) {
		return in_array( $c['role'], self::ADMIN_ROLES, true );
	}

	private static function user( $id ) {
		$all = BCP_Store::all( 's_users' );
		$sid = BCP_Store::safe_id( $id );
		return isset( $all[ $sid ] ) ? $all[ $sid ] : null;
	}

	private static function province_of( $user_id ) {
		$u = self::user( $user_id );
		return $u && isset( $u['province'] ) ? $u['province'] : null;
	}

	/** Full clinical access to a boxer's records. */
	private static function clinical_full( $c, $boxer_id ) {
		if ( in_array( $c['role'], array( 'nsoadmin', 'medical' ), true ) ) {
			return true;
		}
		if ( 'ptso' === $c['role'] ) {
			return self::province_of( $boxer_id ) === $c['province'];
		}
		return $boxer_id === $c['id'] || in_array( $boxer_id, $c['coached'], true );
	}

	/** Status-only access (eligibility, readiness) to a boxer. */
	private static function status_access( $c, $boxer_id ) {
		if ( self::is_admin( $c ) ) {
			return true;
		}
		if ( in_array( $boxer_id, $c['clubBoxers'], true ) ) {
			return true;
		}
		if ( 'official' === $c['role'] ) {
			foreach ( BCP_Store::all( 's_events' ) as $ev ) {
				if ( in_array( $ev['id'], $c['events'], true ) && in_array( $boxer_id, (array) $ev['registeredBoxerIds'], true ) ) {
					return true;
				}
			}
		}
		return false;
	}

	private static function pick( $doc, $keys ) {
		return array_intersect_key( $doc, array_flip( $keys ) );
	}

	private static function profile( $u, $c ) {
		$p = self::pick( $u, self::PROFILE_FIELDS );
		if ( isset( $u['nationalTeam'] ) && is_array( $u['nationalTeam'] ) ) {
			$p['nationalTeam'] = self::pick( $u['nationalTeam'], array( 'level' ) );
		}
		// Coaches' NCCP level is shown to boxers choosing a coach.
		if ( 'coach' === $u['role'] && isset( $u['trackie'] ) && is_array( $u['trackie'] ) ) {
			$p['trackie'] = self::pick( $u['trackie'], array( 'COACH LEVEL', 'CLUB NAME' ) );
		}
		if ( isset( $u['trackieCoachLevel'] ) ) {
			$p['trackieCoachLevel'] = $u['trackieCoachLevel'];
		}
		// Coaches, officials and medical staff see boxers' dates of birth (age categories); other boxers don't.
		if ( 'boxer' === $u['role'] && in_array( $c['role'], array( 'coach', 'official', 'medical' ), true ) && isset( $u['dob'] ) ) {
			$p['dob'] = $u['dob'];
		}
		$p['selectedCoachIds'] = in_array( $c['role'], array( 'coach', 'official', 'medical' ), true ) && isset( $u['selectedCoachIds'] ) ? $u['selectedCoachIds'] : array();
		$p['_profile'] = true;
		return $p;
	}

	private static function strip_secrets( $u ) {
		unset( $u['password'] );
		return $u;
	}

	/* ------------------------------------------------------------------
	 * Reading
	 * ------------------------------------------------------------------ */

	/**
	 * What this person may see of a document: the document, a reduced copy, or null.
	 */
	public static function read( $coll, $doc_id, $d, $c ) {
		if ( ! is_array( $d ) ) {
			return null;
		}
		$role  = $c['role'];
		$admin = self::is_admin( $c );
		$me    = $c['id'];
		$authd = ! in_array( $role, array( 'public', 'guardian' ), true );

		switch ( $coll ) {
			case 'meta':
				if ( 'nccp' === $doc_id ) {
					return $authd ? $d : null;
				}
				return $d;

			case 's_logos':
				return $d;

			case 's_programs':
				return $authd ? $d : null;

			case 's_users':
				$d = self::strip_secrets( $d );
				if ( 'nsoadmin' === $role || 'ptso' === $role || 'medical' === $role || $d['id'] === $me ) {
					return $d;
				}
				if ( 'guardian' === $role ) {
					return $d['id'] === $c['child'] ? $d : ( 'coach' === $d['role'] ? self::profile( $d, $c ) : null );
				}
				if ( 'public' === $role ) {
					return null;
				}
				if ( in_array( $d['id'], $c['coached'], true ) ) {
					return $d;
				}
				if ( in_array( $d['id'], $c['evalFor'], true ) ) {
					return self::for_evaluator( $d, $c );
				}
				return self::profile( $d, $c );

			case 's_annualMedicals':
			case 's_ringsideExams':
			case 's_restPeriodExams':
				$bid = isset( $d['boxerId'] ) ? $d['boxerId'] : '';
				if ( $authd && self::clinical_full( $c, $bid ) ) {
					return $d;
				}
				if ( $authd && self::status_access( $c, $bid ) ) {
					if ( 's_annualMedicals' === $coll ) {
						return self::pick( $d, array( 'id', 'boxerId', 'examDate', '_o' ) ) + array( '_statusOnly' => true );
					}
					if ( 's_restPeriodExams' === $coll ) {
						return self::pick( $d, array( 'id', 'boxerId', 'eventId', 'startDate', 'days', 'dueDate', 'completed', 'isFitToBox', '_o' ) ) + array( '_statusOnly' => true );
					}
				}
				return null;

			case 's_preBoutQuestionnaires':
				$bid = isset( $d['boxerId'] ) ? $d['boxerId'] : '';
				if ( $authd && self::clinical_full( $c, $bid ) ) {
					return $d;
				}
				if ( $authd && ( self::status_access( $c, $bid ) || ( 'official' === $role && in_array( $d['eventId'], $c['events'], true ) ) ) ) {
					$o = self::pick( $d, array( 'id', 'eventId', 'boxerId', '_o' ) );
					foreach ( array( 'boxer', 'coach', 'nonPregnancy' ) as $part ) {
						$o[ $part ] = ! empty( $d[ $part ]['savedAt'] ) ? array( 'savedAt' => $d[ $part ]['savedAt'] ) : null;
					}
					return $o + array( '_statusOnly' => true );
				}
				return null;

			case 's_scatScreens':
				$bid = isset( $d['boxerId'] ) ? $d['boxerId'] : '';
				if ( $authd && self::clinical_full( $c, $bid ) ) {
					return $d;
				}
				if ( $authd && self::status_access( $c, $bid ) ) {
					$o             = self::pick( $d, array( 'id', 'boxerId', 'at', 'required', 'emergency', 'status', '_o' ) );
					$o['followUp'] = ! empty( $d['followUp'] ) ? self::pick( $d['followUp'], array( 'outcome', 'date' ) ) : null;
					$o['reasons']  = array();
					$o['scores']   = (object) array();
					return $o + array( '_statusOnly' => true );
				}
				return null;

			case 's_events':
				$d = self::with_level( $d );
				if ( $authd ) {
					return $d;
				}
				if ( isset( $d['isPublic'] ) && false === $d['isPublic'] ) {
					return null;
				}
				return self::pick( $d, array( 'id', 'name', 'province', 'date', 'endDate', 'firstPreBoutCheckDateTime', 'firstBoutTime', 'location', 'weightClasses', 'livestreamUrl', 'sanctionLevel', 'isPublic', 'scatRequired', 'scatWithinDays', '_o' ) ) + array( 'registeredBoxerIds' => array(), 'officials' => array(), 'physicianIds' => array(), 'bouts' => array() );

			case 's_sanctions':
				if ( $admin ) {
					return $d;
				}
				if ( $authd && ( $d['requestedByUserId'] === $me || ( $c['club'] && isset( $d['info']['club'] ) && $d['info']['club'] === $c['club'] ) ) ) {
					return $d;
				}
				return null;

			case 's_itps':
				if ( 'nsoadmin' === $role || ( 'ptso' === $role && $d['province'] === $c['province'] ) ) {
					return $d;
				}
				if ( ! $authd ) {
					return null;
				}
				if ( $d['submittedBy'] === $me ) {
					return $d;
				}
				foreach ( (array) $d['members'] as $m ) {
					if ( ( isset( $m['userId'] ) && $m['userId'] === $me ) || ( $c['club'] && isset( $m['club'] ) && $m['club'] === $c['club'] ) ) {
						return $d;
					}
				}
				return null;

			case 's_docs':
				$aud = (array) ( isset( $d['audience'] ) ? $d['audience'] : array() );
				if ( $admin || ( $authd && isset( $d['uploadedBy'] ) && $d['uploadedBy'] === $me ) ) {
					return $d;
				}
				if ( 'published' !== ( isset( $d['status'] ) ? $d['status'] : '' ) ) {
					return null;
				}
				if ( in_array( 'public', $aud, true ) ) {
					return $d;
				}
				if ( ! $authd ) {
					return null;
				}
				if ( in_array( $role, $aud, true ) ) {
					return $d;
				}
				if ( in_array( 'nationalteam', $aud, true ) && ! empty( $c['doc']['nationalTeam'] ) ) {
					$levels = (array) ( isset( $d['ntLevels'] ) ? $d['ntLevels'] : array() );
					return ( ! $levels || in_array( $c['doc']['nationalTeam']['level'], $levels, true ) ) ? $d : null;
				}
				return null;

			case 's_calendar':
				if ( $authd ) {
					return $d;
				}
				return ( ! empty( $d['isPublic'] ) && ! empty( $d['nsoApproval'] ) && empty( $d['rejection'] ) ) ? self::pick( $d, array( 'id', 'title', 'type', 'province', 'location', 'startDate', 'endDate', 'startTime', 'endTime', 'description', 'hostClub', 'link', 'isPublic', 'nsoApproval', 'ptsoApproval', 'scope', 'online', '_o' ) ) : null;

			case 's_evalRequests':
				if ( 'nsoadmin' === $role || ( 'ptso' === $role && self::province_of( $d['requesterId'] ) === $c['province'] ) ) {
					return $d;
				}
				return ( $authd && ( $d['requesterId'] === $me || ( isset( $d['assignedEvaluatorId'] ) && $d['assignedEvaluatorId'] === $me ) ) ) ? $d : null;

			case 's_nccp':
				if ( $admin ) {
					return $d;
				}
				if ( ! $authd ) {
					return null;
				}
				$no = isset( $d['no'] ) ? (string) $d['no'] : '';
				if ( in_array( $no, $c['evalNccp'], true ) ) {
					return $d;
				}
				foreach ( array_merge( array( $me ), $c['evalFor'] ) as $uid ) {
					$u = self::user( $uid );
					if ( $u && isset( $u['nccp'] ) && (string) $u['nccp'] === $no ) {
						return $d;
					}
					if ( $u && isset( $u['trackie']['NCCP #'] ) && (string) $u['trackie']['NCCP #'] === $no ) {
						return $d;
					}
				}
				if ( $c['club'] ) {
					foreach ( BCP_Store::all( 's_users' ) as $u ) {
						if ( 'coach' === $u['role'] && isset( $u['club'] ) && $u['club'] === $c['club'] && isset( $u['nccp'] ) && (string) $u['nccp'] === $no ) {
							return $d;
						}
					}
				}
				return null;

			case 's_notifications':
				if ( ! $authd ) {
					return null;
				}
				$to = isset( $d['to'] ) ? $d['to'] : '';
				return ( $to === $me || $to === 'role:' . $role ) ? $d : null;

			case 's_interests':
				return ( 'nsoadmin' === $role || ( 'ptso' === $role && ( empty( $d['province'] ) || $d['province'] === $c['province'] ) ) ) ? $d : null;

			case 's_outbox':
				return $admin ? $d : null;

			case 's_openRequests':
				if ( $admin ) {
					return $d;
				}
				return ( $authd && ( $d['boxerId'] === $me || $d['requestedBy'] === $me || in_array( $d['boxerId'], $c['coached'], true ) ) ) ? $d : null;

			case 's_coachRequests':
				if ( $admin ) {
					return $d;
				}
				if ( 'guardian' === $role ) {
					return $d['boxerId'] === $c['child'] ? $d : null;
				}
				if ( ! $authd ) {
					return null;
				}
				if ( in_array( $me, array( $d['boxerId'], $d['coachId'], isset( $d['requestedBy'] ) ? $d['requestedBy'] : '' ), true ) ) {
					return $d;
				}
				return ( $c['club'] && ! empty( $d['clubName'] ) && $d['clubName'] === $c['club'] ) ? $d : null;

			case 's_guardianCodes':
				if ( $admin ) {
					return $d;
				}
				return ( 'guardian' === $role && $d['code'] === $c['code'] ) ? $d : null;

			case 's_evalIntake':
				// Square order emails: Boxing Canada only.
				return 'nsoadmin' === $role ? $d : null;

			case 's_files':
				// File records stay on the server; downloads are checked one by one.
				return null;
		}
		// Unknown collections: administrators only.
		return $admin ? $d : null;
	}

	/** Add the sanction level (NSO/PTSO) to events created from a sanction. */
	private static function with_level( $ev ) {
		if ( empty( $ev['sanctionLevel'] ) && ! empty( $ev['sanctionId'] ) ) {
			$all = BCP_Store::all( 's_sanctions' );
			$sid = BCP_Store::safe_id( $ev['sanctionId'] );
			if ( isset( $all[ $sid ]['type'] ) ) {
				$ev['sanctionLevel'] = $all[ $sid ]['type'];
			}
		}
		return $ev;
	}

	/* ------------------------------------------------------------------
	 * Writing
	 * ------------------------------------------------------------------ */

	/**
	 * Decide on a change.
	 *
	 * @return array [ 'ok' | 'skip' | 'deny', data to store (for ok), reason ]
	 */
	public static function write( $coll, $doc_id, $old, $new, $c ) {
		$role  = $c['role'];
		$me    = $c['id'];
		$authd = ! in_array( $role, array( 'public', 'guardian' ), true );
		$deny  = function ( $why ) { return array( 'deny', null, $why ); };
		$ok    = function ( $data ) { return array( 'ok', $data, '' ); };
		$is_create = null === $old;
		$is_delete = null === $new;
		$d         = $is_delete ? $old : $new;

		if ( ! $is_delete && strlen( wp_json_encode( $new ) ) > 2 * MB_IN_BYTES ) {
			return $deny( 'That record is too large to save.' );
		}

		// Boxing Canada administrators: everything except clinical records, which only medical staff and PTSOs record.
		if ( 'nsoadmin' === $role ) {
			if ( 's_users' === $coll && ! $is_delete ) {
				unset( $new['password'] );
			}
			if ( 's_guardianCodes' === $coll ) {
				return array( 'skip', null, '' );
			}
			if ( 's_evalRequests' === $coll && $old && $new ) {
				$new = self::admin_eval_merge( $old, $new );
			}
			return $ok( $new );
		}

		switch ( $coll ) {
			case 'meta':
			case 's_programs':
			case 's_nccp':
			case 's_logos':
			case 's_docs':
				return 'ptso' === $role ? $ok( $new ) : $deny( 'Only administrators can change this.' );

			case 's_interests':
				if ( $is_create && ! $is_delete ) {
					return $ok( $new );
				}
				return 'ptso' === $role ? $ok( $new ) : $deny( 'Only administrators can change this.' );

			case 's_notifications':
				if ( $is_create && ! $is_delete && ( $authd || 'guardian' === $role ) ) {
					return $ok( $new );
				}
				if ( $authd && ! $is_create && ! $is_delete ) {
					// Marking as read: only the readBy list may change.
					$a = $old;
					$b = $new;
					unset( $a['readBy'], $b['readBy'], $a['_o'], $b['_o'] );
					return $a == $b ? $ok( $new ) : $deny( 'Notifications can’t be edited.' );
				}
				return self::is_admin( $c ) ? $ok( $new ) : $deny( 'Notifications can’t be deleted.' );

			case 's_outbox':
				if ( $is_create && ! $is_delete && ( $authd || 'guardian' === $role ) ) {
					return $ok( $new );
				}
				return self::is_admin( $c ) ? $ok( $new ) : $deny( 'Only administrators can change sent emails.' );

			case 's_guardianCodes':
				// Codes are always generated on the server when a parent email is sent.
				return array( 'skip', null, '' );

			case 's_users':
				return self::write_user( $old, $new, $c );

			case 's_annualMedicals':
			case 's_ringsideExams':
			case 's_restPeriodExams':
				if ( 'medical' === $role || ( 'ptso' === $role && self::province_of( $d['boxerId'] ) === $c['province'] ) ) {
					return $ok( $new );
				}
				return $deny( 'Only medical practitioners and PTSO administrators record medical examinations.' );

			case 's_preBoutQuestionnaires':
				if ( self::is_admin( $c ) || ( $authd && ( $d['boxerId'] === $me || in_array( $d['boxerId'], $c['coached'], true ) ) ) ) {
					return $ok( $new );
				}
				return $deny( 'Only the boxer and their coaches complete these forms.' );

			case 's_scatScreens':
				if ( self::is_admin( $c ) || 'medical' === $role ) {
					return $ok( $new );
				}
				if ( $is_create && $authd && ( $d['boxerId'] === $me || in_array( $d['boxerId'], $c['coached'], true ) ) ) {
					return $ok( $new );
				}
				return $deny( 'Only the boxer, their coaches and medical officials can record SCAT6 screenings.' );

			case 's_events':
				if ( 'ptso' === $role ) {
					return $ok( $new );
				}
				if ( ! $is_create && ! $is_delete && in_array( $role, array( 'official', 'medical' ), true ) && in_array( $old['id'], $c['events'], true ) ) {
					return $ok( $new );
				}
				return $deny( 'Only administrators and the event’s officials can change events.' );

			case 's_sanctions':
				if ( 'ptso' === $role ) {
					return $ok( $new );
				}
				if ( $authd && ! $is_delete && $d['requestedByUserId'] === $me && ( $is_create || in_array( $old['status'], array( 'draft', 'returned', 'submitted' ), true ) ) && in_array( $new['status'], array( 'draft', 'submitted' ), true ) ) {
					return $ok( $new );
				}
				return $deny( 'Only the applicant can change a sanction request before it is decided.' );

			case 's_itps':
				if ( 'ptso' === $role ) {
					return $ok( $new );
				}
				if ( $authd && ! $is_delete && $d['submittedBy'] === $me ) {
					if ( ! $is_create && ( $old['ptso'] != $new['ptso'] || $old['nso'] != $new['nso'] ) ) {
						return $deny( 'Approvals are recorded by administrators.' );
					}
					return $ok( $new );
				}
				return $deny( 'Only the team leader can change this travel pass.' );

			case 's_calendar':
				if ( 'ptso' === $role ) {
					return $ok( $new );
				}
				if ( $authd && $d['createdBy'] === $me ) {
					if ( ! $is_create && ! $is_delete && ( ( isset( $old['nsoApproval'] ) ? $old['nsoApproval'] : null ) != ( isset( $new['nsoApproval'] ) ? $new['nsoApproval'] : null ) || ( isset( $old['ptsoApproval'] ) ? $old['ptsoApproval'] : null ) != ( isset( $new['ptsoApproval'] ) ? $new['ptsoApproval'] : null ) ) ) {
						return $deny( 'Approvals are recorded by administrators.' );
					}
					return $ok( $new );
				}
				return $deny( 'Only the organizer can change this calendar event.' );

			case 's_evalRequests':
				if ( 'ptso' === $role ) {
					return $deny( 'Evaluations are managed by Boxing Canada.' );
				}
				return self::write_eval_request( $old, $new, $c );

			case 's_evalIntake':
			case 's_files':
				return $deny( 'Only Boxing Canada can change this.' );

			case 's_openRequests':
				if ( 'ptso' === $role ) {
					return $ok( $new );
				}
				if ( $is_create && $authd && ( $d['boxerId'] === $me || in_array( $d['boxerId'], $c['coached'], true ) ) ) {
					return $ok( $new );
				}
				if ( ! $is_create && ! $is_delete && $authd && $old['requestedBy'] === $me && 'cancelled' === $new['status'] ) {
					return $ok( $new );
				}
				return $deny( 'Novice to Open requests are decided by administrators.' );

			case 's_coachRequests':
				if ( 'ptso' === $role ) {
					return $ok( $new );
				}
				if ( $is_delete ) {
					return $deny( 'Requests can’t be deleted.' );
				}
				if ( 'guardian' === $role ) {
					return $d['boxerId'] === $c['child'] ? $ok( $new ) : $deny( 'Not your child’s request.' );
				}
				if ( $authd ) {
					$parties = array( $d['boxerId'], $d['coachId'], isset( $d['requestedBy'] ) ? $d['requestedBy'] : '' );
					if ( ! $is_create ) {
						$parties = array_merge( $parties, array( $old['boxerId'], $old['coachId'] ) );
					}
					if ( in_array( $me, $parties, true ) || ( $c['club'] && in_array( $d['boxerId'], $c['clubBoxers'], true ) ) ) {
						return $ok( $new );
					}
				}
				return $deny( 'You aren’t part of this coaching request.' );
		}

		return self::is_admin( $c ) ? $ok( $new ) : $deny( 'You can’t change this.' );
	}

	/* ------------------------------------------------------------------
	 * Coach evaluations
	 * ------------------------------------------------------------------ */

	/** What an evaluator sees of a coach they are evaluating: profile, contact and membership status. */
	private static function for_evaluator( $u, $c ) {
		$p = self::profile( $u, $c );
		foreach ( array( 'email', 'phone', 'lang', 'nccp', 'certHistory' ) as $k ) {
			if ( isset( $u[ $k ] ) ) {
				$p[ $k ] = $u[ $k ];
			}
		}
		if ( isset( $u['trackie'] ) && is_array( $u['trackie'] ) ) {
			$p['trackie'] = self::pick( $u['trackie'], array( 'MEMBER #', 'MEMBERSHIP TYPE', 'NSO EXPIRY', 'NSO JOIN DATE', 'CLUB NAME', 'COACH LEVEL', 'NCCP #', 'DATE OF CRIMINAL RECORD CHECK', 'LANGUAGE', 'PREFERRED LANGUAGE', 'INDIVIDUAL EMAIL' ) );
		}
		$p['_evaluating'] = true;
		return $p;
	}

	/** Everything in both copies, by id (for administrators, whose copy may be a few seconds old). */
	private static function union_thread( $old, $new ) {
		$out  = array_values( (array) $old );
		$seen = array();
		foreach ( $out as $e ) {
			if ( isset( $e['id'] ) ) {
				$seen[ $e['id'] ] = true;
			}
		}
		foreach ( (array) $new as $e ) {
			if ( is_array( $e ) && ! empty( $e['id'] ) && ! isset( $seen[ $e['id'] ] ) ) {
				$out[]            = $e;
				$seen[ $e['id'] ] = true;
			}
		}
		return $out;
	}

	/** An administrator's change to an evaluation never removes the coach's work or anyone's comments. */
	private static function admin_eval_merge( $old, $new ) {
		foreach ( array( 'messages', 'history' ) as $k ) {
			$new[ $k ] = self::union_thread( isset( $old[ $k ] ) ? $old[ $k ] : array(), isset( $new[ $k ] ) ? $new[ $k ] : array() );
		}
		$old_tasks = self::by_id( isset( $old['tasks'] ) ? $old['tasks'] : array() );
		foreach ( (array) ( isset( $new['tasks'] ) ? $new['tasks'] : array() ) as $i => $t ) {
			if ( ! is_array( $t ) || ! isset( $t['id'], $old_tasks[ $t['id'] ] ) ) {
				continue;
			}
			$o = $old_tasks[ $t['id'] ];
			foreach ( array( 'submissions', 'answer', 'submittedAt', 'draftAt' ) as $k ) {
				if ( array_key_exists( $k, $o ) ) {
					$t[ $k ] = $o[ $k ];
				}
			}
			$t['comments']      = self::union_thread( isset( $o['comments'] ) ? $o['comments'] : array(), isset( $t['comments'] ) ? $t['comments'] : array() );
			$new['tasks'][ $i ] = $t;
		}
		return $new;
	}

	/** Comments, messages and history: keep everything already there, add only new entries written by this person. */
	private static function merge_thread( $old, $new, $me ) {
		$out  = array_values( (array) $old );
		$seen = array();
		foreach ( $out as $e ) {
			if ( isset( $e['id'] ) ) {
				$seen[ $e['id'] ] = true;
			}
		}
		foreach ( (array) $new as $e ) {
			if ( ! is_array( $e ) || empty( $e['id'] ) || isset( $seen[ $e['id'] ] ) || ( isset( $e['by'] ) ? $e['by'] : '' ) !== $me ) {
				continue;
			}
			$e['text']        = isset( $e['text'] ) ? sanitize_textarea_field( (string) $e['text'] ) : '';
			$out[]            = $e;
			$seen[ $e['id'] ] = true;
		}
		return $out;
	}

	private static function by_id( $list ) {
		$m = array();
		foreach ( (array) $list as $x ) {
			if ( is_array( $x ) && isset( $x['id'] ) ) {
				$m[ $x['id'] ] = $x;
			}
		}
		return $m;
	}

	/**
	 * A shared evaluation: requests come from the Square store (created on the
	 * server). The coach adds their own work to each task; the evaluator checks
	 * readiness, gives feedback and records the outcome. Each side's changes are
	 * merged into the saved record, so neither can overwrite the other's work.
	 */
	private static function write_eval_request( $old, $new, $c ) {
		$me    = $c['id'];
		$authd = ! in_array( $c['role'], array( 'public', 'guardian' ), true );
		if ( ! $authd || null === $old ) {
			return array( 'deny', null, 'Evaluation requests come from the Boxing Canada store.' );
		}
		if ( null === $new ) {
			return array( 'deny', null, 'Evaluation requests can’t be deleted.' );
		}
		$is_coach = $old['requesterId'] === $me;
		$is_eval  = isset( $old['assignedEvaluatorId'] ) && $old['assignedEvaluatorId'] === $me;
		if ( ! $is_coach && ! $is_eval ) {
			return array( 'deny', null, 'You can’t change this evaluation request.' );
		}
		$out       = $old;
		$old_tasks = self::by_id( isset( $old['tasks'] ) ? $old['tasks'] : array() );
		$new_tasks = self::by_id( isset( $new['tasks'] ) ? $new['tasks'] : array() );
		$coach_keys = array( 'submissions', 'answer', 'submittedAt', 'draftAt' );
		$eval_keys  = array( 'assignment', 'review' );

		$out['messages'] = self::merge_thread( isset( $old['messages'] ) ? $old['messages'] : array(), isset( $new['messages'] ) ? $new['messages'] : array(), $me );
		$out['history']  = self::merge_thread( isset( $old['history'] ) ? $old['history'] : array(), isset( $new['history'] ) ? $new['history'] : array(), $me );

		if ( $is_eval ) {
			if ( 'completed' !== $old['status'] && in_array( $new['status'], array( 'assigned', 'not_ready', 'in_progress', 'completed' ), true ) ) {
				$out['status'] = $new['status'];
			}
			foreach ( array( 'track', 'readiness', 'outcome', 'emails', 'lockerEntry', 'startedAt', 'evaluatorNotes', 'finalFeedback' ) as $k ) {
				if ( array_key_exists( $k, $new ) ) {
					$out[ $k ] = $new[ $k ];
				}
			}
			if ( ! $old_tasks ) {
				// Starting the evaluation: the tasks are copied from the pathway, without any coach work.
				$out['tasks'] = array();
				foreach ( $new_tasks as $t ) {
					foreach ( $coach_keys as $k ) {
						unset( $t[ $k ] );
					}
					$t['submissions'] = array();
					$t['comments']    = self::merge_thread( array(), isset( $t['comments'] ) ? $t['comments'] : array(), $me );
					$out['tasks'][]   = $t;
				}
				return array( 'ok', $out, '' );
			}
		}

		if ( $is_coach && ! $is_eval ) {
			if ( 'paid' === $old['status'] && 'cancelled' === $new['status'] ) {
				$out['status'] = 'cancelled';
			}
			if ( isset( $new['coachSeenAt'] ) ) {
				$out['coachSeenAt'] = $new['coachSeenAt'];
			}
		}

		$tasks = array();
		foreach ( (array) ( isset( $old['tasks'] ) ? $old['tasks'] : array() ) as $t ) {
			$n = isset( $new_tasks[ $t['id'] ] ) ? $new_tasks[ $t['id'] ] : null;
			if ( $n ) {
				$done = isset( $t['review']['status'] ) && 'complete' === $t['review']['status'];
				if ( $is_coach && ! $done && 'in_progress' === $old['status'] ) {
					foreach ( $coach_keys as $k ) {
						if ( array_key_exists( $k, $n ) ) {
							$t[ $k ] = $n[ $k ];
						}
					}
					$t['submissions'] = array_values( array_filter( (array) $t['submissions'], function ( $x ) {
						return is_array( $x ) && ( empty( $x['url'] ) || preg_match( '#^https?://#i', $x['url'] ) );
					} ) );
				}
				if ( $is_eval ) {
					foreach ( $eval_keys as $k ) {
						if ( array_key_exists( $k, $n ) ) {
							$t[ $k ] = $n[ $k ];
						}
					}
				}
				$t['comments'] = self::merge_thread( isset( $t['comments'] ) ? $t['comments'] : array(), isset( $n['comments'] ) ? $n['comments'] : array(), $me );
			}
			$tasks[] = $t;
		}
		$out['tasks'] = $tasks;
		return array( 'ok', $out, '' );
	}

	/** Changes to a member record. */
	private static function write_user( $old, $new, $c ) {
		$role = $c['role'];
		$me   = $c['id'];
		if ( null !== $new ) {
			unset( $new['password'] );
		}
		if ( 'ptso' === $role ) {
			// PTSOs manage members, but can't make NSO administrators or move people between provinces' admin roles.
			if ( null !== $new && 'nsoadmin' === $new['role'] && ( ! $old || 'nsoadmin' !== $old['role'] ) ) {
				return array( 'deny', null, 'Only Boxing Canada can appoint NSO administrators.' );
			}
			return array( 'ok', $new, '' );
		}
		if ( null === $old || null === $new ) {
			return array( 'deny', null, 'Only administrators can add or remove members.' );
		}
		$keep_all_but = function ( $allowed ) use ( $old, $new ) {
			$out = $old;
			foreach ( $allowed as $k ) {
				if ( array_key_exists( $k, $new ) ) {
					$out[ $k ] = $new[ $k ];
				}
			}
			return $out;
		};
		$coach_diff = array_values( array_diff(
			array_merge( array_diff( (array) $new['selectedCoachIds'], (array) $old['selectedCoachIds'] ), array_diff( (array) $old['selectedCoachIds'], (array) $new['selectedCoachIds'] ) ),
			array()
		) );

		// Your own record: everything except administrator-managed fields.
		if ( $old['id'] === $me ) {
			$out = $new;
			foreach ( self::PROTECTED_USER_FIELDS as $k ) {
				if ( array_key_exists( $k, $old ) ) {
					$out[ $k ] = $old[ $k ];
				} else {
					unset( $out[ $k ] );
				}
			}
			$out = self::maybe_allow_open( $old, $new, $out, $c );
			return array( 'ok', $out, '' );
		}

		// A parent or guardian: only coach relationships of their child.
		if ( 'guardian' === $role ) {
			return $old['id'] === $c['child'] ? array( 'ok', $keep_all_but( array( 'selectedCoachIds', 'coachLog' ) ), '' ) : array( 'deny', null, 'Not your child.' );
		}

		// A coach accepting or ending their own coaching relationship, or a club manager for their club's boxers.
		$club_ok = $c['club'] && isset( $old['club'] ) && $old['club'] === $c['club'];
		if ( 'boxer' === $old['role'] && ( $club_ok || ( $coach_diff && array( $me ) === array_values( array_unique( $coach_diff ) ) ) || ( ! $coach_diff && in_array( $old['id'], $c['coached'], true ) ) ) ) {
			$out = $keep_all_but( array( 'selectedCoachIds', 'coachLog' ) );
			$out = self::maybe_allow_open( $old, $new, $out, $c );
			return array( 'ok', $out, '' );
		}
		return array( 'deny', null, 'You can’t change another member’s record.' );
	}

	/** A boxer with 10 or more completed bouts may be moved to Open by themselves or their coach. */
	private static function maybe_allow_open( $old, $new, $out, $c ) {
		$from = isset( $old['classification'] ) ? $old['classification'] : 'novice';
		$to   = isset( $new['classification'] ) ? $new['classification'] : $from;
		if ( 'open' === $to && 'open' !== $from && ( $old['id'] === $c['id'] || in_array( $old['id'], $c['coached'], true ) ) && self::completed_bouts( $old['id'] ) >= 10 ) {
			$out['classification'] = 'open';
			$out['classHistory']   = isset( $new['classHistory'] ) ? $new['classHistory'] : ( isset( $old['classHistory'] ) ? $old['classHistory'] : array() );
		}
		return $out;
	}

	private static function completed_bouts( $boxer_id ) {
		$n = 0;
		foreach ( BCP_Store::all( 's_events' ) as $ev ) {
			foreach ( (array) ( isset( $ev['bouts'] ) ? $ev['bouts'] : array() ) as $b ) {
				$in = ( isset( $b['redId'] ) && $b['redId'] === $boxer_id ) || ( isset( $b['blueId'] ) && $b['blueId'] === $boxer_id );
				if ( $in && ! empty( $b['winner'] ) ) {
					$n++;
				}
			}
		}
		return $n;
	}
}
