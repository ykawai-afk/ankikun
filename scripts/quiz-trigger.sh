#!/bin/zsh
# Triggered by launchd at scheduled times. Sends a macOS notification
# (which automatically mirrors to a paired Apple Watch when the Mac is
# locked / out of focus). The user opens the Ankikun web app on whichever
# device is closest and does the SRS quiz there.

set -euo pipefail

TITLE="${1:-Ankikun}"
MESSAGE="${2:-5枚クイズの時間 — /review で復習しよう}"
SOUND="${3:-Glass}"

/usr/bin/osascript -e "display notification \"${MESSAGE}\" with title \"${TITLE}\" sound name \"${SOUND}\""
