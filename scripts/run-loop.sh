#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ -f "$ROOT/.blog.env" ]; then
  set -a
  source "$ROOT/.blog.env"
  set +a
fi
/usr/bin/env node "$ROOT/scripts/publish.mjs" >> "$ROOT/logs/publisher.log" 2>&1
