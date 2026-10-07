#!/bin/bash
# Rebuild the password-gated guide and push it to GitHub Pages.
# Prompts for the password so it never lands in a file, the repo or shell history.
set -euo pipefail
cd "$(dirname "$0")"
read -rsp "Guide password: " PW; echo
[ -n "$PW" ] || { echo "No password entered - nothing published."; exit 1; }
python3 build/build_plain.py
printf %s "$PW" | node build/encrypt.js -
unset PW
git add index.html assets .gitignore README.md publish.sh build/encrypt.js build/build_plain.py
git commit -m "Publish partner-deals guide $(date +%Y-%m-%d)" || echo "(no changes to commit)"
git push origin main
echo "Live in about a minute: https://saascend-org.github.io/xypher-partner-deals-guide/"
