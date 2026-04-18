#!/bin/bash
set -euo pipefail
PLIST_DST="$HOME/Library/LaunchAgents/com.croot.freight-signals.plist"
launchctl unload "$PLIST_DST" >/dev/null 2>&1 || true
echo "Unloaded $PLIST_DST"
