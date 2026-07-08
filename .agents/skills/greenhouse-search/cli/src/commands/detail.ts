import {
  API_BASE,
  jsonFetch,
  normaliseDetail,
  writeError,
  NotFoundError,
  type GHJobDetail,
} from "../helpers.js"

export interface DetailOpts {
  company: string
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const numId = parseInt(opts.id, 10)
  if (isNaN(numId) || numId <= 0) {
    writeError(`Invalid job ID "${opts.id}" — expected a positive integer`, "BAD_ID")
    return 1
  }

  try {
    const url = `${API_BASE}/${encodeURIComponent(opts.company)}/jobs/${numId}`
    const raw = await jsonFetch<GHJobDetail>(url)
    const job = normaliseDetail(raw)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        job.department ? `Department: ${job.department}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.deadline ? `Deadline: ${job.deadline}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    if (e instanceof NotFoundError) {
      writeError(`Job ${opts.id} not found on board "${opts.company}"`, "NOT_FOUND")
    } else {
      writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    }
    return 1
  }
}
