#!/usr/bin/env bash
# Sets the plugin version everywhere it appears: scripts/bump-version.sh 0.3.0
# Then commit, merge to main, and push a matching tag (git tag v0.3.0 && git push origin v0.3.0)
# to publish the release that sites update to.
set -euo pipefail
V="${1:?Usage: scripts/bump-version.sh X.Y.Z}"
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "Not a version: $V"; exit 1; }
P="$(cd "$(dirname "$0")/.." && pwd)/plugin/boxing-canada-portal"
sed -i.bak -E "s/^( \* Version:[[:space:]]+).*/\1$V/" "$P/boxing-canada-portal.php"
sed -i.bak -E "s/define\( 'BCP_VERSION', '[^']+' \);/define( 'BCP_VERSION', '$V' );/" "$P/boxing-canada-portal.php"
sed -i.bak -E "s/^Stable tag: .*/Stable tag: $V/" "$P/readme.txt"
sed -i.bak -E "s/^Version [0-9][^ ]*$/Version $V/" "$P/INSTALL.md"
rm -f "$P"/*.bak
grep -nE "Version:|BCP_VERSION'|Stable tag|^Version " "$P/boxing-canada-portal.php" "$P/readme.txt" "$P/INSTALL.md"
