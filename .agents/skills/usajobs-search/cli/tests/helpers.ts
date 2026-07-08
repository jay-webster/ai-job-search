import { join } from "path"

const CLI_PATH = join(import.meta.dir, "../src/cli.ts")

export interface CLIResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function runCLI(args: string[], env?: Record<string, string>): Promise<CLIResult> {
  const proc = Bun.spawn([process.execPath, "run", CLI_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    // Merge provided env with a clean base — strip USAJOBS_* by default so
    // tests don't accidentally pick up real credentials from the shell.
    env: {
      ...process.env,
      USAJOBS_API_KEY: "",
      USAJOBS_EMAIL: "",
      ...env,
    },
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

export function parseJSON<T = unknown>(result: CLIResult): T {
  if (result.exitCode !== 0) {
    throw new Error(`CLI exited with code ${result.exitCode}. stderr: ${result.stderr}`)
  }
  try {
    return JSON.parse(result.stdout) as T
  } catch {
    throw new Error(`Failed to parse JSON. stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  }
}
