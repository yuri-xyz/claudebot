import { describe, test, expect } from "bun:test";
import {
  parseVersion,
  calculateVersionDrift,
  checkVersionCompatibility,
  isVersionCompatible,
} from "../../src/adapter/versionCheck";

describe("parseVersion", () => {
  test("parses standard version", () => {
    const v = parseVersion("2.1.29");
    expect(v).toEqual({ major: 2, minor: 1, patch: 29, raw: "2.1.29" });
  });

  test("parses version with label", () => {
    const v = parseVersion("2.1.29 (Claude Code)");
    expect(v).toEqual({ major: 2, minor: 1, patch: 29, raw: "2.1.29" });
  });

  test("returns null for invalid input", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("abc")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
  });
});

describe("calculateVersionDrift", () => {
  test("detects no drift for same version", () => {
    const v = { major: 2, minor: 1, patch: 29, raw: "2.1.29" };
    const drift = calculateVersionDrift(v, v);
    expect(drift.trigger).toBeNull();
  });

  test("detects major drift", () => {
    const installed = { major: 3, minor: 0, patch: 0, raw: "3.0.0" };
    const supported = { major: 2, minor: 1, patch: 29, raw: "2.1.29" };
    const drift = calculateVersionDrift(installed, supported);
    expect(drift.trigger).toBe("major");
    expect(drift.isOlder).toBe(false);
  });

  test("detects older version", () => {
    const installed = { major: 1, minor: 0, patch: 0, raw: "1.0.0" };
    const supported = { major: 2, minor: 1, patch: 29, raw: "2.1.29" };
    const drift = calculateVersionDrift(installed, supported);
    expect(drift.isOlder).toBe(true);
  });
});

describe("checkVersionCompatibility", () => {
  test("handles null input", () => {
    const result = checkVersionCompatibility(null);
    expect(result.isCompatible).toBe(false);
    expect(result.warning).toBeTruthy();
  });

  test("compatible version produces no warning", () => {
    const result = checkVersionCompatibility("2.1.29");
    expect(result.isCompatible).toBe(true);
    expect(result.warning).toBeNull();
  });
});

describe("isVersionCompatible", () => {
  test("returns true for compatible version", () => {
    expect(isVersionCompatible("2.1.29")).toBe(true);
  });

  test("returns false for null", () => {
    expect(isVersionCompatible(null)).toBe(false);
  });
});
