/**
 * Cron MCP Tool
 *
 * Provides tools for Claude to manage cron jobs:
 * create, list, enable, disable, and remove scheduled invocations.
 */

import { z } from "zod";
import type { ToolDefinition } from "./types";
import {
  listCronJobs,
  addCronJob,
  removeCronJob,
  updateCronJob,
} from "../cron";
import type { CronJob } from "../cron";

function generateId(): string {
  return `cron-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const cronIdShape = {
  id: z.string().describe("Cron job ID"),
} as const;

export const cronListTool: ToolDefinition = {
  name: "claudebot_cron_list",
  description: "List all scheduled cron jobs",
  inputShape: {},
  async handler() {
    const jobs = await listCronJobs();
    if (jobs.length === 0) {
      return "No cron jobs configured.";
    }
    return jobs
      .map(
        (j) =>
          `- [${j.enabled ? "enabled" : "disabled"}] ${j.name} (${j.id}): "${j.schedule}" -> ${j.prompt.slice(0, 80)}${j.prompt.length > 80 ? "..." : ""}`,
      )
      .join("\n");
  },
};

export const cronCreateTool: ToolDefinition = {
  name: "claudebot_cron_create",
  description:
    "Create a new cron job to invoke Claude on a schedule. Schedule uses standard 5-field cron format: minute hour day-of-month month day-of-week.",
  inputShape: {
    name: z.string().describe("Human-readable name for the cron job"),
    schedule: z
      .string()
      .describe(
        'Cron schedule (5-field format, e.g. "0 9 * * *" for daily at 9am)',
      ),
    prompt: z
      .string()
      .describe("The prompt to send to Claude when this job fires"),
    cwd: z.string().describe("Working directory for the Claude session"),
    skillName: z.string().optional().describe("Optional skill name to invoke"),
  },
  async handler({ name, schedule, prompt, cwd, skillName }) {
    const job: CronJob = {
      id: generateId(),
      name,
      schedule,
      prompt,
      cwd,
      skillName,
      enabled: true,
      maxTurns: 50,
      createdAt: new Date().toISOString(),
    };

    await addCronJob(job);
    return `Created cron job "${job.name}" (${job.id}) with schedule "${job.schedule}"`;
  },
};

export const cronEnableTool: ToolDefinition = {
  name: "claudebot_cron_enable",
  description: "Enable a cron job by ID",
  inputShape: cronIdShape,
  async handler({ id }) {
    const ok = await updateCronJob(id, { enabled: true });
    return ok ? `Enabled cron job ${id}` : `Cron job ${id} not found`;
  },
};

export const cronDisableTool: ToolDefinition = {
  name: "claudebot_cron_disable",
  description: "Disable a cron job by ID",
  inputShape: cronIdShape,
  async handler({ id }) {
    const ok = await updateCronJob(id, { enabled: false });
    return ok ? `Disabled cron job ${id}` : `Cron job ${id} not found`;
  },
};

export const cronRemoveTool: ToolDefinition = {
  name: "claudebot_cron_remove",
  description: "Remove a cron job by ID",
  inputShape: cronIdShape,
  async handler({ id }) {
    const ok = await removeCronJob(id);
    return ok ? `Removed cron job ${id}` : `Cron job ${id} not found`;
  },
};

export const cronTools: ToolDefinition[] = [
  cronListTool,
  cronCreateTool,
  cronEnableTool,
  cronDisableTool,
  cronRemoveTool,
];
