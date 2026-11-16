#!/usr/bin/env bash
# Collect the interactive page that just passed its checks, with everything the build put next to
# it (404 page, share image, card.txt, robots.txt, sitemap.xml, giscus themes, public resume PDFs,
# ...), into one folder for GitHub Pages. The Glacieerr.github.io repository's workflow runs it on
# a checkout of this repository after the checks pass (idea #125: nothing is published when a check
# fails), then publishes the folder with GitHub Pages; no token is needed.
#   bash scripts/collect_site.sh <folder>     copy the site into <folder> (made if missing)
#   bash scripts/collect_site.sh --dry-run    list what would be published; copy nothing
set -euo pipefail
dest="${1:---dry-run}"
if [ "$dest" != "--dry-run" ]; then
  mkdir -p "$dest"
  dest="$(cd "$dest" && pwd)"
fi
cd "$(dirname "$0")/.."
[ -f pages/dist/index.html ] || { echo "collect_site: missing pages/dist/index.html (run python3 pages/build.py)" >&2; exit 1; }
# everything in pages/dist except the two old versions kept there for comparison
files=()
for f in pages/dist/*; do
  case "$(basename "$f")" in index-ios7.html|index-r1.html) continue ;; esac
  [ -f "$f" ] && files+=("$f")
done
if [ "$dest" = "--dry-run" ]; then
  echo "would publish (${#files[@]} files):"
  for f in "${files[@]}"; do printf '  %-40s %8d bytes\n' "$(basename "$f")" "$(wc -c < "$f")"; done
  exit 0
fi
cp "${files[@]}" "$dest/"
echo "collect_site: copied ${#files[@]} files to $dest"
