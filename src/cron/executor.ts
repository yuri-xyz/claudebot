/**
 * Cron Job Executor
 *
 * Invokes Claude in the sandbox with the cron job's prompt.
 */

import { match } from "ts-pattern";
import type { CronJob } from "./types";
import type { InvokeAgentFn, IncomingMessage } from "../connectors/types";
import type { Logger } from "../lib/logger";
import { updateCronJob, removeCronJob } from "./storage";

export type SendFn = (target: string, content: string) => Promise<void>;

export interface DeliveryChannels {
  discord?: SendFn;
  signal?: SendFn;
}

export async function executeCronJob(
  job: CronJob,
  invokeAgent: InvokeAgentFn,
  logger: Logger,
  channels: DeliveryChannels = {},
): Promise<void> {
  logger.info(`Executing cron job: ${job.name} (${job.id})`);

  const incoming: IncomingMessage = {
    source: "cron",
    content: job.skillName
      ? `Run the skill "${job.skillName}": ${job.prompt}`
      : job.prompt,
    replyTo: { type: "cron", jobId: job.id },
    cwd: job.cwd,
    metadata: {
      cronJobId: job.id,
      cronJobName: job.name,
    },
  };

  let response: string | undefined;
  try {
    const result = await invokeAgent(incoming);
    response = result.response;
    logger.info(
      `Cron job ${job.name} completed. Response length: ${response.length}`,
    );
  } catch (err) {
    logger.error(`Cron job ${job.name} failed:`, err);
  }

  // Deliver to configured channel
  if (response && job.replyTo) {
    const text = response;
    try {
      await match(job.replyTo)
        .with({ type: "discord" }, async ({ channelId }) => {
          if (!channels.discord) {
            logger.warn(`Cron job ${job.name}: Discord delivery configured but no Discord connector`);
            return;
          }
          await channels.discord(channelId, text);
          logger.info(`Cron job ${job.name}: delivered to Discord channel ${channelId}`);
        })
        .with({ type: "signal" }, async ({ recipient }) => {
          if (!channels.signal) {
            logger.warn(`Cron job ${job.name}: Signal delivery configured but no Signal connector`);
            return;
          }
          await channels.signal(recipient, text);
          logger.info(`Cron job ${job.name}: delivered to Signal ${recipient}`);
        })
        .exhaustive();
    } catch (err) {
      logger.error(`Cron job ${job.name}: failed to deliver response:`, err);
    }
  }

  // One-shot jobs are removed after firing; recurring jobs update lastRunAt
  if (job.oneShot) {
    await removeCronJob(job.id);
    logger.info(`Removed one-shot job ${job.name} (${job.id})`);
  } else {
    await updateCronJob(job.id, {
      lastRunAt: new Date().toISOString(),
    });
  }
}
