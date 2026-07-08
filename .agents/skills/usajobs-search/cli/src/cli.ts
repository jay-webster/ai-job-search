#!/usr/bin/env bun
// CLI for searching US federal government jobs via the official USAJobs API.
// Requires free API key — register at https://developer.usajobs.gov/apirequest/
// Zero external dependencies — runs anywhere bun is available.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || (a.startsWith("-") && a.length === 2)) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `usajobs-cli — search US federal government jobs via the USAJobs API

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <job-id> [--format json|plain]

PREREQUISITES
  export USAJOBS_API_KEY="your-key"    # from developer.usajobs.gov/apirequest/
  export USAJOBS_EMAIL="your@email.com"

SEARCH FLAGS
  --query, -q <text>    Keyword search (title, duties, qualifications).
  --location, -l <text> City, state, or zip (e.g. "Washington DC", "Remote").
  --jobage <days>       Jobs posted within last N days (1–180).
  --remote              Filter to remote-eligible positions only.
  --limit, -n <n>       Cap results emitted (default 25, max 500).
  --page <n>            Page number (default 1).
  --format <fmt>        json (default) | table | plain.

DETAIL FLAGS
  <job-id>              Numeric MatchedObjectId from search results (e.g. 777978200).
  --format <fmt>        json (default) | plain.

EXAMPLES
  bun run src/cli.ts search -q "software engineer" --jobage 30 --format table
  bun run src/cli.ts search -q "cybersecurity" --remote --format table
  bun run src/cli.ts search -q "data scientist" -l "Washington DC" --limit 10 --format table
  bun run src/cli.ts detail 777978200 --format plain
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    // Validate numeric flags before any I/O or auth checks
    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n",
        )
        return null
      }
      return val
    }

    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      flags.jobage = String(v)
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      flags.page = String(v)
    }

    const fmt = (flags.format as string) || "json"
    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      remote: flags.remote === true,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      page: flags.page ? parseInt(flags.page as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires a <job-id>", code: "NO_ID" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
