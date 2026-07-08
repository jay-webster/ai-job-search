---
name: greenhouse-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs at a specific company
  that uses Greenhouse as their ATS, browse open roles at a tech company, find
  jobs at startups or mid-stage companies, or look up a specific Greenhouse job
  posting. Trigger phrases: jobs at [company], [company] careers, [company] is
  hiring, search Greenhouse, tech company jobs, startup jobs, open roles at
  [company], greenhouse.io, find jobs at [company name].
context: fork
allowed-tools: Bash(bun run skills/greenhouse-search/cli/src/cli.ts *)
---

# Greenhouse Search Skill

Search open roles from any company that uses Greenhouse as their ATS via the
**public Greenhouse API** — clean JSON, no authentication, no API key, zero
runtime dependencies.

> The Greenhouse Boards API is a public, documented endpoint that companies
> intentionally expose for their career pages. No scraping; this is its intended
> use.

## When to use this skill

- Browse all open roles at a specific company (by Greenhouse board slug)
- Filter by job title keywords or location (client-side)
- Get the full job description for a specific posting

## Well-known companies on Greenhouse

These slugs work out of the box (pass as `--company <slug>`):

| Slug | Company |
|------|---------|
| `stripe` | Stripe |
| `airbnb` | Airbnb |
| `lyft` | Lyft |
| `pinterest` | Pinterest |
| `robinhood` | Robinhood |
| `brex` | Brex |
| `plaid` | Plaid |
| `ramp` | Ramp |
| `reddit` | Reddit |
| `discord` | Discord |
| `notion` | Notion |
| `figma` | Figma |
| `databricks` | Databricks |
| `cloudflare` | Cloudflare |
| `twilio` | Twilio |
| `hubspot` | HubSpot |
| `asana` | Asana |
| `lattice` | Lattice |
| `rippling` | Rippling |
| `gusto` | Gusto |
| `carta` | Carta |
| `coinbase` | Coinbase |
| `intercom` | Intercom |
| `mixpanel` | Mixpanel |

> **Finding a company's slug:** go to `boards.greenhouse.io/<slug>` or check
> the `gh_jid` parameter on the company's careers page URL. The slug is usually
> the lowercased company name.

## Commands

### Search open roles at a company

```bash
bun run skills/greenhouse-search/cli/src/cli.ts search --company <slug> [flags]
```

Key flags:
- `--company, -c <slug>` — **required.** Greenhouse board slug (e.g. `stripe`, `airbnb`).
- `--query, -q <text>` — filter by title keywords (client-side, case-insensitive).
- `--location, -l <text>` — filter by location substring (client-side, e.g. `"New York"`, `"remote"`).
- `--jobage <days>` — only include jobs first published within the last N days.
- `--limit, -n <n>` — cap total results emitted.
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/greenhouse-search/cli/src/cli.ts detail --company <slug> <job-id> [--format json|plain]
```

`job-id` is the numeric ID from search results (e.g. `7954688`).

## Usage examples

```bash
# All open engineering roles at Stripe
bun run skills/greenhouse-search/cli/src/cli.ts search --company stripe -q "engineer" --format table

# Remote product roles at any Greenhouse company
bun run skills/greenhouse-search/cli/src/cli.ts search --company notion -q "product" --location "remote" --format table

# Jobs posted in the last 14 days at Brex
bun run skills/greenhouse-search/cli/src/cli.ts search --company brex --jobage 14 --format table

# Full description for a specific job
bun run skills/greenhouse-search/cli/src/cli.ts detail --company stripe 7954688 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors go to **stderr** as `{ "error": "...", "code": "..." }`, exit code `1`.

## Notes

- The Greenhouse Boards API returns all open jobs for a board in one call; filtering is client-side.
- Job IDs are company-scoped integers — always pass `--company` with `detail`.
- `absolute_url` may point to the company's own careers page, not `boards.greenhouse.io`.
