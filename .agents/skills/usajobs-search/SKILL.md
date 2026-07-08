---
name: usajobs-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for US federal government jobs,
  civil service positions, government agency roles, security clearance jobs, public
  sector work, or any role posted on USAJobs. Trigger phrases: government job,
  federal job, USAJobs, civil service, GS-grade position, government agency hiring,
  security clearance required, public sector, Department of [agency], federal
  agency.
context: fork
allowed-tools: Bash(bun run skills/usajobs-search/cli/src/cli.ts *)
---

# USAJobs Search Skill

Search open federal government positions via the **official USAJobs REST API** —
clean JSON, free API key, covers all US federal civilian roles.

> USAJobs is the official US government job portal. This skill uses their public
> developer API, which is provided for exactly this purpose.

## Prerequisites — API key required

USAJobs requires a free API key. Registration takes ~1 minute:

1. Go to **https://developer.usajobs.gov/apirequest/**
2. Fill in your name and email → submit
3. You'll receive a key by email (usually instant)
4. Add both to your shell environment:

```bash
# Add to ~/.zshrc or ~/.bashrc:
export USAJOBS_API_KEY="your-key-here"
export USAJOBS_EMAIL="your@email.com"
```

Then reload: `source ~/.zshrc`

The CLI reads these at runtime and exits with `NO_API_KEY` / `NO_EMAIL` if missing.

## Commands

### Search federal job postings

```bash
bun run skills/usajobs-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query, -q <text>` — keyword search (title, duties, qualifications).
- `--location, -l <text>` — city, state, or zip code (e.g. `"Washington DC"`, `"Remote"`).
- `--jobage <days>` — only jobs posted within the last N days (1–180).
- `--remote` — filter to remote-eligible positions only.
- `--limit, -n <n>` — cap results (default 25, max 500).
- `--page <n>` — pagination (default 1).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/usajobs-search/cli/src/cli.ts detail <job-id> [--format json|plain]
```

`job-id` is the numeric `MatchedObjectId` from search results (e.g. `777978200`).

## Usage examples

```bash
# Software engineering roles posted in the last 30 days
bun run skills/usajobs-search/cli/src/cli.ts search -q "software engineer" --jobage 30 --format table

# Remote cybersecurity positions
bun run skills/usajobs-search/cli/src/cli.ts search -q "cybersecurity" --remote --format table

# Roles in DC at any agency
bun run skills/usajobs-search/cli/src/cli.ts search -q "data scientist" -l "Washington DC" --format table

# Full job detail
bun run skills/usajobs-search/cli/src/cli.ts detail 777978200 --format plain
```

## Output format (search)

`json` includes salary range, remote/telework status, grade, and application deadline.
`table` gives a quick scannable view of title, agency, location, salary, and deadline.

## Notes

- **Salary**: shown as a range (`$94,199–$122,459/yr`). Most federal jobs use the GS pay scale.
- **Grade**: GS grade level (e.g. `GS-13`). Higher = more senior.
- **Remote**: `RemoteJob = true` means fully remote. `Telework` means eligible for some WFH.
- **Deadline**: `ApplicationCloseDate` — federal jobs often have firm close dates.
- **Who may apply**: some listings are internal-only (current federal employees). The `whoMayApply` field in JSON output flags this.
