#!/bin/sh
# Puts the self hosted fonts into fonts/. They come from the Fontsource packages on npm,
# pinned and checked, so the repository holds no binaries and no page asks Google.
# Usage: sh tools/fonts.sh
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd "$tmp" && npm pack --silent @fontsource/big-shoulders-display@5.3.0 @fontsource/newsreader@5.3.0 @fontsource-variable/schibsted-grotesk@5.3.0 >/dev/null)
for f in "$tmp"/*.tgz; do tar xzf "$f" -C "$tmp" && mv "$tmp/package" "${f%.tgz}"; done
bs="$tmp/fontsource-big-shoulders-display-5.3.0"
nr="$tmp/fontsource-newsreader-5.3.0"
sg="$tmp/fontsource-variable-schibsted-grotesk-5.3.0"
mkdir -p fonts
cp "$bs/files/big-shoulders-display-latin-600-normal.woff2" "$bs/files/big-shoulders-display-latin-800-normal.woff2" fonts/
cp "$nr/files/newsreader-latin-400-normal.woff2" "$nr/files/newsreader-latin-400-italic.woff2" "$nr/files/newsreader-latin-600-normal.woff2" fonts/
cp "$sg/files/schibsted-grotesk-latin-wght-normal.woff2" fonts/
cp "$bs/LICENSE" fonts/OFL-big-shoulders.txt
cp "$nr/LICENSE" fonts/OFL-newsreader.txt
cp "$sg/LICENSE" fonts/OFL-schibsted-grotesk.txt
cd fonts && sha256sum -c <<'SUMS'
448000586ef3a91726a8de46e2948e7426d693d57a568a188006407d24409845  big-shoulders-display-latin-600-normal.woff2
088f423f09136bc96b5a7cc7232d671a1ad06a5ff1cf90cd1e24a8d9809d471c  big-shoulders-display-latin-800-normal.woff2
fa9b900403949d9a723106752a5c8ad2797012a0c9057427b1da2db72d552148  newsreader-latin-400-italic.woff2
e66067814f1c672d33a457e4f4d102c818b481420e2234cf685ebdbf2f443904  newsreader-latin-400-normal.woff2
05c91a26d19a61eafe7ce8e0b77eff3fd279ce994dc89f432f4cd06784935e84  newsreader-latin-600-normal.woff2
4c8b93f431d462c696e12b9d6a033feb3394d36e66e781357c496b95d8a75e05  schibsted-grotesk-latin-wght-normal.woff2
SUMS
