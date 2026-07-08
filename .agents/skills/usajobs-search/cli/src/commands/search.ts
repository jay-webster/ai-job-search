import {
  SEARCH_URL,
  jsonFetch,
  normaliseCard,
  writeError,
  AuthError,
  getAuth,
  type USASearchResponse,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage?: number
  remote?: boolean
  limit?: number
  page?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("Keyword", opts.query)
  if (opts.location) params.set("LocationName", opts.location)
  if (opts.jobage && opts.jobage > 0) params.set("DatePosted", String(opts.jobage))
  if (opts.remote) params.set("RemoteIndicator", "True")
  params.set("ResultsPerPage", String(opts.limit && opts.limit > 0 ? Math.min(opts.limit, 500) : 25))
  if (opts.page && opts.page > 1) params.set("Page", String(opts.page))
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 36).padEnd(36)
    const agency = (c.company || "—").slice(0, 28).padEnd(28)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const sal = (c.salary || "—").padEnd(14)
    const dl = c.deadline || "—"
    return `${c.id.padEnd(10)} ${title} ${agency} ${loc} ${sal} ${dl}`
  })
  const header =
    "ID".padEnd(10) +
    " " +
    "TITLE".padEnd(36) +
    " " +
    "AGENCY".padEnd(28) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "SALARY".padEnd(14) +
    " DEADLINE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  const auth = getAuth()
  if (!auth) return 1

  try {
    const url = buildUrl(opts)
    const data = await jsonFetch<USASearchResponse>(url, auth)

    const items = data.SearchResult?.SearchResultItems ?? []
    let cards = items.map(normaliseCard)
    if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.salary || "—"} · ${c.grade || "—"}\n  Posted: ${c.date || "—"} · Deadline: ${c.deadline || "—"}\n  Remote: ${c.remote ? "Yes" : "No"} · Telework: ${c.telework || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: cards.length,
              total: data.SearchResult?.SearchResultCountAll ?? 0,
            },
            results: cards,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    if (e instanceof AuthError) {
      writeError(e.message, "AUTH_FAILED")
    } else {
      writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    }
    return 1
  }
}
