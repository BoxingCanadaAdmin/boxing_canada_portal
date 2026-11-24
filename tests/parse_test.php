<?php
/**
 * Reads the Square order emails in tests/fixtures and checks what the portal gets from them.
 * Run against the test site: php tests/wpcli.php 'require "tests/parse_test.php";'
 * Fixtures are made-up copies of real Square layouts: never commit real member details.
 */
$cases = array(
	'square-order-fr.txt'              => array( 'fullName' => 'Priya Shah', 'nccp' => '6630481', 'email' => 'priya.shah@example.ca', 'levelId' => 'lv-cc', 'track' => 'regular', 'orderNo' => '400000001', 'amount' => 180.0, 'isEvaluation' => true ),
	'square-order-fr-ci-challenge.txt' => array( 'fullName' => 'Marc Bélanger', 'nccp' => '5512093', 'levelId' => 'lv-pc', 'track' => 'challenge', 'orderNo' => '400000002', 'isEvaluation' => true ),
	'square-order-en.txt'              => array( 'fullName' => 'Tyler Okafor', 'nccp' => '6702215', 'email' => 'tyler.okafor@example.ca', 'levelId' => 'lv-cc', 'track' => 'regular', 'orderNo' => '400000004', 'amount' => 180.0, 'isEvaluation' => true ),
	'square-order-merch.txt'           => array( 'isEvaluation' => false ),
);
$fails = 0;
foreach ( $cases as $file => $want ) {
	$t = file_get_contents( __DIR__ . '/fixtures/' . $file );
	preg_match( '/^Subject: (.*)$/m', $t, $m );
	$got = BCP_Coach_Eval::parse( $m[1], $t );
	foreach ( $want as $k => $v ) {
		$ok = $got[ $k ] === $v;
		$fails += $ok ? 0 : 1;
		echo ( $ok ? 'PASS ' : 'FAIL ' ) . "$file $k: " . var_export( $got[ $k ], true ) . ( $ok ? '' : ' (expected ' . var_export( $v, true ) . ')' ) . "\n";
	}
}
echo "\n$fails failure(s)\n";
