#!/bin/sh
# Builds the site as it is served into a folder: the pages and their files, the styles
# and scripts minified, and every address stamped with the fingerprint of its file.
# Usage: sh tools/build.sh dist
# Needs python3, and esbuild on the PATH for the minifying (CI installs it; without it
# the files are copied as they are). fonts/ and data/ must be there.
set -eu
cd "$(dirname "$0")/.."
out="${1:-dist}"
rm -rf "$out"
mkdir -p "$out"
cp -r *.html en favicon.png apple-touch-icon.png robots.txt sitemap.xml css js fonts img data qb "$out"/
if command -v esbuild >/dev/null 2>&1; then
  # comments and spaces are for people, not for browsers
  for f in "$out"/css/*.css "$out"/js/*.js; do
    esbuild "$f" --minify --log-level=warning --outfile="$f" --allow-overwrite
  done
  for f in "$out"/js/*.js; do node --check "$f"; done
else
  echo "esbuild not found: styles and scripts stay unminified" >&2
fi
python3 tools/stamp.py "$out"
