#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web.
# Installs dependencies so lint, typecheck, tests, and build work immediately.
# Only runs in remote (web) sessions; local sessions manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Activate the pnpm version pinned in package.json (via corepack), then install.
# `pnpm install` (not --frozen-lockfile) is idempotent and benefits from the
# container's cached state on subsequent runs.
corepack enable >/dev/null 2>&1 || true
pnpm install
