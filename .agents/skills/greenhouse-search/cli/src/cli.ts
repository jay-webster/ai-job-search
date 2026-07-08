#!/usr/bin/env bun
// CLI for searching jobs on Greenhouse-powered company boards.
// Uses the public Greenhouse Boards REST API — no auth, no scraping.
// Zero external dependencies — runs anywhere bun is available.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { c: "company", q: "query", l: "location", n: "limit" }
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

const HELP = `greenhouse-cli — search jobs on any Greenhouse-powered company board

USAGE
  bun run src/cli.ts search --company <slug> [flags]
  bun run src/cli.ts detail --company <slug> <job-id> [--format json|plain]

SEARCH FLAGS
  --company, -c <slug>    Greenhouse board slug. REQUIRED. e.g. "stripe", "airbnb", "notion".
  --query, -q <text>      Filter by title keywords (client-side, case-insensitive).
  --location, -l <text>   Filter by location substring (client-side, e.g. "New York", "remote").
  --jobage <days>         Only include jobs first published within the last N days.
  --limit, -n <n>         Cap results emitted.
  --format <fmt>          json (default) | table | plain.

DETAIL FLAGS
  --company, -c <slug>    Greenhouse board slug. REQUIRED.
  <job-id>                Numeric job ID from search results (e.g. 7954688).
  --format <fmt>          json (default) | plain.

EXAMPLES
  bun run src/cli.ts search --company stripe -q "engineer" --format table
  bun run src/cli.ts search --company notion -q "product" --location "remote" --format table
  bun run src/cli.ts search --company brex --jobage 14 --limit 10 --format table
  bun run src/cli.ts detail --company stripe 7954688 --format plain

Common Greenhouse slugs: stripe, airbnb, lyft, pinterest, robinhood, brex, plaid,
  ramp, reddit, discord, notion, figma, databricks, cloudflare, hubspot, asana,
  lattice, rippling, gusto, carta, coinbase, intercom, mixpanel
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const company = typeof flags.company === "string" ? flags.company.trim() : undefined

  if (cmd === "search") {
    // Validate numeric flags first so BAD_ARG surfaces regardless of other missing args
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

    if (!company) {
      process.stderr.write(
        JSON.stringify({
          error: 'the --company/-c flag is required (e.g. -c stripe)',
          code: "NO_COMPANY",
        }) + "\n",
      )
      return 1
    }

    const fmt = (flags.format as string) || "json"
    const opts: SearchOpts = {
      company,
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    if (!company) {
      process.stderr.write(
        JSON.stringify({
          error: 'the --company/-c flag is required (e.g. -c stripe)',
          code: "NO_COMPANY",
        }) + "\n",
      )
      return 1
    }
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires a <job-id>", code: "NO_ID" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      company,
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
