#!/bin/bash
set -euo pipefail
launchctl print gui/$(id -u)/com.croot.freight-signals | sed -n '1,80p'
