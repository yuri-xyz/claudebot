/**
 * Cron MCP Tool
 *
 * Provides tools for Claude to manage cron jobs:
 * upsert, list, set-enabled, and remove scheduled invocations.
 */

import { z } from "zod";
import { match, P } from "ts-pattern";
import type { ToolDefinition } from "./types";
import {
  listCronJobs,
  addCronJob,
  removeCronJob,
  updateCronJob,
  getCronJob,
} from "../cron";
import type { CronJob } from "../cron";
import type { CronReplyTo } from "../cron/types";

const DEFAULT_MAX_TURNS = 50;

function generateId(): string {
  return `cron-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function resolveReplyTo(replyTo: "discord" | "signal" | undefined): { replyTo?: CronReplyTo; error?: string } {
  return match(replyTo)
    .with("discord", () => {
      const channelId = process.env.CLAUDEBOT_DISCORD_CHANNEL_ID;
      if (!channelId)
        return { error: "Error: No Discord channel context available. This only works when invoked from Discord." };
      return { replyTo: { type: "discord" as const, channelId } };
    })
    .with("signal", () => {
      const recipient = process.env.CLAUDEBOT_SIGNAL_RECIPIENT;
      if (!recipient)
        return { error: "Error: No Signal recipient context available. This only works when invoked from Signal." };
      return { replyTo: { type: "signal" as const, recipient } };
    })
    .with(P.nullish, () => ({}))
    .exhaustive();
}

function replyToLabel(replyTo: CronReplyTo): string {
  return match(replyTo)
    .with({ type: "discord" }, () => "→Discord")
    .with({ type: "signal" }, () => "→Signal")
    .exhaustive();
}

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
          ...(j.replyTo ? [replyToLabel(j.replyTo)] : []),
        ];
        const timing = j.runAt ?? j.schedule ?? "no schedule";
        return `- [${tags.join(", ")}] ${j.name} (${j.id}): "${timing}" -> ${j.prompt.slice(0, 80)}${j.prompt.length > 80 ? "..." : ""}`;
      })
      .join("\n");
  },
};

export const cronUpsertTool: ToolDefinition = {
  name: "claudebot_cron_upsert",
  description:
    "Create or update a cron job. Omit `id` to create a new job; provide `id` to update an existing one. Supply `schedule` (5-field cron) or `runAt` (ISO timestamp), not both.",
  inputShape: {
    id: z.string().optional().describe("Existing cron job ID to update. Omit to create a new job."),
    name: z.string().optional().describe("Human-readable name for the job (required for new jobs)"),
    schedule: z
      .string()
      .optional()
      .describe('Recurring cron schedule (5-field, e.g. "0 9 * * *" for daily at 9am)'),
    runAt: z
      .string()
      .optional()
      .describe("ISO timestamp for one-off execution (e.g. 2025-06-15T14:00:00Z)"),
    prompt: z
      .string()
      .optional()
      .describe("The prompt to send to Claude when this job fires (required for new jobs)"),
    cwd: z.string().optional().describe("Working directory for the Claude session (required for new jobs)"),
    skillName: z.string().optional().describe("Skill name to invoke when this job fires"),
    replyTo: z
      .enum(["discord", "signal"])
      .optional()
      .describe("Channel to deliver the result to (uses the originating conversation). Omit for silent background execution."),
  },
  async handler({ id, name, schedule, runAt, prompt, cwd, skillName, replyTo }) {
    if (schedule && runAt) {
      return "Error: Provide only one of `schedule` or `runAt`, not both.";
    }

    const reply = resolveReplyTo(replyTo as "discord" | "signal" | undefined);
    if (reply.error) return reply.error;

    // --- Update existing job ---
    if (id) {
      const existing = await getCronJob(id);
      if (!existing) return `Cron job ${id} not found`;

      const updates: Partial<CronJob> = {
        ...(name !== undefined ? { name } : {}),
        ...(schedule !== undefined ? { schedule, runAt: undefined, oneShot: false } : {}),
        ...(runAt !== undefined ? { runAt, schedule: undefined, oneShot: true } : {}),
        ...(prompt !== undefined ? { prompt } : {}),
        ...(cwd !== undefined ? { cwd } : {}),
        ...(skillName !== undefined ? { skillName } : {}),
        ...(reply.replyTo ? { replyTo: reply.replyTo } : {}),
      };

      await updateCronJob(id, updates);
      return `Updated job "${existing.name}" (${id})`;
    }

    // --- Create new job ---
    if (!name) return "Error: `name` is required when creating a new job.";
    if (!prompt) return "Error: `prompt` is required when creating a new job.";
    if (!cwd) return "Error: `cwd` is required when creating a new job.";
    if (!schedule && !runAt) return "Error: Provide either `schedule` or `runAt`.";

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
      maxTurns: DEFAULT_MAX_TURNS,
      oneShot: isOneShot,
      replyTo: reply.replyTo,
      createdAt: new Date().toISOString(),
    };

    await addCronJob(job);

    const timing = runAt ? `run at ${runAt}` : `schedule "${schedule}"`;
    const extras = [
      isOneShot ? "one-shot" : null,
      replyTo ? `reply to ${replyTo}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return `Created job "${job.name}" (${job.id}) — ${timing}${extras ? ` [${extras}]` : ""}`;
  },
};

export const cronSetEnabledTool: ToolDefinition = {
  name: "claudebot_cron_set_enabled",
  description: "Enable or disable a cron job by ID",
  inputShape: {
    id: z.string().describe("Cron job ID"),
    enabled: z.boolean().describe("Whether the job should be enabled"),
  },
  async handler({ id, enabled }) {
    const ok = await updateCronJob(id, { enabled });
    const verb = enabled ? "Enabled" : "Disabled";
    return ok ? `${verb} cron job ${id}` : `Cron job ${id} not found`;
  },
};

export const cronRemoveTool: ToolDefinition = {
  name: "claudebot_cron_remove",
  description: "Remove a cron job by ID",
  inputShape: {
    id: z.string().describe("Cron job ID"),
  },
  async handler({ id }) {
    const ok = await removeCronJob(id);
    return ok ? `Removed cron job ${id}` : `Cron job ${id} not found`;
  },
};

export const cronTools: ToolDefinition[] = [
  cronListTool,
  cronUpsertTool,
  cronSetEnabledTool,
  cronRemoveTool,
];
