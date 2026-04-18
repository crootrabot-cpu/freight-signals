#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$ROOT/launchd/com.croot.freight-signals.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.croot.freight-signals.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DST"
launchctl unload "$PLIST_DST" >/dev/null 2>&1 || true
launchctl load "$PLIST_DST"
launchctl start com.croot.freight-signals || true
echo "Loaded $PLIST_DST"
