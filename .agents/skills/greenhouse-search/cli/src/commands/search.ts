import {
  API_BASE,
  jsonFetch,
  normaliseCard,
  matchesQuery,
  matchesLocation,
  withinDays,
  writeError,
  NotFoundError,
  type GHListResponse,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  company: string
  query?: string
  location?: string
  jobage?: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const dept = (c.department || "—").slice(0, 24).padEnd(24)
    const date = c.date || "—"
    return `${c.id.padEnd(10)} ${title} ${loc} ${dept} ${date}`
  })
  const header =
    "ID".padEnd(10) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "LOCATION".padEnd(24) +
    " " +
    "DEPARTMENT".padEnd(24) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = `${API_BASE}/${encodeURIComponent(opts.company)}/jobs`
    const data = await jsonFetch<GHListResponse>(url)

    let cards = data.jobs.map(normaliseCard)

    if (opts.query) cards = cards.filter((c) => matchesQuery(c, opts.query!))
    if (opts.location) cards = cards.filter((c) => matchesLocation(c, opts.location!))
    if (opts.jobage && opts.jobage > 0) cards = cards.filter((c) => withinDays(c, opts.jobage!))
    if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  ${c.department ? `[${c.department}]` : ""}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, company: opts.company }, results: cards },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    if (e instanceof NotFoundError) {
      writeError(`Company board "${opts.company}" not found on Greenhouse`, "NOT_FOUND")
    } else {
      writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    }
    return 1
  }
}
