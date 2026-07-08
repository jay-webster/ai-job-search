import { describe, test, expect } from "bun:test"
import { runCLI } from "./helpers"

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr)
  } catch {
    return {}
  }
}

describe("USAJobs CLI flag validation", () => {
  describe("missing API key / email", () => {
    test("search with no env vars exits 1 with NO_API_KEY", async () => {
      // helpers.ts strips USAJOBS_* from env by default
      const result = await runCLI(["search", "-q", "engineer"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_API_KEY")
    })

    test("search with key but no email exits 1 with NO_EMAIL", async () => {
      const result = await runCLI(["search", "-q", "engineer"], {
        USAJOBS_API_KEY: "fake-key",
        USAJOBS_EMAIL: "",
      })
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_EMAIL")
    })
  })

  describe("--jobage validation", () => {
    test("non-numeric exits 1 with BAD_ARG before auth check", async () => {
      const result = await runCLI(["search", "--jobage", "foo"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/jobage/)
    })

    test("valid integer does not produce BAD_ARG (fails on NO_API_KEY instead)", async () => {
      const result = await runCLI(["search", "--jobage", "30"])
      const err = parsedStderr(result.stderr)
      expect(err.code).not.toBe("BAD_ARG")
    })
  })

  describe("--limit validation", () => {
    test("non-numeric exits 1 with BAD_ARG before auth check", async () => {
      const result = await runCLI(["search", "--limit", "xyz"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/limit/)
    })

    test("valid integer does not produce BAD_ARG", async () => {
      const result = await runCLI(["search", "--limit", "10"])
      const err = parsedStderr(result.stderr)
      expect(err.code).not.toBe("BAD_ARG")
    })
  })

  describe("--page validation", () => {
    test("non-numeric exits 1 with BAD_ARG before auth check", async () => {
      const result = await runCLI(["search", "--page", "abc"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/page/)
    })
  })

  describe("detail command", () => {
    test("missing job ID exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_ID")
    })

    test("non-numeric job ID exits 1 with BAD_ID (before auth)", async () => {
      const result = await runCLI(["detail", "not-a-number"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ID")
    })

    test("valid numeric ID with no auth fails on NO_API_KEY", async () => {
      const result = await runCLI(["detail", "777978200"])
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_API_KEY")
    })
  })

  describe("unknown command", () => {
    test("exits 1 with BAD_CMD", async () => {
      const result = await runCLI(["frobnicate"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_CMD")
    })
  })
})
