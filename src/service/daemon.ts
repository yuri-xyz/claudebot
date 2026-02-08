/**
 * Daemon Process
 *
 * Long-running process that orchestrates connectors and cron scheduling.
 * Started by launchd/systemd via `claudebot daemon`.
 */

import ms from "ms";
import { loadConfig, ensureDataDirs } from "../config";
import { createLogger } from "../lib/logger";
import { DiscordConnector } from "../connectors/discord";
import type { Connector } from "../connectors/types";
import { loadCronStorage, getJobsDue, executeCronJob } from "../cron";
import type { SendToDiscordFn } from "../cron/executor";
import { invokeAgent } from "./invokeAgent";

const CRON_CHECK_INTERVAL_MS = ms("1m");

export async function runDaemon(): Promise<void> {
  const logger = createLogger("daemon");
  logger.info("Starting claudebot daemon...");

  await ensureDataDirs();
  const config = await loadConfig();

  const connectors: Connector[] = [];
  let sendToDiscord: SendToDiscordFn | undefined;

  // Start Discord connector if configured
  if (config.discord) {
    const discord = new DiscordConnector(
      config.discord,
      (msg) => invokeAgent(msg, config, logger),
      logger,
    );
    try {
      await discord.start();
      connectors.push(discord);
      sendToDiscord = (channelId, content) =>
        discord.sendMessage(channelId, content);
    } catch (err) {
      logger.error("Failed to start Discord connector:", err);
    }
  } else {
    logger.warn("Discord not configured. Set discord.token in config.");
  }

  // Start cron scheduler
  let cronTimer: ReturnType<typeof setInterval> | undefined;
  let lastCronMinute = -1;

  cronTimer = setInterval(async () => {
    const now = new Date();
    const currentMinute = now.getMinutes() + now.getHours() * 60;

    // Only check once per minute
    if (currentMinute === lastCronMinute) return;
    lastCronMinute = currentMinute;

    try {
      const storage = await loadCronStorage();
      const dueJobs = getJobsDue(storage.jobs, now);

      for (const job of dueJobs) {
        // Fire and forget - don't block the scheduler
        executeCronJob(
          job,
          (msg) => invokeAgent(msg, config, logger),
          logger,
          sendToDiscord,
        ).catch((err) => {
          logger.error(`Cron job ${job.name} execution error:`, err);
        });
      }
    } catch (err) {
      logger.error("Cron scheduler error:", err);
    }
  }, CRON_CHECK_INTERVAL_MS);

  logger.info("Daemon started successfully");

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down daemon...");

    if (cronTimer) clearInterval(cronTimer);

    for (const connector of connectors) {
      try {
        await connector.stop();
      } catch (err) {
        logger.error(`Error stopping ${connector.name}:`, err);
      }
    }

    logger.info("Daemon stopped");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
