import { describe, test, expect, afterEach } from "bun:test";
import {
  checkBun,
  checkApiKey,
  hasRequiredFailures,
  printCheckResults,
  type CheckResult,
} from "../../src/cli/checks";

describe("checkBun", () => {
  test("returns pass with current Bun version", () => {
    const result = checkBun();
    expect(result.status).toBe("pass");
    expect(result.message).toContain(Bun.version);
    expect(result.optional).toBe(false);
  });
});

describe("checkApiKey", () => {
  const origKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (origKey !== undefined) process.env.ANTHROPIC_API_KEY = origKey;
    else delete process.env.ANTHROPIC_API_KEY;
  });

  test("returns pass when ANTHROPIC_API_KEY is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const result = checkApiKey();
    expect(result.status).toBe("pass");
  });

  test("returns warn when ANTHROPIC_API_KEY is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = checkApiKey();
    expect(result.status).toBe("warn");
    expect(result.message).toContain("not set");
  });
});

describe("hasRequiredFailures", () => {
  test("returns false when all pass", () => {
    const results: CheckResult[] = [
      { name: "a", status: "pass", message: "", optional: false },
      { name: "b", status: "pass", message: "", optional: false },
    ];
    expect(hasRequiredFailures(results)).toBe(false);
  });

  test("returns false when only optional checks fail", () => {
    const results: CheckResult[] = [
      { name: "a", status: "pass", message: "", optional: false },
      { name: "b", status: "fail", message: "", optional: true },
    ];
    expect(hasRequiredFailures(results)).toBe(false);
  });

  test("returns true when a required check fails", () => {
    const results: CheckResult[] = [
      { name: "a", status: "fail", message: "", optional: false },
      { name: "b", status: "pass", message: "", optional: true },
    ];
    expect(hasRequiredFailures(results)).toBe(true);
  });

  test("returns false when required checks only warn", () => {
    const results: CheckResult[] = [
      { name: "a", status: "warn", message: "", optional: false },
    ];
    expect(hasRequiredFailures(results)).toBe(false);
  });
});

describe("printCheckResults", () => {
  test("does not throw on mixed results", () => {
    const results: CheckResult[] = [
      { name: "Pass", status: "pass", message: "ok", optional: false },
      { name: "Warn", status: "warn", message: "hmm", optional: true },
      { name: "Fail", status: "fail", message: "bad", optional: false },
    ];
    expect(() => printCheckResults(results)).not.toThrow();
  });
});
