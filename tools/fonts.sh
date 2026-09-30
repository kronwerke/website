#!/bin/sh
# Puts the self hosted font into fonts/. It comes from the Fontsource package on npm,
# pinned and checked, so the repository holds no binaries and no page asks Google.
# Usage: sh tools/fonts.sh
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd "$tmp" && npm pack --silent @fontsource-variable/schibsted-grotesk@5.3.0 >/dev/null)
for f in "$tmp"/*.tgz; do tar xzf "$f" -C "$tmp" && mv "$tmp/package" "${f%.tgz}"; done
sg="$tmp/fontsource-variable-schibsted-grotesk-5.3.0"
mkdir -p fonts
cp "$sg/files/schibsted-grotesk-latin-wght-normal.woff2" fonts/
cp "$sg/LICENSE" fonts/OFL-schibsted-grotesk.txt
cd fonts && sha256sum -c <<'SUMS'
4c8b93f431d462c696e12b9d6a033feb3394d36e66e781357c496b95d8a75e05  schibsted-grotesk-latin-wght-normal.woff2
SUMS
