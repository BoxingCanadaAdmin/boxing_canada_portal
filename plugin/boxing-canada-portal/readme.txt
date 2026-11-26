=== Boxing Canada Portal ===
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.2.6
License: GPLv2 or later

The Boxing Canada National Portal as a WordPress plugin: Digital Record Books, Annual Medicals, ringside checks, pre-bout forms, sanctions, events, travel passes, coach relationships, club managers, certification and Safe Sport.

== Description ==

The portal runs full-screen on its own page (it does not use the theme), and keeps all of its data in the WordPress database. Members sign in with WordPress accounts. The server checks every request: members only ever receive the records their role allows, and changes they aren't allowed to make are refused.

== Installation ==

1. Plugins › Add New › Upload Plugin, choose boxing-canada-portal.zip, then Activate.
2. On first activation the plugin creates a "Portal" page and loads the fictional demo data, with demo sign-in accounts (password Password123!).
3. Open Boxing Canada › Settings to change settings, load or clear data, and download backups.

Full instructions are in INSTALL.md inside the plugin folder.

== Changelog ==

= 0.2.6 =
* Sanction application: new "Tournament software" question (with rings and the last day of a multi-day event). When an approved request asked for it, the Boxing Canada Tournament App (same website) creates the event from the request and makes the applicant its organizer; the request then shows "Open in the Tournament App".

= 0.2.5 =
* Square order emails: tuned to Square's real layout (French and English). Reads the chosen level instead of the levels named in the product description, takes the buyer's name from the subject, and ignores orders for other products (new "Evaluation product name" setting).

= 0.2.4 =
* "Boxing Canada" in the WordPress sidebar, with a boxing glove icon: Settings (moved from Tools) and Open the portal. Old Tools links redirect.
* The Coach evaluations settings (Square inbound email address, allowed senders, evaluation From and Cc addresses) now appear on the settings page.

= 0.2.3 =
* Same as 0.2.2 (installs its own updates on managed hosting; Plugins-screen update links). The v0.2.2 release on GitHub was created before those changes were merged, so they ship as 0.2.3.

= 0.2.2 =
* Automatic updates also work on managed hosting that switches WordPress's background updater off: the portal installs its own releases twice a day. New "Update now" button and a list of what affects updates on the site.
* Plugins screen: "Check for updates" and "Auto-update: on (Turn off)" links on the portal's row.

= 0.2.1 =
* Updates from GitHub: new releases of BoxingCanadaAdmin/boxing_canada_portal appear as WordPress updates and install automatically (can be turned off; optional pre-release channel for test sites).

= 0.2.0 =
* Coach evaluations: Square order emails become evaluation requests; evaluators check readiness against The Locker and Trackie, email the coach, and share a task screen with uploads, online forms, feedback and outcomes.
* Coaching pathway with the current NCCP levels (IB, CI, CD), the 2027 names scheduled, and editable requirements and tasks.

= 0.1.0 =
* First WordPress version of the portal.
