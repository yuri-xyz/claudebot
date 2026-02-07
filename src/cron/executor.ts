/**
 * Cron Job Executor
 *
 * Invokes Claude in the sandbox with the cron job's prompt.
 */

import type { CronJob } from "./types";
import type { InvokeAgentFn, IncomingMessage } from "../connectors/types";
import type { Logger } from "../lib/logger";
import { updateCronJob } from "./storage";

export async function executeCronJob(
  job: CronJob,
  invokeAgent: InvokeAgentFn,
  logger: Logger,
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

  try {
    const response = await invokeAgent(incoming);
    logger.info(
      `Cron job ${job.name} completed. Response length: ${response.length}`,
    );
  } catch (err) {
    logger.error(`Cron job ${job.name} failed:`, err);
  }

  await updateCronJob(job.id, {
    lastRunAt: new Date().toISOString(),
  });
}
