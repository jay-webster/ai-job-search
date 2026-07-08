#!/bin/bash
# Removes the daily job scraper launchd service.

PLIST="$HOME/Library/LaunchAgents/com.ai-job-search.daily.plist"

if [ ! -f "$PLIST" ]; then
    echo "Schedule not installed."
    exit 0
fi

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Schedule removed."
