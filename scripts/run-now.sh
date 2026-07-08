#!/bin/bash
# Run the daily scraper immediately (for testing).
# Reads RESEND_API_KEY and NOTIFY_EMAIL from .env or environment.

cd "$(dirname "$0")/.."
exec "$(which bun 2>/dev/null || echo "$HOME/.bun/bin/bun")" run scripts/daily-scrape.ts
