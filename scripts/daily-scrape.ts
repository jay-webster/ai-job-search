#!/usr/bin/env bun
// Daily job scraper — runs CLI tools, deduplicates, sends email digest.
// Requires: RESEND_API_KEY and NOTIFY_EMAIL in environment (or .env file).
// Schedule: scripts/install-schedule.sh
// Manual run: bun run scripts/daily-scrape.ts

import { join, dirname } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs"

const ROOT = join(dirname(import.meta.path), "..")
const BUN = process.execPath
const SEEN_JOBS_PATH = join(ROOT, "job_scraper", "seen_jobs.json")
const QUERIES_PATH = join(ROOT, ".claude/skills/job-scraper/search-queries.md")
const LOG_DIR = join(ROOT, "logs")
const LOG_PATH = join(LOG_DIR, "daily-scrape.log")

// Load .env if present (for manual runs)
const envFile = join(ROOT, ".env")
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

// ── logging ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  mkdirSync(LOG_DIR, { recursive: true })
  appendFileSync(LOG_PATH, line + "\n")
}

// ── config parsing ────────────────────────────────────────────────────────────

interface SearchConfig {
  location: string
  keywords: string[]
  companies: string[]
  ghQuery: string
  jobage: number
}

function parseConfig(): SearchConfig {
  if (!existsSync(QUERIES_PATH)) {
    log("WARN: search-queries.md not found — using defaults")
    return { location: "United States", keywords: ["Chief Technology Officer"], companies: [], ghQuery: "chief", jobage: 1 }
  }
  const text = readFileSync(QUERIES_PATH, "utf8")

  const location = text.match(/PRIMARY_LOCATION=(.+)/)?.[1]?.trim() ?? "United States"

  const keywords: string[] = []
  for (const m of text.matchAll(/^KEYWORDS_P\d+=(.+)$/gm)) {
    keywords.push(m[1].trim())
  }

  const companies: string[] = []
  const companiesBlock = text.match(/GREENHOUSE_COMPANIES=\s*([\s\S]+?)(?=\n```|\nGREENHOUSE_QUERY|$)/)
  if (companiesBlock) {
    for (const line of companiesBlock[1].split("\n")) {
      const slug = line.replace(/#.*$/, "").trim()
      if (slug && /^[a-z0-9-]+$/.test(slug)) companies.push(slug)
    }
  }

  const ghQuery = text.match(/GREENHOUSE_QUERY=(.+)/)?.[1]?.trim() ?? "chief"
  const jobage = 1 // daily run — only look at last 24h; seen_jobs.json handles dedup for older results

  return { location, keywords, companies, ghQuery, jobage }
}

// ── subprocess helper ─────────────────────────────────────────────────────────

interface JobCard {
  id: string
  title: string
  company: string
  companyUrl?: string
  location: string
  date?: string
  url: string
  source?: string
}

async function runCLI(args: string[]): Promise<JobCard[]> {
  return new Promise((resolve) => {
    const proc = Bun.spawn([BUN, "run", ...args], {
      env: { ...process.env, PATH: `${dirname(BUN)}:${process.env.PATH}` },
      stdout: "pipe",
      stderr: "pipe",
    })

    let out = ""
    const reader = proc.stdout.getReader()
    const read = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        out += new TextDecoder().decode(value)
      }
    }

    read().then(async () => {
      await proc.exited
      try {
        const parsed = JSON.parse(out)
        resolve(parsed.results ?? [])
      } catch {
        resolve([])
      }
    }).catch(() => resolve([]))
  })
}

// ── seen jobs ─────────────────────────────────────────────────────────────────

function loadSeen(): Record<string, Record<string, unknown>> {
  if (!existsSync(SEEN_JOBS_PATH)) return {}
  try {
    return (JSON.parse(readFileSync(SEEN_JOBS_PATH, "utf8")).seen ?? {}) as Record<string, Record<string, unknown>>
  } catch { return {} }
}

function saveSeen(seen: Record<string, Record<string, unknown>>) {
  mkdirSync(join(ROOT, "job_scraper"), { recursive: true })
  writeFileSync(SEEN_JOBS_PATH, JSON.stringify({ seen }, null, 2) + "\n")
}

// ── email ─────────────────────────────────────────────────────────────────────

function buildEmailHtml(newJobs: JobCard[], date: string, candidateName: string): string {
  const rows = newJobs.map(j => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">
        <a href="${j.url}" style="color:#4f46e5;text-decoration:none;font-weight:600">${j.title}</a>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#374151">${j.company}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#6b7280;font-size:13px">${j.location}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">
        <span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase">${j.source ?? "—"}</span>
      </td>
    </tr>`).join("")

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#4f46e5;padding:24px 32px">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Job Search</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:14px">${candidateName} · ${date}</p>
    </div>
    <div style="padding:24px 32px">
      <p style="margin:0 0 20px;color:#374151;font-size:15px">
        <strong>${newJobs.length} new lead${newJobs.length === 1 ? "" : "s"}</strong> found since yesterday.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;border-bottom:2px solid #e2e8f0">Title</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;border-bottom:2px solid #e2e8f0">Company</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;border-bottom:2px solid #e2e8f0">Location</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;border-bottom:2px solid #e2e8f0">Source</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #f1f5f9">
      <p style="margin:0;color:#9ca3af;font-size:12px">
        Sent by ai-job-search daily scraper ·
        <a href="https://github.com/jay-webster/ai-job-search" style="color:#9ca3af">github</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    log("RESEND_API_KEY not set — skipping email (results still saved to seen_jobs.json)")
    return
  }

  const from = process.env.EMAIL_FROM ?? "Job Search <onboarding@resend.dev>"

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
  log(`Email sent → ${to}`)
}

// ── candidate name ────────────────────────────────────────────────────────────

function candidateName(): string {
  const claudeMd = join(ROOT, "CLAUDE.md")
  if (!existsSync(claudeMd)) return "Candidate"
  const first = readFileSync(claudeMd, "utf8").split("\n").find(l => l.startsWith("# "))
  return first?.replace(/^# Job Application Assistant for\s*/i, "").trim() ?? "Candidate"
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date()
  log(`=== Daily scrape started ===`)

  const config = parseConfig()
  log(`Config: location="${config.location}", keywords=${config.keywords.length}, companies=${config.companies.length}`)

  const seen = loadSeen()
  const allResults: JobCard[] = []

  // LinkedIn — run for each P1 + P2 keyword
  for (const kw of config.keywords.slice(0, 2)) {
    log(`LinkedIn search: "${kw}"`)
    try {
      const results = await runCLI([
        join(ROOT, ".agents/skills/linkedin-search/cli/src/cli.ts"),
        "search", "--query", kw, "--location", "United States", "--age", String(config.jobage), "--limit", "25"
      ])
      log(`  → ${results.length} results`)
      allResults.push(...results.map(r => ({ ...r, source: "linkedin" })))
    } catch (e) {
      log(`  LinkedIn error: ${e}`)
    }
  }

  // Greenhouse — check each target company
  if (config.companies.length > 0) {
    log(`Greenhouse: checking ${config.companies.length} companies`)
    const ghResults = await Promise.allSettled(
      config.companies.map(slug =>
        runCLI([
          join(ROOT, ".agents/skills/greenhouse-search/cli/src/cli.ts"),
          "search", "--company", slug, "--query", config.ghQuery, "--age", "30", "--limit", "10"
        ]).then(r => r.map(j => ({ ...j, source: "greenhouse" })))
      )
    )
    for (const r of ghResults) {
      if (r.status === "fulfilled") allResults.push(...r.value)
    }
    log(`  → ${allResults.filter(j => j.source === "greenhouse").length} Greenhouse results`)
  }

  // USAJobs — only if API key is present
  if (process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL) {
    log(`USAJobs search`)
    try {
      const results = await runCLI([
        join(ROOT, ".agents/skills/usajobs-search/cli/src/cli.ts"),
        "search", "--query", config.keywords[0] ?? "Chief Technology Officer", "--age", String(config.jobage), "--limit", "10"
      ])
      log(`  → ${results.length} results`)
      allResults.push(...results.map(r => ({ ...r, source: "usajobs" })))
    } catch (e) {
      log(`  USAJobs error: ${e}`)
    }
  }

  log(`Total raw results: ${allResults.length}`)

  // Deduplicate
  const newJobs: JobCard[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const job of allResults) {
    if (!job.url) continue
    if (seen[job.url]) continue
    // Also skip obvious duplicates by title+company
    const key = `${job.title?.toLowerCase()}|${job.company?.toLowerCase()}`
    if (newJobs.some(j => `${j.title?.toLowerCase()}|${j.company?.toLowerCase()}` === key)) continue
    newJobs.push(job)
    seen[job.url] = {
      title: job.title,
      company: job.company,
      source: job.source,
      location: job.location,
      url: job.url,
      first_seen: today,
      fit: "new",
      status: "new",
    }
  }

  log(`New results (not previously seen): ${newJobs.length}`)

  // Save updated seen_jobs.json
  saveSeen(seen)
  log(`seen_jobs.json updated (${Object.keys(seen).length} total entries)`)

  if (newJobs.length === 0) {
    log("No new results — skipping email")
    log(`=== Done in ${Date.now() - startedAt.getTime()}ms ===\n`)
    return
  }

  // Send email
  const notifyEmail = process.env.NOTIFY_EMAIL
  if (!notifyEmail) {
    log("NOTIFY_EMAIL not set — skipping email")
  } else {
    const name = candidateName()
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    const subject = `[Job Search] ${newJobs.length} new lead${newJobs.length === 1 ? "" : "s"} — ${name}`
    const html = buildEmailHtml(newJobs, dateStr, name)
    try {
      await sendEmail(notifyEmail, subject, html)
    } catch (e) {
      log(`Email failed: ${e}`)
    }
  }

  log(`=== Done in ${Date.now() - startedAt.getTime()}ms ===\n`)
}

main().catch(e => {
  log(`FATAL: ${e}`)
  process.exit(1)
})
