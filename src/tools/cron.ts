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
  description: "List all scheduled cron jobs and one-off reminders",
  inputShape: {},
  async handler() {
    const jobs = await listCronJobs();
    if (jobs.length === 0) {
      return "No cron jobs configured.";
    }
    return jobs
      .map((j) => {
        const tags = [
          j.enabled ? "enabled" : "disabled",
          ...(j.oneShot ? ["one-shot"] : []),
          ...(j.discordChannelId ? ["→Discord"] : []),
        ];
        const timing = j.runAt ?? j.schedule ?? "no schedule";
        return `- [${tags.join(", ")}] ${j.name} (${j.id}): "${timing}" -> ${j.prompt.slice(0, 80)}${j.prompt.length > 80 ? "..." : ""}`;
      })
      .join("\n");
  },
};

export const cronCreateTool: ToolDefinition = {
  name: "claudebot_cron_create",
  description:
    "Create a cron job or one-off reminder. Provide either `schedule` (5-field cron) or `runAt` (ISO timestamp), not both. Use `replyToDiscord: true` to send the result back to the current Discord channel.",
  inputShape: {
    name: z.string().describe("Human-readable name for the job"),
    schedule: z
      .string()
      .optional()
      .describe(
        'Cron schedule (5-field format, e.g. "0 9 * * *" for daily at 9am)',
      ),
    runAt: z
      .string()
      .optional()
      .describe("ISO timestamp for one-off execution (e.g. 2025-06-15T14:00:00Z)"),
    prompt: z
      .string()
      .describe("The prompt to send to Claude when this job fires"),
    cwd: z.string().describe("Working directory for the Claude session"),
    skillName: z.string().optional().describe("Optional skill name to invoke"),
    replyToDiscord: z
      .boolean()
      .optional()
      .describe(
        "If true, sends the result to the Discord channel this message originated from",
      ),
  },
  async handler({ name, schedule, runAt, prompt, cwd, skillName, replyToDiscord }) {
    if (!schedule && !runAt) {
      return "Error: Provide either `schedule` or `runAt`.";
    }
    if (schedule && runAt) {
      return "Error: Provide only one of `schedule` or `runAt`, not both.";
    }

    const discordChannelId =
      replyToDiscord ? process.env.CLAUDEBOT_DISCORD_CHANNEL_ID : undefined;
    if (replyToDiscord && !discordChannelId) {
      return "Error: No Discord channel context available. This only works when invoked from Discord.";
    }

    const isOneShot = !!runAt;

    const job: CronJob = {
      id: generateId(),
      name,
      ...(schedule ? { schedule } : {}),
      ...(runAt ? { runAt } : {}),
      prompt,
      cwd,
      skillName,
      enabled: true,
      maxTurns: 50,
      oneShot: isOneShot,
      ...(discordChannelId ? { discordChannelId } : {}),
      createdAt: new Date().toISOString(),
    };

    await addCronJob(job);

    const timing = runAt ? `run at ${runAt}` : `schedule "${schedule}"`;
    const extras = [
      isOneShot ? "one-shot" : null,
      discordChannelId ? "reply to Discord" : null,
    ]
      .filter(Boolean)
      .join(", ");

    return `Created job "${job.name}" (${job.id}) — ${timing}${extras ? ` [${extras}]` : ""}`;
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
