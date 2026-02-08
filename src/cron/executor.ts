/**
 * Cron Job Executor
 *
 * Invokes Claude in the sandbox with the cron job's prompt.
 */

import type { CronJob } from "./types";
import type { InvokeAgentFn, IncomingMessage } from "../connectors/types";
import type { Logger } from "../lib/logger";
import { updateCronJob, removeCronJob } from "./storage";

export type SendToDiscordFn = (
  channelId: string,
  content: string,
) => Promise<void>;

export async function executeCronJob(
  job: CronJob,
  invokeAgent: InvokeAgentFn,
  logger: Logger,
  sendToDiscord?: SendToDiscordFn,
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

  // Deliver to Discord if configured
  if (response && job.discordChannelId && sendToDiscord) {
    try {
      await sendToDiscord(job.discordChannelId, response);
    } catch (err) {
      logger.error(`Failed to send cron result to Discord:`, err);
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
