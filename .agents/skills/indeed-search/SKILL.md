---
name: indeed-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in the United States
  or internationally on Indeed, find US job listings, search Indeed job postings,
  or look up a specific Indeed job. Trigger phrases: find jobs on Indeed, Indeed
  job search, search Indeed, US jobs, jobs in the US, jobs in America, jobs in
  [US city or state], indeed.com, job openings USA, hiring in [US location],
  remote US jobs, federal jobs, tech jobs US, entry level US jobs.
context: fork
allowed-tools: Bash(bun run skills/indeed-search/cli/src/cli.ts *)
---

# Indeed Search Skill

Search live job listings from Indeed's public RSS feed for **any US location or
international market** (plus remote). No authentication, no API key, and **zero
runtime dependencies** — it runs with just `bun`.

> Indeed's RSS feed is designed for programmatic consumption (feed readers, job
> aggregators). This skill uses it for personal job searching. Keep volume low
> and use it on your own responsibility.

## When to use this skill

- Search for job openings on Indeed in a given US city, state, or remotely
- Filter by recency (last 1 / 3 / 7 / 14 / 30 days) and job type
- Get the full description of a specific Indeed job posting

## Commands

### Search job listings

```bash
bun run skills/indeed-search/cli/src/cli.ts search --location "<place>" [flags]
```

Key flags:
- `--location, -l <text>` — **required.** e.g. `"New York, NY"`, `"San Francisco, CA"`, `"Remote"`, `"Austin, TX"`.
- `--query, -q <text>` — keywords (job title, skill, or role). Recommended.
- `--jobage <days>` — posted within N days: `1`, `3`, `7`, `14`, `30`. Default: all.
- `--radius <miles>` — search radius in miles: `5`, `10`, `15`, `25`, `50`, `100`. Default: 25.
- `--jobtype <type>` — `fulltime`, `parttime`, `contract`, `internship`, `temporary`.
- `--limit, -n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/indeed-search/cli/src/cli.ts detail <jobkey|url> [--format json|plain]
```

`jobkey` is the 16-character hex ID from search results (e.g. `abc123def4567890`). You may
also pass a full `indeed.com/viewjob?jk=...` URL.

## Usage examples

```bash
# Data engineer roles in New York, last 14 days
bun run skills/indeed-search/cli/src/cli.ts search -q "data engineer" -l "New York, NY" --jobage 14 --format table

# Product manager, fully remote
bun run skills/indeed-search/cli/src/cli.ts search -q "product manager" -l "Remote" --jobtype fulltime --format table

# Software engineer in Austin, last 7 days
bun run skills/indeed-search/cli/src/cli.ts search -q "software engineer" -l "Austin, TX" --jobage 7 --limit 10 --format table

# Full details for a specific job
bun run skills/indeed-search/cli/src/cli.ts detail abc123def4567890 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing job keys to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source is Indeed's public RSS feed — no credentials required.
- The `detail` command fetches the full job page and extracts structured JSON-LD data.
- Indeed may rate-limit; the CLI retries 429/5xx with exponential backoff. Keep volume low.
- Job IDs (keys) are 16-character hex strings (e.g. `abc123def4567890`) — pass them as-is to `detail`.
