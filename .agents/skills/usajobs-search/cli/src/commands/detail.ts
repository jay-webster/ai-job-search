import {
  SEARCH_URL,
  jsonFetch,
  normaliseDetail,
  writeError,
  AuthError,
  NotFoundError,
  getAuth,
  type USASearchResponse,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const numId = parseInt(opts.id, 10)
  if (isNaN(numId) || numId <= 0) {
    writeError(`Invalid job ID "${opts.id}" — expected a numeric MatchedObjectId (e.g. 777978200)`, "BAD_ID")
    return 1
  }

  const auth = getAuth()
  if (!auth) return 1

  try {
    // USAJobs has no single-job endpoint; search with a broad keyword that
    // surfaces the right posting, then match by MatchedObjectId.
    // Approach: use the PositionID code embedded in the numeric ID is not reliable,
    // so instead we fetch with ResultsPerPage=1 and iterate pages — too slow.
    // Better: call search with no filters and a large page to find the job, OR
    // embed enough info in search results. Since we can't guarantee finding a
    // single job by numeric ID without the agency's PositionID, we use a targeted
    // workaround: the USAJobs search API accepts a `PositionID` param (agency req#),
    // which is different from MatchedObjectId. We don't have the agency PositionID
    // from the search results, so instead we fetch the HTML detail page and parse it.
    //
    // USAJobs HTML pages are server-rendered with structured content in named sections.
    const url = `https://www.usajobs.gov/GetJob/ViewDetails/${numId}`

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    })

    if (response.status === 404) throw new NotFoundError()
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)

    const html = await response.text()

    // Extract structured data from the page. USAJobs uses data attributes and
    // known section IDs that are stable across their redesigns.
    const title = extractMeta(html, "og:title") || extractTag(html, "h1") || `Job #${numId}`
    const description = extractSection(html, "duties") || extractSection(html, "job-duties")
    const qualifications =
      extractSection(html, "qualifications") ||
      extractSection(html, "qualifications-required") ||
      extractSection(html, "how-you-will-be-evaluated")

    const jobCard = {
      id: String(numId),
      title: stripTags(title).trim(),
      url,
      description: description ? cleanText(description) : null,
      qualifications: qualifications ? cleanText(qualifications) : null,
    }

    if (opts.format === "plain") {
      const lines = [
        jobCard.title,
        `ID: ${jobCard.id}`,
        `URL: ${jobCard.url}`,
        "",
        jobCard.description ? "DUTIES\n" + jobCard.description : "",
        jobCard.qualifications ? "\nQUALIFICATIONS\n" + jobCard.qualifications : "",
      ].filter(Boolean)
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(jobCard, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    if (e instanceof NotFoundError) {
      writeError(`Job ${opts.id} not found on USAJobs`, "NOT_FOUND")
    } else if (e instanceof AuthError) {
      writeError(e.message, "AUTH_FAILED")
    } else {
      writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    }
    return 1
  }
}

function extractMeta(html: string, property: string): string | null {
  const m = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"))
  return m ? m[1] : null
}

function extractTag(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, "i"))
  return m ? m[1] : null
}

function extractSection(html: string, id: string): string | null {
  // Match a section/div/article with the given id or data-id
  const patterns = [
    new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]*?)<\/(?:section|div|article)>`, "i"),
    new RegExp(`data-section=["']${id}["'][^>]*>([\\s\\S]*?)<\/(?:section|div)>`, "i"),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function cleanText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  return stripTags(withBreaks).replace(/\n{3,}/g, "\n\n").trim()
}

// Re-export for completeness (unused but keeps imports clean)
export type { USASearchResponse }
