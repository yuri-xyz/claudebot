/**
 * `claudebot container` — spawn an interactive shell inside the sandbox container.
 */

import { defineCommand } from "citty";
import { loadConfig } from "../config/config";
import { detectRuntime } from "../sandbox/runtime";
import { containerExists, containerRunning, startContainer } from "../sandbox/container";

export default defineCommand({
  meta: {
    name: "container",
    description: "Open a shell inside the sandbox container",
  },
  args: {
    command: {
      type: "positional",
      required: false,
      description: "Command to run (default: bash)",
    },
  },
  async run({ args }) {
    const config = await loadConfig();
    const sandbox = config.sandbox;

    const runtime = await detectRuntime(sandbox.runtime);
    const name = sandbox.containerName;

    if (!(await containerExists(runtime, name))) {
      console.error(`Container "${name}" does not exist. Run "claudebot setup" first.`);
      process.exit(1);
    }

    if (!(await containerRunning(runtime, name))) {
      console.log(`Starting container "${name}"...`);
      await startContainer(runtime, name);
    }

    const shell = (args.command as string) || "bash";

    const proc = Bun.spawn([runtime, "exec", "-it", name, shell], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;
    process.exit(exitCode);
  },
});
