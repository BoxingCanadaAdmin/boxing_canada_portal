<?php
/**
 * Full-screen portal page. Deliberately skips the theme: the portal has its own design.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
nocache_headers();
$bcp_v   = BCP_VERSION . '-' . filemtime( BCP_DIR . 'assets/js/portal-app.js' );
$bcp_cfg = BCP_Frontend::config();
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Boxing Canada National Portal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?php echo esc_url( BCP_URL . 'assets/css/portal.css?ver=' . $bcp_v ); ?>">
<link rel="icon" href="<?php echo esc_url( BCP_URL . 'assets/img/icon.png' ); ?>">
</head>
<body>
<div id="root"><div id="boot">Loading the Boxing Canada National Portal…</div></div>
<noscript><p style="padding:24px;font-family:sans-serif">The Boxing Canada portal needs JavaScript turned on.</p></noscript>
<script>window.BCP_WP = <?php echo wp_json_encode( $bcp_cfg ); ?>;</script>
<script src="<?php echo esc_url( BCP_URL . 'assets/js/react.production.min.js?ver=18.3.1' ); ?>"></script>
<script src="<?php echo esc_url( BCP_URL . 'assets/js/react-dom.production.min.js?ver=18.3.1' ); ?>"></script>
<script src="<?php echo esc_url( BCP_URL . 'assets/js/portal-app.js?ver=' . $bcp_v ); ?>"></script>
</body>
</html>
