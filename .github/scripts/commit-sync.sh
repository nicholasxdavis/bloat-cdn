#!/usr/bin/env bash
# Commit published/ + vault/ after automated sync jobs.
set -euo pipefail

MSG="${1:-sync update}"
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git add published/ vault/

if git diff --staged --quiet; then
  echo "No sync changes to commit."
  exit 0
fi

git commit -m "chore(sync): ${MSG} [skip ci]"
git push
