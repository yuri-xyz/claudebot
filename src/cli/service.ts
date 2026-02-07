/**
 * Service CLI Commands
 */

import { defineCommand } from "citty";
import { errorMessage } from "../lib/errors";
import { detectPlatform } from "../service/platform";
import {
  installLaunchd,
  startLaunchd,
  stopLaunchd,
  getLaunchdStatus,
} from "../service/launchd";
import {
  installSystemd,
  startSystemd,
  stopSystemd,
  getSystemdStatus,
} from "../service/systemd";
import { loadConfig, ensureDataDirs } from "../config";
import { setupSandbox } from "../sandbox/setup";
import { detectRuntime } from "../sandbox/runtime";
import type { SandboxConfig } from "../sandbox/types";
import { createLogger } from "../lib/logger";

const logger = createLogger("service");

export default defineCommand({
  meta: {
    name: "service",
    description: "Manage the claudebot background service",
  },
  subCommands: {
    install: defineCommand({
      meta: {
        name: "install",
        description: "Install the background service",
      },
      async run() {
        await ensureDataDirs();
        const config = await loadConfig();
        const platform = detectPlatform();

        // Get the path to this executable
        const execPath = process.argv[0] ?? "claudebot";

        console.log(`Installing claudebot service (${platform})...`);

        if (platform === "launchd") {
          await installLaunchd(execPath);
        } else {
          await installSystemd(execPath);
        }

        console.log("Service installed.");

        // Setup sandbox if a container runtime is available
        try {
          const runtime = await detectRuntime(config.sandbox.runtime);
          const sandboxCfg: SandboxConfig = {
            runtime,
            containerName: config.sandbox.containerName,
            image: config.sandbox.image,
            mountPaths: config.sandbox.mountPaths,
          };

          console.log("\nSetting up sandbox...");
          await setupSandbox(sandboxCfg, logger);
          console.log("Sandbox ready.");
        } catch (err) {
          console.warn(
            `\nSandbox setup skipped: ${errorMessage(err)}`,
          );
          console.warn(
            "Claude Code will run directly on the host until a container runtime is available.",
          );
        }

        console.log(
          '\nRun "claudebot service start" to start the service.',
        );
      },
    }),

    start: defineCommand({
      meta: {
        name: "start",
        description: "Start the background service",
      },
      async run() {
        const platform = detectPlatform();
        console.log("Starting claudebot service...");

        try {
          if (platform === "launchd") {
            await startLaunchd();
          } else {
            await startSystemd();
          }
          console.log("Service started.");
        } catch (err) {
          console.error(
            "Error:",
            errorMessage(err),
          );
          process.exit(1);
        }
      },
    }),

    stop: defineCommand({
      meta: {
        name: "stop",
        description: "Stop the background service",
      },
      async run() {
        const platform = detectPlatform();
        console.log("Stopping claudebot service...");

        try {
          if (platform === "launchd") {
            await stopLaunchd();
          } else {
            await stopSystemd();
          }
          console.log("Service stopped.");
        } catch (err) {
          console.error(
            "Error:",
            errorMessage(err),
          );
          process.exit(1);
        }
      },
    }),

    status: defineCommand({
      meta: {
        name: "status",
        description: "Show service status and health",
      },
      async run() {
        const config = await loadConfig();
        const platform = detectPlatform();

        const status =
          platform === "launchd"
            ? await getLaunchdStatus()
            : await getSystemdStatus();

        console.log("claudebot service status");
        console.log("========================");
        console.log(`Platform:  ${platform}`);
        console.log(`Installed: ${status.installed ? "yes" : "no"}`);
        console.log(`Running:   ${status.running ? "yes" : "no"}`);
        if (status.pid) {
          console.log(`PID:       ${status.pid}`);
        }

        // Discord status
        console.log();
        if (config.discord?.token) {
          console.log("Discord:   configured");
        } else {
          console.log("Discord:   not configured (set discord.token in config)");
        }

        // Sandbox status
        console.log();
        try {
          const runtime = await detectRuntime(config.sandbox.runtime);
          console.log(`Container: ${runtime} (available)`);

          const proc = Bun.spawn(
            [runtime, "inspect", "--format", "{{.State.Status}}", config.sandbox.containerName],
            { stdout: "pipe", stderr: "pipe" },
          );
          const stdout = await new Response(proc.stdout).text();
          const exitCode = await proc.exited;

          if (exitCode === 0) {
            console.log(`Sandbox:   ${stdout.trim()}`);
          } else {
            console.log("Sandbox:   not created");
          }
        } catch {
          console.log("Container: not available");
          console.log("Sandbox:   N/A (running in direct mode)");
        }

        // Warnings
        if (status.warnings.length > 0) {
          console.log("\nWarnings:");
          for (const warning of status.warnings) {
            console.log(`  - ${warning}`);
          }
        }
      },
    }),
  },
});
