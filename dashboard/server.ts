#!/usr/bin/env bun
// Job Search Dashboard — local HTTP server.
// Serves the UI and a small REST API for reading/updating job state.
// Usage: bun run dashboard/server.ts
//        DASHBOARD_PORT=3001 bun run dashboard/server.ts

import { join, dirname } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"

const ROOT = join(dirname(import.meta.path), "..")
const SEEN_JOBS_PATH = join(ROOT, "job_scraper", "seen_jobs.json")
const TRACKER_PATH = join(ROOT, "job_search_tracker.csv")
const CLAUDE_MD_PATH = join(ROOT, "CLAUDE.md")
const PORT = parseInt(process.env.DASHBOARD_PORT ?? "3000", 10)

// ── helpers ──────────────────────────────────────────────────────────────────

function readSeenJobs(): Record<string, unknown> {
  if (!existsSync(SEEN_JOBS_PATH)) return { seen: {} }
  try { return JSON.parse(readFileSync(SEEN_JOBS_PATH, "utf8")) } catch { return { seen: {} } }
}

function writeSeenJobs(data: Record<string, unknown>): void {
  mkdirSync(join(ROOT, "job_scraper"), { recursive: true })
  writeFileSync(SEEN_JOBS_PATH, JSON.stringify(data, null, 2) + "\n")
}

function readTracker(): Record<string, string>[] {
  if (!existsSync(TRACKER_PATH)) return []
  const lines = readFileSync(TRACKER_PATH, "utf8").trim().split("\n")
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).filter(Boolean).map(l => {
    const vals = parseCSVLine(l)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]))
  })
}

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = "", inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ } else if (c === "," && !inQ) { out.push(cur); cur = "" } else { cur += c }
  }
  out.push(cur)
  return out
}

function extractCandidateName(): string {
  if (!existsSync(CLAUDE_MD_PATH)) return "Candidate"
  const first = readFileSync(CLAUDE_MD_PATH, "utf8").split("\n").find(l => l.startsWith("# "))
  return first ? first.replace(/^# Job Application Assistant for\s*/i, "").trim() : "Candidate"
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  })
}

// ── request handler ───────────────────────────────────────────────────────────

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname

  // API routes
  if (path === "/api/jobs" && req.method === "GET") {
    const data = readSeenJobs()
    const seen = (data.seen ?? {}) as Record<string, Record<string, unknown>>
    const jobs = Object.entries(seen).map(([url, job]) => ({ url, ...job }))
    return json({ jobs, total: jobs.length })
  }

  if (path.startsWith("/api/jobs/") && req.method === "PATCH") {
    const jobUrl = decodeURIComponent(path.replace("/api/jobs/", ""))
    const body = await req.json() as Record<string, string>
    const data = readSeenJobs()
    const seen = data.seen as Record<string, Record<string, unknown>>
    if (!seen[jobUrl]) return json({ error: "not found" }, 404)
    seen[jobUrl] = { ...seen[jobUrl], ...body }
    writeSeenJobs(data)
    return json({ ok: true })
  }

  if (path === "/api/tracker" && req.method === "GET") {
    return json({ rows: readTracker() })
  }

  if (path === "/api/meta" && req.method === "GET") {
    return json({ candidate: extractCandidateName(), lastUpdated: new Date().toISOString() })
  }

  // Serve dashboard UI for all other GET requests
  if (req.method === "GET") {
    return new Response(HTML, { headers: { "Content-Type": "text/html" } })
  }

  return json({ error: "not found" }, 404)
}

// ── HTML UI ───────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Job Search Dashboard</title>
<style>
  :root {
    --bg: #f8fafc; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a;
    --muted: #64748b; --accent: #4f46e5; --accent-hover: #4338ca;
    --high: #16a34a; --high-bg: #dcfce7; --med: #d97706; --med-bg: #fef3c7;
    --low: #94a3b8; --low-bg: #f1f5f9;
    --new-bg: #dbeafe; --new-text: #1d4ed8;
    --applied-bg: #dcfce7; --applied-text: #15803d;
    --skip-bg: #f1f5f9; --skip-text: #64748b;
    --row-hover: #f8fafc;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f172a; --surface: #1e293b; --border: #334155; --text: #f1f5f9;
      --muted: #94a3b8; --accent: #818cf8; --accent-hover: #6366f1;
      --high: #4ade80; --high-bg: #14532d; --med: #fbbf24; --med-bg: #451a03;
      --low: #64748b; --low-bg: #1e293b;
      --new-bg: #1e3a5f; --new-text: #93c5fd;
      --applied-bg: #14532d; --applied-text: #86efac;
      --skip-bg: #1e293b; --skip-text: #64748b;
      --row-hover: #273549;
    }
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); font-size: 14px; }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }

  /* Layout */
  .app { display: flex; flex-direction: column; min-height: 100vh; }
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .logo { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .candidate-name { font-size: 13px; color: var(--muted); border-left: 1px solid var(--border); padding-left: 12px; }
  .refresh-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; transition: background 0.15s; }
  .refresh-btn:hover { background: var(--accent-hover); }

  /* Stats */
  .stats { display: flex; gap: 12px; padding: 16px 24px; flex-wrap: wrap; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 18px; min-width: 110px; }
  .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .stat-value { font-size: 26px; font-weight: 700; line-height: 1; }
  .stat-value.high { color: var(--high); }
  .stat-value.med { color: var(--med); }
  .stat-value.low { color: var(--low); }

  /* Filters */
  .filters { display: flex; gap: 10px; padding: 0 24px 14px; flex-wrap: wrap; align-items: center; }
  .filters input, .filters select {
    background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 10px; font-size: 13px; color: var(--text);
    outline: none; transition: border-color 0.15s;
  }
  .filters input { width: 220px; }
  .filters input:focus, .filters select:focus { border-color: var(--accent); }
  .filters label { font-size: 12px; color: var(--muted); }

  /* Tabs */
  .tabs { display: flex; gap: 0; padding: 0 24px; border-bottom: 1px solid var(--border); }
  .tab { padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; color: var(--muted); transition: all 0.15s; }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover:not(.active) { color: var(--text); }

  /* Table */
  .table-wrap { padding: 0 24px 24px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); padding: 8px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:hover td { background: var(--row-hover); }
  .empty { text-align: center; color: var(--muted); padding: 48px; }

  /* Badges */
  .fit-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .fit-high { background: var(--high-bg); color: var(--high); }
  .fit-medium { background: var(--med-bg); color: var(--med); }
  .fit-low { background: var(--low-bg); color: var(--low); }
  .src-badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; background: var(--low-bg); color: var(--muted); }

  /* Status select */
  .status-sel { background: var(--surface); border: 1px solid var(--border); border-radius: 5px; padding: 3px 6px; font-size: 12px; color: var(--text); cursor: pointer; }
  .status-new { background: var(--new-bg); color: var(--new-text); border-color: transparent; }
  .status-applied { background: var(--applied-bg); color: var(--applied-text); border-color: transparent; }
  .status-skipped { background: var(--skip-bg); color: var(--skip-text); border-color: transparent; }
  .status-evaluated { background: var(--med-bg); color: var(--med); border-color: transparent; }

  /* Tracker section */
  .section-title { font-size: 15px; font-weight: 600; padding: 20px 24px 0; }

  /* Loading */
  .loading { text-align: center; padding: 60px; color: var(--muted); }
  .spinner { display: inline-block; width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; margin-bottom: 12px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="header-left">
      <div class="logo">Job Search</div>
      <div class="candidate-name" id="candidateName">Loading…</div>
    </div>
    <button class="refresh-btn" onclick="loadAll()">↻ Refresh</button>
  </header>

  <div class="stats" id="stats"></div>

  <div class="filters">
    <input type="search" id="searchInput" placeholder="Search title or company…" oninput="renderTable()">
    <label>Fit
      <select id="fitFilter" onchange="renderTable()">
        <option value="">All</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
    <label>Source
      <select id="sourceFilter" onchange="renderTable()">
        <option value="">All</option>
        <option value="linkedin">LinkedIn</option>
        <option value="indeed">Indeed</option>
        <option value="greenhouse">Greenhouse</option>
        <option value="usajobs">USAJobs</option>
      </select>
    </label>
    <label>Status
      <select id="statusFilter" onchange="renderTable()">
        <option value="">All</option>
        <option value="new">New</option>
        <option value="evaluated">Evaluated</option>
        <option value="applied">Applied</option>
        <option value="skipped">Skipped</option>
      </select>
    </label>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('leads', this)">Leads</div>
    <div class="tab" onclick="switchTab('tracker', this)">Applications</div>
  </div>

  <div id="leadsView">
    <div class="table-wrap">
      <div class="loading" id="loadingEl"><div class="spinner"></div><br>Loading jobs…</div>
      <table id="jobTable" style="display:none">
        <thead>
          <tr>
            <th>Fit</th><th>Title</th><th>Company</th><th>Location</th>
            <th>Source</th><th>Date</th><th>Deadline</th><th>Status</th>
          </tr>
        </thead>
        <tbody id="jobBody"></tbody>
      </table>
      <div class="empty" id="emptyEl" style="display:none">No jobs match your filters.</div>
    </div>
  </div>

  <div id="trackerView" style="display:none">
    <div class="section-title">Application Tracker</div>
    <div class="table-wrap">
      <table id="trackerTable">
        <thead><tr id="trackerHead"></tr></thead>
        <tbody id="trackerBody"></tbody>
      </table>
      <div class="empty" id="trackerEmpty" style="display:none">No applications tracked yet.</div>
    </div>
  </div>
</div>

<script>
let allJobs = []
let trackerRows = []
let currentTab = 'leads'

async function loadAll() {
  try {
    const [metaRes, jobsRes, trackerRes] = await Promise.all([
      fetch('/api/meta'), fetch('/api/jobs'), fetch('/api/tracker')
    ])
    const meta = await metaRes.json()
    const jobsData = await jobsRes.json()
    const trackerData = await trackerRes.json()

    document.getElementById('candidateName').textContent = meta.candidate

    allJobs = jobsData.jobs || []
    trackerRows = trackerData.rows || []

    renderStats()
    renderTable()
    renderTracker()

    document.getElementById('loadingEl').style.display = 'none'
    document.getElementById('jobTable').style.display = 'table'
  } catch(e) {
    document.getElementById('loadingEl').innerHTML = '<b>Error loading data.</b> Is the server running?'
  }
}

function renderStats() {
  const total = allJobs.length
  const high = allJobs.filter(j => j.fit === 'high').length
  const med = allJobs.filter(j => j.fit === 'medium').length
  const low = allJobs.filter(j => j.fit === 'low').length
  const newCount = allJobs.filter(j => j.status === 'new').length
  const applied = trackerRows.length

  document.getElementById('stats').innerHTML = \`
    <div class="stat-card"><div class="stat-label">Total Seen</div><div class="stat-value">\${total}</div></div>
    <div class="stat-card"><div class="stat-label">New</div><div class="stat-value" style="color:var(--new-text)">\${newCount}</div></div>
    <div class="stat-card"><div class="stat-label">High Fit</div><div class="stat-value high">\${high}</div></div>
    <div class="stat-card"><div class="stat-label">Medium Fit</div><div class="stat-value med">\${med}</div></div>
    <div class="stat-card"><div class="stat-label">Low Fit</div><div class="stat-value low">\${low}</div></div>
    <div class="stat-card"><div class="stat-label">Applications</div><div class="stat-value" style="color:var(--applied-text)">\${applied}</div></div>
  \`
}

function fitOrder(f) { return f === 'high' ? 0 : f === 'medium' ? 1 : 2 }

function renderTable() {
  const q = document.getElementById('searchInput').value.toLowerCase()
  const fit = document.getElementById('fitFilter').value
  const src = document.getElementById('sourceFilter').value
  const status = document.getElementById('statusFilter').value

  let filtered = allJobs.filter(j => {
    if (fit && j.fit !== fit) return false
    if (src && j.source !== src) return false
    if (status && j.status !== status) return false
    if (q && !((j.title||'').toLowerCase().includes(q) || (j.company||'').toLowerCase().includes(q))) return false
    return true
  })

  filtered.sort((a, b) => fitOrder(a.fit) - fitOrder(b.fit) || (b.first_seen||'').localeCompare(a.first_seen||''))

  const tbody = document.getElementById('jobBody')
  const empty = document.getElementById('emptyEl')
  const table = document.getElementById('jobTable')

  if (filtered.length === 0) {
    table.style.display = 'none'
    empty.style.display = 'block'
    return
  }
  table.style.display = 'table'
  empty.style.display = 'none'

  tbody.innerHTML = filtered.map(j => {
    const fitClass = j.fit === 'high' ? 'high' : j.fit === 'medium' ? 'medium' : 'low'
    const fitLabel = j.fit ? (j.fit.charAt(0).toUpperCase() + j.fit.slice(1)) : '—'
    const statusClass = 'status-' + (j.status || 'new')
    const encodedUrl = encodeURIComponent(j.url || '')
    return \`<tr>
      <td><span class="fit-badge fit-\${fitClass}">\${fitLabel}</span></td>
      <td><a href="\${escHtml(j.url||'#')}" target="_blank" rel="noopener">\${escHtml(j.title||'—')}</a></td>
      <td>\${escHtml(j.company||'—')}</td>
      <td style="color:var(--muted);font-size:12px">\${escHtml(j.location||'—')}</td>
      <td><span class="src-badge">\${escHtml(j.source||'—')}</span></td>
      <td style="color:var(--muted);font-size:12px;white-space:nowrap">\${escHtml(j.first_seen||'—')}</td>
      <td style="color:var(--muted);font-size:12px;white-space:nowrap">\${escHtml(j.deadline||'—')}</td>
      <td>
        <select class="status-sel \${statusClass}" onchange="updateStatus('\${encodedUrl}', this)">
          <option value="new" \${j.status==='new'?'selected':''}>New</option>
          <option value="evaluated" \${j.status==='evaluated'?'selected':''}>Evaluated</option>
          <option value="applied" \${j.status==='applied'?'selected':''}>Applied</option>
          <option value="skipped" \${j.status==='skipped'?'selected':''}>Skipped</option>
          <option value="ranked" \${j.status==='ranked'?'selected':''}>Ranked</option>
        </select>
      </td>
    </tr>\`
  }).join('')
}

function renderTracker() {
  const head = document.getElementById('trackerHead')
  const body = document.getElementById('trackerBody')
  const empty = document.getElementById('trackerEmpty')

  if (trackerRows.length === 0) {
    empty.style.display = 'block'
    return
  }
  empty.style.display = 'none'
  const cols = Object.keys(trackerRows[0])
  head.innerHTML = cols.map(c => \`<th>\${escHtml(c)}</th>\`).join('')
  body.innerHTML = trackerRows.map(row =>
    '<tr>' + cols.map(c => \`<td>\${escHtml(row[c]||'')}</td>\`).join('') + '</tr>'
  ).join('')
}

async function updateStatus(encodedUrl, sel) {
  const jobUrl = decodeURIComponent(encodedUrl)
  const newStatus = sel.value
  sel.className = 'status-sel status-' + newStatus
  try {
    await fetch('/api/jobs/' + encodedUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    const job = allJobs.find(j => j.url === jobUrl)
    if (job) job.status = newStatus
    renderStats()
  } catch(e) { console.error('Failed to update status', e) }
}

function switchTab(tab, el) {
  currentTab = tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  el.classList.add('active')
  document.getElementById('leadsView').style.display = tab === 'leads' ? '' : 'none'
  document.getElementById('trackerView').style.display = tab === 'tracker' ? '' : 'none'
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

loadAll()
</script>
</body>
</html>`

// ── start server ──────────────────────────────────────────────────────────────

const server = Bun.serve({ port: PORT, fetch: handle })
console.log(`\nJob Search Dashboard running at http://localhost:${PORT}\n`)
console.log(`  Reads:  ${SEEN_JOBS_PATH}`)
console.log(`          ${TRACKER_PATH}`)
console.log(`\nPress Ctrl+C to stop.\n`)
