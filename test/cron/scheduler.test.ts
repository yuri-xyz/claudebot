import { describe, test, expect } from "bun:test";
import { matchesCron, getJobsDue } from "../../src/cron/scheduler";
import type { CronJob } from "../../src/cron/types";

describe("matchesCron", () => {
  test("matches wildcard expression", () => {
    expect(matchesCron("* * * * *", new Date())).toBe(true);
  });

  test("matches specific minute and hour", () => {
    const date = new Date(2024, 0, 15, 9, 30); // Jan 15, 9:30
    expect(matchesCron("30 9 * * *", date)).toBe(true);
    expect(matchesCron("0 9 * * *", date)).toBe(false);
    expect(matchesCron("30 10 * * *", date)).toBe(false);
  });

  test("matches day of month", () => {
    const date = new Date(2024, 0, 15, 12, 0); // Jan 15
    expect(matchesCron("0 12 15 * *", date)).toBe(true);
    expect(matchesCron("0 12 16 * *", date)).toBe(false);
  });

  test("matches month", () => {
    const date = new Date(2024, 5, 15, 12, 0); // June 15
    expect(matchesCron("0 12 15 6 *", date)).toBe(true);
    expect(matchesCron("0 12 15 7 *", date)).toBe(false);
  });

  test("matches day of week", () => {
    const monday = new Date(2024, 0, 15, 12, 0); // Monday
    expect(matchesCron("0 12 * * 1", monday)).toBe(true);
    expect(matchesCron("0 12 * * 0", monday)).toBe(false);
  });

  test("matches step expressions", () => {
    const date = new Date(2024, 0, 15, 12, 0); // minute 0
    expect(matchesCron("*/5 * * * *", date)).toBe(true);

    const date2 = new Date(2024, 0, 15, 12, 3);
    expect(matchesCron("*/5 * * * *", date2)).toBe(false);

    const date3 = new Date(2024, 0, 15, 12, 15);
    expect(matchesCron("*/5 * * * *", date3)).toBe(true);
  });

  test("matches range expressions", () => {
    const date = new Date(2024, 0, 15, 10, 0); // hour 10
    expect(matchesCron("0 9-17 * * *", date)).toBe(true);
    expect(matchesCron("0 18-23 * * *", date)).toBe(false);
  });

  test("matches list expressions", () => {
    const date = new Date(2024, 0, 15, 9, 0); // hour 9
    expect(matchesCron("0 9,12,15 * * *", date)).toBe(true);
    expect(matchesCron("0 10,12,15 * * *", date)).toBe(false);
  });

  test("rejects invalid expressions", () => {
    expect(matchesCron("invalid", new Date())).toBe(false);
    expect(matchesCron("* * *", new Date())).toBe(false);
  });
});

describe("getJobsDue", () => {
  const baseJob: CronJob = {
    id: "test-1",
    name: "Test",
    schedule: "30 9 * * *",
    prompt: "Do something",
    cwd: "/tmp",
    enabled: true,
    maxTurns: 50,
    createdAt: "2024-01-01T00:00:00Z",
  };

  test("returns matching enabled jobs", () => {
    const date = new Date(2024, 0, 15, 9, 30);
    const jobs = [baseJob];
    const due = getJobsDue(jobs, date);
    expect(due).toHaveLength(1);
  });

  test("skips disabled jobs", () => {
    const date = new Date(2024, 0, 15, 9, 30);
    const jobs = [{ ...baseJob, enabled: false }];
    const due = getJobsDue(jobs, date);
    expect(due).toHaveLength(0);
  });

  test("skips non-matching jobs", () => {
    const date = new Date(2024, 0, 15, 10, 0);
    const jobs = [baseJob];
    const due = getJobsDue(jobs, date);
    expect(due).toHaveLength(0);
  });
});
