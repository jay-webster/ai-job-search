import { describe, test, expect } from "bun:test"
import { runCLI } from "./helpers"

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr)
  } catch {
    return {}
  }
}

describe("Greenhouse CLI flag validation", () => {
  describe("missing --company", () => {
    test("search exits 1 with NO_COMPANY", async () => {
      const result = await runCLI(["search"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_COMPANY")
    })

    test("detail exits 1 with NO_COMPANY", async () => {
      const result = await runCLI(["detail", "7954688"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_COMPANY")
    })
  })

  describe("missing job ID on detail", () => {
    test("exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail", "--company", "stripe"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_ID")
    })
  })

  describe("invalid job ID on detail", () => {
    test("non-numeric ID exits 1 with BAD_ID", async () => {
      const result = await runCLI(["detail", "--company", "stripe", "not-a-number"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ID")
    })
  })

  describe("--jobage validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "--jobage", "foo"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/jobage/)
    })

    test("valid integer does not produce BAD_ARG", async () => {
      // Omit --company so CLI stops at NO_COMPANY, not a network call
      const result = await runCLI(["search", "--jobage", "14"])
      const err = parsedStderr(result.stderr)
      expect(err.code).not.toBe("BAD_ARG")
    })
  })

  describe("--limit validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
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

  describe("unknown command", () => {
    test("exits 1 with BAD_CMD", async () => {
      const result = await runCLI(["frobnicate"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_CMD")
    })
  })

  describe("unknown company board", () => {
    test("exits 1 with NOT_FOUND for a nonexistent board", async () => {
      const result = await runCLI(["search", "--company", "zzz-does-not-exist-zzz"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NOT_FOUND")
    })
  })
})
