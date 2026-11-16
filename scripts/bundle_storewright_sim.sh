#!/bin/sh
# Bundle Storewright's store-day simulation for the interactive page's "What if…" lab (idea #169).
#
#   sh scripts/bundle_storewright_sim.sh <path to a storewright checkout>
#
# It runs the checkout's own esbuild (node_modules/.bin/esbuild, installed with the checkout's
# dependencies) on scripts/storewright_sim_entry.mjs and writes pages/src/storewright-sim.js: one
# minified script for the browser (an IIFE that defines the global StorewrightSim) with
# Storewright's simulation code and what it uses, license comments kept. Nothing is written inside
# the checkout. Run it on your own machine whenever the page should follow a newer Storewright
# commit, then build the page and run its checks; CI never runs it (the committed file is what the
# page uses). The banner names the repository, the commit and the license: Storewright's code is
# AGPL-3.0, and so is this file, whose source is that repository at that commit. The checkout must
# be clean, so the commit says exactly what went in.
set -eu

if [ $# -ne 1 ] || [ ! -d "$1" ]; then
  echo "usage: sh scripts/bundle_storewright_sim.sh <path to a storewright checkout>" >&2
  exit 2
fi
repo=$(cd "$1" && pwd)
here=$(cd "$(dirname "$0")/.." && pwd)
esbuild="$repo/node_modules/.bin/esbuild"
out="$here/pages/src/storewright-sim.js"

[ -x "$esbuild" ] || { echo "bundle_storewright_sim: no esbuild in $repo/node_modules/.bin (install the checkout's dependencies first)" >&2; exit 1; }
commit=$(git -C "$repo" rev-parse --short=7 HEAD)
# --no-optional-locks: only look; a plain status may rewrite the index inside the checkout
if [ -n "$(git -C "$repo" --no-optional-locks status --porcelain --untracked-files=no)" ]; then
  echo "bundle_storewright_sim: $repo has uncommitted changes; the banner could not say what went in" >&2
  exit 1
fi
version=$("$esbuild" --version)
zod=$(node -e 'process.stdout.write(require(process.argv[1]).version)' "$repo/node_modules/zod/package.json" 2>/dev/null || echo "?")

banner="/*! Storewright store-day simulation for the \"What if\" lab on glacieerr.github.io (idea #169).
 * Storewright: https://github.com/Glacieerr/storewright, commit $commit. Copyright 2026 Glacieerr.
 * Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only), as is this file: its
 * source is that repository at that commit (packages/domain, store-config, synth, sim-engine and the
 * packages they use) and scripts/storewright_sim_entry.mjs in github.com/Glacieerr/Glacieerr.
 * It includes zod $zod (https://github.com/colinhacks/zod), MIT License, Copyright (c) 2020 Colin McDonnell.
 * Bundled by scripts/bundle_storewright_sim.sh with esbuild $version. Do not edit by hand. */"

# The entry imports @storewright/* and zod by name; NODE_PATH points esbuild at the checkout's
# node_modules for those, and the checkout's own files resolve from where they are.
NODE_PATH="$repo/node_modules" "$esbuild" "$here/scripts/storewright_sim_entry.mjs" \
  --bundle --format=iife --global-name=StorewrightSim --platform=browser --target=es2022 \
  --minify --legal-comments=inline --charset=ascii --log-level=warning \
  --banner:js="$banner" --outfile="$out"

bytes=$(wc -c < "$out" | tr -d ' ')
echo "bundle_storewright_sim: wrote pages/src/storewright-sim.js ($bytes bytes) from Storewright $commit with esbuild $version"
