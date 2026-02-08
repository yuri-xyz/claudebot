/**
 * Service CLI Commands
 */

import { defineCommand } from "citty";
import { errorMessage } from "../lib/errors";
import { getServiceManager, buildDaemonArgs } from "../service";
import { loadConfig, ensureDataDirs, clearServiceLogs, paths } from "../config";
import { setupSandbox } from "../sandbox/setup";
import { detectRuntime } from "../sandbox/runtime";
import { getContainerState } from "../sandbox/container";
import { buildSandboxConfig } from "../sandbox/types";
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
        const svc = getServiceManager();

        const programArgs = buildDaemonArgs(import.meta.dir);

        await clearServiceLogs();

        console.log(`Installing claudebot service (${svc.platform})...`);
        await svc.install(programArgs);
        console.log("Service installed.");

        // Setup sandbox if a container runtime is available
        try {
          const runtime = await detectRuntime(config.sandbox.runtime);
          const sandboxCfg = buildSandboxConfig(config.sandbox, runtime);

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
        const svc = getServiceManager();
        console.log("Starting claudebot service...");

        try {
          await svc.start();
          console.log("Service started.");
        } catch (err) {
          console.error("Error:", errorMessage(err));
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
        const svc = getServiceManager();
        console.log("Stopping claudebot service...");

        try {
          await svc.stop();
          console.log("Service stopped.");
        } catch (err) {
          console.error("Error:", errorMessage(err));
          process.exit(1);
        }
      },
    }),

    restart: defineCommand({
      meta: {
        name: "restart",
        description: "Restart the background service",
      },
      async run() {
        const svc = getServiceManager();

        try {
          const status = await svc.getStatus();
          if (status.running) {
            console.log("Stopping claudebot service...");
            await svc.stop();
          }

          console.log("Starting claudebot service...");
          await svc.start();
          console.log("Service restarted.");
        } catch (err) {
          console.error("Error:", errorMessage(err));
          process.exit(1);
        }
      },
    }),

    logs: defineCommand({
      meta: {
        name: "logs",
        description: "Tail service logs",
      },
      args: {
        follow: {
          type: "boolean",
          alias: "f",
          description: "Follow log output (like tail -f)",
          default: false,
        },
        lines: {
          type: "string",
          alias: "n",
          description: "Number of lines to show",
          default: "50",
        },
      },
      async run({ args }) {
        const tailArgs = ["-n", args.lines as string];
        if (args.follow) tailArgs.push("-f");

        const proc = Bun.spawn(
          ["tail", ...tailArgs, paths.serviceStdoutLog, paths.serviceStderrLog],
          { stdout: "inherit", stderr: "inherit" },
        );

        await proc.exited;
      },
    }),

    status: defineCommand({
      meta: {
        name: "status",
        description: "Show service status and health",
      },
      async run() {
        const config = await loadConfig();
        const svc = getServiceManager();
        const status = await svc.getStatus();

        console.log("claudebot service status");
        console.log("========================");
        console.log(`Platform:  ${svc.platform}`);
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

          const sandboxCfg = buildSandboxConfig(config.sandbox, runtime);
          const state = await getContainerState(sandboxCfg);

          if (state.exists) {
            console.log(`Sandbox:   ${state.running ? "running" : "stopped"}`);
          } else {
            console.log("Sandbox:   not created");
          }
        } catch {
          console.log("Container: not available");
          console.log("Sandbox:   N/A (running in direct mode)");
        }

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
