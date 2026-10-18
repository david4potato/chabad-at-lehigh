#!/bin/bash
# Cloud sessions (Claude Code on the web) start from a fresh checkout: install
# the npm packages so lint, typecheck and unit tests work right away.
# Local sessions already have node_modules, so this does nothing there.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund --prefer-offline >&2
