import { z } from "zod";

export const CronReplyToSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("discord"), channelId: z.string() }),
  z.object({ type: z.literal("signal"), recipient: z.string() }),
]);

export type CronReplyTo = z.infer<typeof CronReplyToSchema>;

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
    /** Where to deliver the result (omit for silent/background execution) */
    replyTo: CronReplyToSchema.optional(),
    /** Auto-remove after firing (used with runAt) */
    oneShot: z.boolean().default(false),
    createdAt: z.string(),
    lastRunAt: z.string().optional(),

    // Legacy fields — migrated to replyTo on read
    discordChannelId: z.string().optional(),
    signalRecipient: z.string().optional(),
  })
  .refine((job) => job.schedule || job.runAt, {
    message: "Either schedule or runAt must be provided",
  })
  .transform(({ discordChannelId, signalRecipient, ...rest }) => {
    const replyTo = rest.replyTo
      ?? (discordChannelId ? { type: "discord" as const, channelId: discordChannelId }
        : signalRecipient ? { type: "signal" as const, recipient: signalRecipient }
        : undefined);
    return { ...rest, replyTo };
  });

export type CronJob = z.output<typeof CronJobSchema>;

export const CronStorageSchema = z.object({
  jobs: z.array(CronJobSchema),
});

export type CronStorage = z.infer<typeof CronStorageSchema>;
