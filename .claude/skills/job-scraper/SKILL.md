---
name: job-scraper
description: >
  Searches multiple US job boards for new positions matching the candidate profile.
  Deduplicates across runs. Triggers on: job scrape, find jobs, search jobs, new jobs,
  job search, scrape jobs, /scrape, any new jobs, what's out there.
allowed-tools: >
  Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Agent, AskUserQuestion,
  Bash(~/.bun/bin/bun run .agents/skills/linkedin-search/cli/src/cli.ts *),
  Bash(~/.bun/bin/bun run .agents/skills/indeed-search/cli/src/cli.ts *),
  Bash(~/.bun/bin/bun run .agents/skills/greenhouse-search/cli/src/cli.ts *),
  Bash(~/.bun/bin/bun run .agents/skills/usajobs-search/cli/src/cli.ts *)
---

# Job Scraper

Searches LinkedIn, Indeed, Greenhouse (target companies), and USAJobs for new
openings. CLI tools return clean JSON — no per-result WebFetch required. Results
are deduplicated against `job_scraper/seen_jobs.json` and `job_search_tracker.csv`.

## Invocation

- `/scrape` — run default queries from `search-queries.md`
- `/scrape [focus]` — focus on a specific keyword (e.g. `/scrape ML engineer`)
- `/scrape broad` — run all query categories (default runs top 3)
- `/scrape greenhouse` — only check Greenhouse company boards
- `/scrape usajobs` — only check federal jobs

---

## Execution Steps

### Step 0: Load State

Read these **three** files in parallel before anything else:

1. `.claude/skills/job-scraper/search-queries.md` — query config and Greenhouse targets
2. `job_scraper/seen_jobs.json` — previously seen jobs (create if missing: `{"seen": {}}`)
3. `job_search_tracker.csv` — already-applied jobs

Hold all three in context. Do not re-read them.

---

### Step 1: Run CLI Tools (Parallel)

Run the four CLI tools in **parallel** using the queries from `search-queries.md`.
All tools output JSON to stdout. Capture and parse the `results` array from each.

If the user specified a focus area, use that as the `--query` value instead of the
defaults from `search-queries.md`.

#### LinkedIn
```bash
~/.bun/bin/bun run .agents/skills/linkedin-search/cli/src/cli.ts search \
  -q "[KEYWORD]" -l "[LOCATION]" --jobage 14 --format json
```

#### Indeed
```bash
~/.bun/bin/bun run .agents/skills/indeed-search/cli/src/cli.ts search \
  -q "[KEYWORD]" -l "[LOCATION]" --jobage 14 --format json
```

#### Greenhouse (run for each company in `target-companies` list)
```bash
~/.bun/bin/bun run .agents/skills/greenhouse-search/cli/src/cli.ts search \
  --company [SLUG] -q "[KEYWORD]" --format json
```

Run Greenhouse searches in parallel — one per company. Merge all results.

#### USAJobs
```bash
~/.bun/bin/bun run .agents/skills/usajobs-search/cli/src/cli.ts search \
  -q "[KEYWORD]" --jobage 14 --format json
```

**Error handling**: If a CLI tool exits non-zero, log the error from stderr but
continue with results from other sources. Never abort the full run for one source.

---

### Step 2: Merge and Deduplicate

Collect all `results` arrays from Step 1 into a single flat list. Each result has
at minimum: `{ id, title, company, location, date, url }`.

Deduplicate using this priority order:
1. **URL match** — exact URL already in `seen_jobs.json`
2. **Company + title match** — same company+role already in `seen_jobs.json` or `job_search_tracker.csv`

Tag each result with its source: `linkedin`, `indeed`, `greenhouse`, or `usajobs`.

---

### Step 3: Quick Fit Assessment

For each **new** (not deduplicated) result, do a rapid fit check based on the
candidate profile in `CLAUDE.md`. Do NOT run the full evaluation — just:

- **High**: Role directly uses core skills, strong alignment
- **Medium**: Adjacent role, partial skill match
- **Low**: Significant skill gap or misaligned direction

You can assess from the `title`, `company`, `location`, and `department`/`grade`
fields in the JSON. Only WebFetch the posting page if the title alone is ambiguous
and a quick fetch would meaningfully change the fit assessment.

---

### Step 4: Update seen_jobs.json

Add ALL results (new and already-seen) to `seen_jobs.json` with:

```json
{
  "seen": {
    "<url>": {
      "title": "...",
      "company": "...",
      "source": "linkedin|indeed|greenhouse|usajobs",
      "url": "...",
      "first_seen": "YYYY-MM-DD",
      "fit": "high|medium|low",
      "status": "new|skipped|evaluated|ranked|expired"
    }
  }
}
```

Write the updated file before presenting results.

---

### Step 5: Present Results

Present **only new results** (not previously seen), sorted by fit (high first):

```
## New Job Matches — YYYY-MM-DD

Found X new positions across Y sources (A high, B medium, C low match).
Sources: LinkedIn (N), Indeed (N), Greenhouse (N), USAJobs (N).

| # | Fit | Title | Company | Location | Source | Date | URL |
|---|-----|-------|---------|----------|--------|------|-----|
| 1 | ⬆ High | ... | ... | ... | LinkedIn | ... | [Link](...) |
| 2 | — Med | ... | ... | ... | Indeed | ... | [Link](...) |
...
```

For each **High** match, add a brief highlight block:
```
**#1 — [Title] @ [Company]**
- Why it fits: ...
- Check: ...
```

After presenting, ask:
> "Want me to evaluate any of these in detail? Give me the number(s), or say 'all high'."

If the user picks a number, invoke the **job-application-assistant** skill workflow
(fit evaluation first, then CV + cover letter if approved).

If 8+ new jobs found, also suggest `/rank` to batch-score them against the full
fit framework and return a ranked shortlist.

---

### Step 6: Update Tracker (Optional)

If the user decides to apply, add a row to `job_search_tracker.csv`.

---

## Important Rules

1. **Never fabricate job postings.** Only present real results from CLI tools or
   WebSearch/WebFetch.
2. **Respect deduplication.** Always check `seen_jobs.json` AND `job_search_tracker.csv`.
3. **CLI tools first.** Prefer structured CLI output over ad-hoc WebSearch/WebFetch
   scraping — it's faster, more reliable, and already normalized.
4. **Only new positions.** Skip anything with an expired `deadline` or status `closed`.
5. **Parallel execution.** Run CLI tools in parallel via the Agent tool or simultaneous
   Bash calls to minimize total wall-clock time.
6. **Graceful degradation.** A single CLI tool failing should not cancel the run.
