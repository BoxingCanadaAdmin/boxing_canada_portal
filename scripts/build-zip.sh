#!/usr/bin/env bash
# Builds dist/boxing-canada-portal.zip, ready for Plugins › Add New › Upload Plugin.
# Run `npm run build` (and `npm run seed` if demo data changed) in source/ first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/boxing-canada-portal.zip"
cd "$ROOT/plugin"
zip -qr "$ROOT/dist/boxing-canada-portal.zip" boxing-canada-portal -x "*.DS_Store"
echo "Built dist/boxing-canada-portal.zip ($(du -h "$ROOT/dist/boxing-canada-portal.zip" | cut -f1))"
