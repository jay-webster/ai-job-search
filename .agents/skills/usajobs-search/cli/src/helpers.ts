// Data source: USAJobs official developer API.
// https://developer.usajobs.gov/
// Requires free registration at https://developer.usajobs.gov/apirequest/
// Auth: Authorization-Key header + User-Agent set to registered email.

export const SEARCH_URL = "https://data.usajobs.gov/api/search"
export const DETAIL_BASE = "https://www.usajobs.gov/GetJob/ViewDetails"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export function getAuth(): { apiKey: string; email: string } | null {
  const apiKey = process.env.USAJOBS_API_KEY?.trim()
  const email = process.env.USAJOBS_EMAIL?.trim()

  if (!apiKey) {
    writeError(
      "USAJOBS_API_KEY is not set. Register for a free key at https://developer.usajobs.gov/apirequest/ then add:\n  export USAJOBS_API_KEY=\"your-key\"\n  export USAJOBS_EMAIL=\"your@email.com\"\nto your ~/.zshrc and reload.",
      "NO_API_KEY",
    )
    return null
  }
  if (!email) {
    writeError(
      "USAJOBS_EMAIL is not set. Set it to the email you registered with:\n  export USAJOBS_EMAIL=\"your@email.com\"",
      "NO_EMAIL",
    )
    return null
  }
  return { apiKey, email }
}

export class NotFoundError extends Error {
  constructor() {
    super("Not found")
  }
}

export class AuthError extends Error {
  constructor(status: number) {
    super(`API authentication failed (${status}). Check USAJOBS_API_KEY and USAJOBS_EMAIL.`)
  }
}

export async function jsonFetch<T>(url: string, auth: { apiKey: string; email: string }): Promise<T> {
  const maxRetries = 4
  let delay = 1000
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "Authorization-Key": auth.apiKey,
        "User-Agent": auth.email,
        Accept: "application/json",
        Host: "data.usajobs.gov",
      },
    })

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(response.status)
    }
    if (response.status === 404) {
      throw new NotFoundError()
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
  }
  throw new Error("Request failed after max retries")
}

export async function htmlFetch(url: string): Promise<string> {
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
  return response.text()
}

// Raw API response shapes
interface USALocation {
  LocationName: string
}

interface USARemuneration {
  MinimumRange: string
  MaximumRange: string
  RateIntervalCode: string
  Description: string
}

interface USADetails {
  JobSummary?: string
  LowGrade?: string
  HighGrade?: string
  RemoteJob?: string
  Telework?: string
  WhoMayApply?: { Name: string; Code: string }
}

export interface USADescriptor {
  PositionTitle: string
  OrganizationName: string
  DepartmentName?: string
  PositionLocation: USALocation[]
  PublicationStartDate?: string
  ApplicationCloseDate?: string
  PositionURI: string
  QualificationSummary?: string
  PositionRemuneration?: USARemuneration[]
  UserArea?: { Details?: USADetails }
}

export interface USAItem {
  MatchedObjectId: string
  MatchedObjectDescriptor: USADescriptor
}

export interface USASearchResponse {
  SearchResult: {
    SearchResultCount: number
    SearchResultCountAll: number
    SearchResultItems: USAItem[]
  }
}

// Normalised output shapes
export interface JobCard {
  id: string
  title: string
  company: string | null    // agency
  companyUrl: null
  location: string | null
  date: string | null
  deadline: string | null
  url: string
  salary: string | null
  grade: string | null
  remote: boolean
  telework: string | null
  whoMayApply: string | null
}

export interface JobDetail extends JobCard {
  department: string | null
  description: string | null
  qualifications: string | null
}

function toDate(iso: string | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

function cleanUrl(raw: string): string {
  // Strip :443 port that USAJobs sometimes includes
  return raw.replace(/:443(?=\/)/, "")
}

function formatSalary(rem: USARemuneration[] | undefined): string | null {
  if (!rem || rem.length === 0) return null
  const r = rem[0]
  const min = parseFloat(r.MinimumRange)
  const max = parseFloat(r.MaximumRange)
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`
  const interval = r.RateIntervalCode === "PA" ? "/yr" : r.RateIntervalCode === "PH" ? "/hr" : ""
  if (isNaN(min) || isNaN(max)) return null
  return `${fmt(min)}–${fmt(max)}${interval}`
}

function formatGrade(details: USADetails | undefined): string | null {
  if (!details?.LowGrade) return null
  const lo = details.LowGrade
  const hi = details.HighGrade
  if (hi && hi !== lo) return `GS-${lo}/${hi}`
  return `GS-${lo}`
}

export function normaliseCard(item: USAItem): JobCard {
  const d = item.MatchedObjectDescriptor
  const details = d.UserArea?.Details
  return {
    id: item.MatchedObjectId,
    title: d.PositionTitle,
    company: d.OrganizationName || null,
    companyUrl: null,
    location: d.PositionLocation?.[0]?.LocationName || null,
    date: toDate(d.PublicationStartDate),
    deadline: toDate(d.ApplicationCloseDate),
    url: cleanUrl(d.PositionURI),
    salary: formatSalary(d.PositionRemuneration),
    grade: formatGrade(details),
    remote: details?.RemoteJob?.toLowerCase() === "true",
    telework: details?.Telework || null,
    whoMayApply: details?.WhoMayApply?.Name || null,
  }
}

export function normaliseDetail(item: USAItem): JobDetail {
  const card = normaliseCard(item)
  const d = item.MatchedObjectDescriptor
  const details = d.UserArea?.Details
  return {
    ...card,
    department: d.DepartmentName || null,
    description: details?.JobSummary?.trim() || null,
    qualifications: d.QualificationSummary?.trim() || null,
  }
}
