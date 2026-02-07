import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// We need to test storage with a temp directory
// We'll test the CronStorageSchema directly since storage depends on file paths

import { CronStorageSchema, CronJobSchema } from "../../src/cron/types";

describe("CronJobSchema", () => {
  test("validates a complete cron job", () => {
    const job = {
      id: "test-1",
      name: "Daily Backup",
      schedule: "0 2 * * *",
      prompt: "Run the backup script",
      cwd: "/home/user/project",
      enabled: true,
      maxTurns: 50,
      createdAt: "2024-01-01T00:00:00Z",
    };

    const result = CronJobSchema.safeParse(job);
    expect(result.success).toBe(true);
  });

  test("applies defaults for optional fields", () => {
    const job = {
      id: "test-2",
      name: "Test",
      schedule: "* * * * *",
      prompt: "test",
      cwd: "/tmp",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const result = CronJobSchema.parse(job);
    expect(result.enabled).toBe(true);
    expect(result.maxTurns).toBe(50);
  });

  test("accepts optional fields", () => {
    const job = {
      id: "test-3",
      name: "Skill Job",
      schedule: "0 9 * * 1-5",
      prompt: "Review code",
      cwd: "/project",
      skillName: "code-review",
      maxBudgetUsd: 5.0,
      lastRunAt: "2024-01-15T09:00:00Z",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const result = CronJobSchema.safeParse(job);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillName).toBe("code-review");
      expect(result.data.maxBudgetUsd).toBe(5.0);
    }
  });
});

describe("CronStorageSchema", () => {
  test("validates empty storage", () => {
    const result = CronStorageSchema.safeParse({ jobs: [] });
    expect(result.success).toBe(true);
  });

  test("validates storage with jobs", () => {
    const storage = {
      jobs: [
        {
          id: "1",
          name: "Job 1",
          schedule: "* * * * *",
          prompt: "test",
          cwd: "/tmp",
          enabled: true,
          maxTurns: 50,
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
    };

    const result = CronStorageSchema.safeParse(storage);
    expect(result.success).toBe(true);
  });
});
