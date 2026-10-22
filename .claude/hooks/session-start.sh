#!/bin/bash
# Installs the npm packages when a session starts, so lint, typecheck and unit
# tests work right away: always in cloud sessions (Claude Code on the web start
# from a fresh checkout), and on your own computer only when node_modules is
# missing, for example right after cloning.
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ -d node_modules ]; then
  exit 0
fi

npm install --no-audit --no-fund --prefer-offline >&2
