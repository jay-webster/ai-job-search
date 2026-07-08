// Data source: Greenhouse Boards public REST API.
// https://boards-api.greenhouse.io/v1/boards/{company}/jobs
// Public by design — companies expose this for their career page embeds.
// No authentication, no rate limiting, clean JSON responses throughout.

export const API_BASE = "https://boards-api.greenhouse.io/v1/boards"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

/** Fetch JSON from Greenhouse API with exponential backoff on 429/5xx. */
export async function jsonFetch<T>(url: string): Promise<T> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; job-search-cli/1.0)",
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
    if (response.status === 404) {
      throw new NotFoundError()
    }
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
  }
  throw new Error("Request failed after max retries")
}

export class NotFoundError extends Error {
  constructor() {
    super("Not found")
  }
}

// Raw shapes returned by the Greenhouse API
interface GHLocation {
  name: string
}

interface GHDepartment {
  id: number
  name: string
}

interface GHOffice {
  id: number
  name: string
  location: GHLocation | null
}

export interface GHJobCard {
  id: number
  title: string
  company_name: string
  location: GHLocation
  first_published: string
  updated_at: string
  application_deadline: string | null
  absolute_url: string
  departments: GHDepartment[]
  offices: GHOffice[]
}

export interface GHJobDetail extends GHJobCard {
  content: string       // HTML-entity-encoded job description
  requisition_id: string | null
}

export interface GHListResponse {
  jobs: GHJobCard[]
  meta?: { total: number }
}

// Normalised output shapes (matches the repo's JobCard contract)
export interface JobCard {
  id: string
  title: string
  company: string | null
  companyUrl: null          // Greenhouse API doesn't expose a company URL in the board
  location: string | null
  date: string | null
  deadline: string | null
  department: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
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

/** Convert ISO 8601 timestamp to YYYY-MM-DD. */
function toDate(iso: string): string | null {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

export function normaliseCard(job: GHJobCard): JobCard {
  return {
    id: String(job.id),
    title: job.title,
    company: job.company_name || null,
    companyUrl: null,
    location: job.location?.name || null,
    date: job.first_published ? toDate(job.first_published) : null,
    deadline: job.application_deadline ? toDate(job.application_deadline) : null,
    department: job.departments?.[0]?.name || null,
    url: job.absolute_url,
  }
}

export function normaliseDetail(job: GHJobDetail): JobDetail {
  const card = normaliseCard(job)

  let description: string | null = null
  if (job.content) {
    // content is HTML with HTML-entity-encoded tags (e.g. &lt;p&gt;)
    const decoded = decodeHtmlEntities(job.content)
    const withBreaks = decoded
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    description = stripTags(withBreaks).replace(/\n{3,}/g, "\n\n").trim() || null
  }

  return { ...card, description }
}

/** Client-side title keyword filter (case-insensitive, all words must match). */
export function matchesQuery(job: JobCard, query: string): boolean {
  const q = query.toLowerCase()
  const title = job.title.toLowerCase()
  return q.split(/\s+/).every((word) => title.includes(word))
}

/** Client-side location filter (case-insensitive substring). */
export function matchesLocation(job: JobCard, location: string): boolean {
  if (!job.location) return false
  return job.location.toLowerCase().includes(location.toLowerCase())
}

/** Client-side age filter: keep jobs first published within the last N days. */
export function withinDays(job: JobCard, days: number): boolean {
  if (!job.date) return true   // no date = include by default
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return new Date(job.date) >= cutoff
}
