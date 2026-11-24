# boxing_canada_portal

Membership tools for Boxing Canada: the Boxing Canada National Portal, delivered as a WordPress plugin for portal.boxingcanada.org. It covers Digital Record Books, medical forms, sanctions, events, travel passes, coach relationships, club managers, Safe Sport, and NCCP coach certification and evaluations.

## Repository layout

| Folder | What it holds |
|---|---|
| `plugin/boxing-canada-portal/` | The WordPress plugin, ready to zip and install, including the compiled interface. `INSTALL.md` inside is the installation and operation guide. |
| `source/` | The interface source (`portal-app.jsx`, React) and `coach-pathway.json`, the starting coaching pathway. `npm run build` compiles them into the plugin. |
| `tests/` | Server-rule tests and a browser walkthrough of the coach evaluation flow, run against a throwaway WordPress site. |
| `scripts/` | `build-zip.sh` makes the installable zip; `bump-version.sh` sets the plugin version for a release. |
| `.github/workflows/` | `release.yml` publishes a release when a version tag is pushed; `ci.yml` checks pull requests. |

## Build

```
cd source
npm install
npm run build      # compiles portal-app.jsx and the CSS into the plugin, and copies coach-pathway.json to plugin data/
npm run seed       # only if the demo data in portal-app.jsx changed: regenerates plugin data/demo-seed.json
cd ..
scripts/build-zip.sh   # writes dist/boxing-canada-portal.zip
```

Commit the compiled files in `plugin/` along with the source change, so the plugin folder is always installable as-is.

## Test

The setup script needs PHP 8.1+ (with pdo_sqlite) and git. It builds a WordPress site on SQLite, with this repo's plugin linked in and activated.

```
tests/setup-wordpress.sh
php -S localhost:8080 -t tests/.wordpress/site tests/router.php    # leave running
python3 tests/api_test.py    # access rules for Square intake, shared evaluations and files
python3 tests/ui_test.py     # needs Playwright: walks the evaluation flow as admin, evaluator and coach
php tests/wpcli.php 'require "tests/parse_test.php";'   # reads the Square order emails in tests/fixtures
```

- **Login throttle:** both tests reset the demo data. The portal locks an account after 8 sign-ins in 15 minutes, so running the tests repeatedly can lock the demo accounts. To clear the lock: `php tests/wpcli.php 'global $wpdb; $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE \"_transient%bcp_login%\"");'`
- **Screenshots** go to `tests/screenshots/`.
- **Fixtures** in `tests/fixtures/` are made-up copies of real Square order layouts. Never commit real member details: this repository is public.

## Release

Sites running the plugin update themselves from this repository's GitHub releases. Releases are published automatically: bump the version with `scripts/bump-version.sh X.Y.Z` and merge it to `main`. The **Release** workflow then checks and builds the plugin, and publishes release `vX.Y.Z` with `boxing-canada-portal.zip` attached. Versions with a hyphen become pre-releases, which only test sites install. The **CI** workflow runs the same checks on every pull request.

Details are in section 7 of [`plugin/boxing-canada-portal/INSTALL.md`](plugin/boxing-canada-portal/INSTALL.md).

## Install

See [`plugin/boxing-canada-portal/INSTALL.md`](plugin/boxing-canada-portal/INSTALL.md). Section 6 covers coach evaluations and the Square email intake.
