import { describe, test, expect } from "bun:test"
import { runCLI } from "./helpers"

const LOCATION = "New York, NY"

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr)
  } catch {
    return {}
  }
}

describe("Indeed CLI flag validation", () => {
  describe("missing --location", () => {
    test("exits 1 with NO_LOCATION", async () => {
      const result = await runCLI(["search"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_LOCATION")
    })
  })

  describe("--jobage validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-l", LOCATION, "--jobage", "foo"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/jobage/)
    })

    test("valid integer passes", async () => {
      const result = await runCLI(["search", "-l", LOCATION, "--jobage", "7", "--limit", "1"])
      const err = parsedStderr(result.stderr)
      expect(err.code).not.toBe("BAD_ARG")
    })

    test("zero is accepted", async () => {
      const result = await runCLI(["search", "-l", LOCATION, "--jobage", "0", "--limit", "1"])
      const err = parsedStderr(result.stderr)
      expect(err.code).not.toBe("BAD_ARG")
    })
  })

  describe("--radius validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-l", LOCATION, "--radius", "far"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/radius/)
    })

    test("valid radius does not produce BAD_ARG", async () => {
      // Omit location so the CLI stops at NO_LOCATION rather than fetching the network.
      // Numeric validation runs before the location check, so BAD_ARG surfaces correctly.
      const result = await runCLI(["search", "--radius", "25", "--limit", "1"])
      const err = parsedStderr(result.stderr)
      expect(err.code).not.toBe("BAD_ARG")
    })
  })

  describe("--limit validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-l", LOCATION, "--limit", "xyz"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/limit/)
    })
  })

  describe("--page validation", () => {
    test("non-numeric string exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "-l", LOCATION, "--page", "abc"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
      expect(err.error).toMatch(/page/)
    })
  })

  describe("detail command", () => {
    test("missing job key exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("NO_ID")
    })

    test("invalid job key format exits 1 with BAD_ID", async () => {
      const result = await runCLI(["detail", "not-a-valid-key"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ID")
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

  describe("all valid numeric flags", () => {
    test("no BAD_ARG with all numeric flags set (no network — location omitted)", async () => {
      // Omit location so the CLI stops at NO_LOCATION rather than fetching the network.
      const result = await runCLI([
        "search",
        "--jobage", "7",
        "--radius", "25",
        "--page", "1",
        "--limit", "5",
      ])
      const err = parsedStderr(result.stderr)
      expect(err.code).not.toBe("BAD_ARG")
    })
  })
})
