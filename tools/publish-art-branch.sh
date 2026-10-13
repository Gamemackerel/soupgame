#!/bin/sh
# Copies the art branch's catalog (the placeholder templates the artist works from) into art-branch/ on the current
# branch (main), so GitHub Pages serves it at /soupgame/art-branch/. Re-run after the art branch's templates change,
# then commit and push main.
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
git archive art art/index.html art/templates art/aseprite | tar -x -C "$tmp"
rm -rf art-branch
mkdir -p art-branch
cp "$tmp/art/index.html" art-branch/index.html
cp -R "$tmp/art/templates" art-branch/templates
# The artist's Aseprite files, zipped, for downloading from the catalog page.
(cd "$tmp/art" && zip -qr - aseprite) > art-branch/soup-pot-aseprite.zip
# The artist's instructions are on the art branch too.
sed -i.bak 's#/blob/main/art/README.md#/blob/art/art/README.md#' art-branch/index.html && rm art-branch/index.html.bak
rm -rf "$tmp"
echo "Copied the art branch catalog to art-branch/ ($(ls art-branch/templates/*/ art-branch/templates/*/*/ 2>/dev/null | grep -c '\.json$') sprites)."
