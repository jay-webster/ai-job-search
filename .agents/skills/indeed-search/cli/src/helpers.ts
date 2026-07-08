// Data source: Indeed's public RSS feed (search) and job detail pages (detail).
// Search parses RSS 2.0 XML; detail extracts JSON-LD structured data from the job page.
// No external dependencies — regex only.

export const SEARCH_URL = "https://www.indeed.com/rss"
export const DETAIL_URL = "https://www.indeed.com/viewjob"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch with exponential backoff on 429/5xx. Returns "" on 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.indeed.com/",
        "Accept-Encoding": "gzip, deflate, br",
      },
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  companyUrl: string | null
  location: string | null
  date: string | null
  url: string
  snippet: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  deadline: string | null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(text: string): string {
  return decodeHtmlEntities(stripTags(text)).trim()
}

/** Extract the 16-char hex job key from an Indeed URL or raw key string. */
export function extractJobKey(input: string): string | null {
  const fromParam = input.match(/[?&]jk=([a-f0-9]{16})/)
  if (fromParam) return fromParam[1]
  const bare = input.match(/^([a-f0-9]{16})$/)
  if (bare) return bare[1]
  return null
}

/** Parse RFC 2822 pubDate to ISO date (YYYY-MM-DD). Returns null on failure. */
function parseRssDate(pubDate: string): string | null {
  try {
    const d = new Date(pubDate)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  } catch {
    return null
  }
}

/** Extract location from the Indeed RSS description snippet (often "Location: City, State"). */
function extractLocationFromSnippet(description: string): string | null {
  const m = description.match(/<b>Location(?:s)?<\/b>:\s*([^<\n]+)/i)
  if (m) return clean(m[1])
  return null
}

/**
 * Parse the Indeed RSS XML into JobCard objects.
 * Splits on <item> boundaries; one malformed item cannot break the rest.
 */
export function parseRssItems(xml: string): JobCard[] {
  const results: JobCard[] = []
  const itemChunks = xml.split(/<item[^>]*>/).slice(1)

  for (const chunk of itemChunks) {
    // Job key from guid (canonical)
    const guidMatch = chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)
    const guidRaw = guidMatch ? decodeHtmlEntities(guidMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()) : ""
    const id = extractJobKey(guidRaw)
    if (!id) continue

    // Title
    const titleMatch = chunk.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)
    const title = titleMatch ? clean(titleMatch[1]) : null
    if (!title) continue

    // Company and company URL from <source url="...">Company</source>
    const sourceMatch = chunk.match(/<source\s+url="([^"]*)"[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/i)
    const company = sourceMatch ? clean(sourceMatch[2]) || null : null
    const companyUrl = sourceMatch && sourceMatch[1] ? sourceMatch[1].trim() || null : null

    // Date from pubDate
    const dateMatch = chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
    const date = dateMatch ? parseRssDate(dateMatch[1].trim()) : null

    // Description snippet
    const descMatch = chunk.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
    const rawDescription = descMatch ? descMatch[1] : ""
    const location = extractLocationFromSnippet(rawDescription)
    const snippet = rawDescription ? clean(rawDescription).slice(0, 200) || null : null

    const url = `https://www.indeed.com/viewjob?jk=${id}`

    results.push({ id, title, company, companyUrl, location, date, url, snippet })
  }

  return results
}

/** Parse the JSON-LD JobPosting from an Indeed detail page. */
export function parseJobDetail(html: string, id: string): JobDetail {
  let title: string = "(untitled)"
  let company: string | null = null
  let companyUrl: string | null = null
  let location: string | null = null
  let date: string | null = null
  let deadline: string | null = null
  let employmentType: string | null = null
  let description: string | null = null

  // Extract JSON-LD block
  const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]) as Record<string, unknown>
      if (typeof ld["title"] === "string") title = ld["title"]
      if (typeof ld["datePosted"] === "string") date = ld["datePosted"].slice(0, 10)
      if (typeof ld["validThrough"] === "string") deadline = ld["validThrough"].slice(0, 10)
      if (typeof ld["employmentType"] === "string") {
        // Normalise ALL_CAPS schema.org values to readable form
        employmentType = ld["employmentType"].replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
      }

      const org = ld["hiringOrganization"] as Record<string, unknown> | undefined
      if (org) {
        if (typeof org["name"] === "string") company = org["name"] || null
        if (typeof org["sameAs"] === "string") companyUrl = org["sameAs"] || null
      }

      const jobLoc = ld["jobLocation"] as Record<string, unknown> | undefined
      if (jobLoc) {
        const addr = jobLoc["address"] as Record<string, unknown> | undefined
        if (addr) {
          const parts = [addr["addressLocality"], addr["addressRegion"], addr["addressCountry"]]
            .filter((p): p is string => typeof p === "string" && p.length > 0)
          if (parts.length > 0) location = parts.join(", ")
        }
      }

      if (typeof ld["description"] === "string") {
        const withBreaks = ld["description"]
          .replace(/<\s*br\s*\/?>/gi, "\n")
          .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
        description = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim() || null
      }
    } catch {
      // JSON-LD parse failed; fall through to HTML fallback
    }
  }

  // Fallback: extract description from #jobDescriptionText div
  if (!description) {
    const divMatch = html.match(/<div[^>]+id="jobDescriptionText"[^>]*>([\s\S]*?)<\/div>/i)
    if (divMatch) {
      const withBreaks = divMatch[1]
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
      description = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim() || null
    }
  }

  return {
    id,
    title,
    company,
    companyUrl,
    location,
    date,
    url: `https://www.indeed.com/viewjob?jk=${id}`,
    snippet: null,
    description,
    employmentType,
    deadline,
  }
}
