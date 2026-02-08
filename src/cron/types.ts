import { z } from "zod";

export const CronJobSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** Cron expression (standard 5-field: min hour dom month dow) */
    schedule: z.string().optional(),
    /** ISO timestamp for one-off execution (alternative to schedule) */
    runAt: z.string().optional(),
    prompt: z.string(),
    cwd: z.string(),
    skillName: z.string().optional(),
    enabled: z.boolean().default(true),
    maxTurns: z.number().default(50),
    maxBudgetUsd: z.number().optional(),
    /** Discord channel ID to send results to */
    discordChannelId: z.string().optional(),
    /** Auto-remove after firing (used with runAt) */
    oneShot: z.boolean().default(false),
    createdAt: z.string(),
    lastRunAt: z.string().optional(),
  })
  .refine((job) => job.schedule || job.runAt, {
    message: "Either schedule or runAt must be provided",
  });

export type CronJob = z.infer<typeof CronJobSchema>;

export const CronStorageSchema = z.object({
  jobs: z.array(CronJobSchema),
});

export type CronStorage = z.infer<typeof CronStorageSchema>;
