import { z } from "zod";

export const CronJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Cron expression (standard 5-field: min hour dom month dow) */
  schedule: z.string(),
  prompt: z.string(),
  cwd: z.string(),
  skillName: z.string().optional(),
  enabled: z.boolean().default(true),
  maxTurns: z.number().default(50),
  maxBudgetUsd: z.number().optional(),
  createdAt: z.string(),
  lastRunAt: z.string().optional(),
});

export type CronJob = z.infer<typeof CronJobSchema>;

export const CronStorageSchema = z.object({
  jobs: z.array(CronJobSchema),
});

export type CronStorage = z.infer<typeof CronStorageSchema>;
