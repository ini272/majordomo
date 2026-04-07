#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REMOTE=${REMOTE:-origin}
BRANCH=${1:-$(git -C "$ROOT_DIR" branch --show-current)}

cd "$ROOT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "deploy-safe.sh requires a git checkout at $ROOT_DIR"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean; refusing to deploy."
  exit 1
fi

./deployment/backup-db.sh

git fetch "$REMOTE" "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

./deployment/deploy.sh
