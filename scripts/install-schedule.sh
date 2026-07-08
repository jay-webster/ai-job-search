#!/bin/bash
# Installs the daily job scraper as a macOS launchd service.
# Runs at 7:00 AM every day.
# Usage: bash scripts/install-schedule.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUN_PATH="$(which bun 2>/dev/null || echo "$HOME/.bun/bin/bun")"
BUN_DIR="$(dirname "$BUN_PATH")"
PLIST_SRC="$PROJECT_ROOT/scripts/com.ai-job-search.daily.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.ai-job-search.daily.plist"
LOG_DIR="$PROJECT_ROOT/logs"

echo ""
echo "AI Job Search — Daily Scraper Setup"
echo "===================================="
echo ""

# Check bun exists
if [ ! -f "$BUN_PATH" ]; then
    echo "ERROR: bun not found at $BUN_PATH"
    echo "Install bun first: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo "Bun:           $BUN_PATH"
echo "Project root:  $PROJECT_ROOT"

# Prompt for API keys
echo ""
echo "You'll need a free Resend API key to send email digests."
echo "Sign up at: https://resend.com  (free tier: 100 emails/day)"
echo ""
read -p "Resend API key (re_...): " RESEND_API_KEY
read -p "Email to notify (jay@activelab.com): " NOTIFY_EMAIL
NOTIFY_EMAIL="${NOTIFY_EMAIL:-jay@activelab.com}"

# Optional USAJobs
echo ""
read -p "USAJobs API key (leave blank to skip): " USAJOBS_API_KEY
if [ -n "$USAJOBS_API_KEY" ]; then
    read -p "USAJobs email: " USAJOBS_EMAIL
fi

# Create logs directory
mkdir -p "$LOG_DIR"

# Build the plist from template
PLIST_CONTENT=$(sed \
    -e "s|__BUN_PATH__|$BUN_PATH|g" \
    -e "s|__BUN_DIR__|$BUN_DIR|g" \
    -e "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|__RESEND_API_KEY__|$RESEND_API_KEY|g" \
    -e "s|__NOTIFY_EMAIL__|$NOTIFY_EMAIL|g" \
    "$PLIST_SRC")

# Wire in USAJobs keys if provided
if [ -n "${USAJOBS_API_KEY:-}" ]; then
    PLIST_CONTENT=$(echo "$PLIST_CONTENT" | sed \
        -e "s|<!-- <key>USAJOBS_API_KEY</key> -->|<key>USAJOBS_API_KEY</key>|g" \
        -e "s|<!-- <string>__USAJOBS_API_KEY__</string> -->|<string>$USAJOBS_API_KEY</string>|g" \
        -e "s|<!-- <key>USAJOBS_EMAIL</key> -->|<key>USAJOBS_EMAIL</key>|g" \
        -e "s|<!-- <string>__USAJOBS_EMAIL__</string> -->|<string>${USAJOBS_EMAIL:-}</string>|g")
fi

# Unload existing job if running
if launchctl list | grep -q "com.ai-job-search.daily" 2>/dev/null; then
    echo ""
    echo "Unloading existing schedule..."
    launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Write and load the plist
echo "$PLIST_CONTENT" > "$PLIST_DST"
launchctl load "$PLIST_DST"

echo ""
echo "Schedule installed ✓"
echo ""
echo "  Runs:    Every day at 7:00 AM"
echo "  Notify:  $NOTIFY_EMAIL"
echo "  Logs:    $LOG_DIR/daily-scrape.log"
echo ""
echo "Test it now (runs immediately):"
echo "  bash scripts/run-now.sh"
echo ""
echo "To remove the schedule:"
echo "  bash scripts/uninstall-schedule.sh"
echo ""
