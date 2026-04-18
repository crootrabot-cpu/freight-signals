#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="/opt/homebrew/bin/node"
cd "$ROOT"
if [ -f "$ROOT/.blog.env" ]; then
  set -a
  source "$ROOT/.blog.env"
  set +a
fi
"$NODE_BIN" "$ROOT/scripts/publish.mjs" >> "$ROOT/logs/publisher.log" 2>&1
