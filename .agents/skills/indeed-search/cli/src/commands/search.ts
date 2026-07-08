import { SEARCH_URL, htmlFetch, parseRssItems, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query?: string
  location: string
  jobage?: number  // days: 1, 3, 7, 14, 30
  radius?: number  // miles: 5, 10, 15, 25, 50, 100
  jobtype?: string // fulltime, parttime, contract, internship, temporary
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("q", opts.query)
  params.set("l", opts.location)
  params.set("sort", "date")
  if (opts.jobage && opts.jobage > 0 && opts.jobage < 9999) {
    params.set("fromage", String(opts.jobage))
  }
  if (opts.radius) params.set("radius", String(opts.radius))
  if (opts.jobtype) params.set("jt", opts.jobtype)
  // Pagination: 10 results per page
  if (opts.page > 1) params.set("start", String((opts.page - 1) * 10))
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const date = c.date || "—"
    return `${c.id.padEnd(16)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(16) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(26) +
    " " +
    "LOCATION".padEnd(22) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const xml = await htmlFetch(buildUrl(opts))
    if (!xml) {
      writeError("Empty response from Indeed RSS", "SEARCH_FAILED")
      return 1
    }
    let cards = parseRssItems(xml)
    if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, page: opts.page }, results: cards },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
