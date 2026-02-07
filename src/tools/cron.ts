/**
 * Cron MCP Tool
 *
 * Provides tools for Claude to manage cron jobs:
 * create, list, enable, disable, and remove scheduled invocations.
 */

import type { ToolDefinition } from "./types";
import {
  listCronJobs,
  addCronJob,
  removeCronJob,
  updateCronJob,
  getCronJob,
} from "../cron";
import type { CronJob } from "../cron";

function generateId(): string {
  return `cron-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const cronListTool: ToolDefinition = {
  name: "claudebot_cron_list",
  description: "List all scheduled cron jobs",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
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
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Human-readable name for the cron job",
      },
      schedule: {
        type: "string",
        description:
          'Cron schedule (5-field format, e.g. "0 9 * * *" for daily at 9am)',
      },
      prompt: {
        type: "string",
        description: "The prompt to send to Claude when this job fires",
      },
      cwd: {
        type: "string",
        description: "Working directory for the Claude session",
      },
      skillName: {
        type: "string",
        description: "Optional skill name to invoke",
      },
    },
    required: ["name", "schedule", "prompt", "cwd"],
  },
  async handler(input) {
    const job: CronJob = {
      id: generateId(),
      name: input.name as string,
      schedule: input.schedule as string,
      prompt: input.prompt as string,
      cwd: input.cwd as string,
      skillName: input.skillName as string | undefined,
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
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Cron job ID" },
    },
    required: ["id"],
  },
  async handler(input) {
    const id = input.id as string;
    const ok = await updateCronJob(id, { enabled: true });
    return ok ? `Enabled cron job ${id}` : `Cron job ${id} not found`;
  },
};

export const cronDisableTool: ToolDefinition = {
  name: "claudebot_cron_disable",
  description: "Disable a cron job by ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Cron job ID" },
    },
    required: ["id"],
  },
  async handler(input) {
    const id = input.id as string;
    const ok = await updateCronJob(id, { enabled: false });
    return ok ? `Disabled cron job ${id}` : `Cron job ${id} not found`;
  },
};

export const cronRemoveTool: ToolDefinition = {
  name: "claudebot_cron_remove",
  description: "Remove a cron job by ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Cron job ID" },
    },
    required: ["id"],
  },
  async handler(input) {
    const id = input.id as string;
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
