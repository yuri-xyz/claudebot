/**
 * Sandbox Setup
 *
 * First-run setup flow: pull image, create container, install Claude Code CLI.
 */

import type { SandboxConfig } from "./types";
import type { Logger } from "../lib/logger";
import {
  containerExists,
  containerRunning,
  createContainer,
  startContainer,
  pullImage,
  execInContainer,
} from "./container";
import { verifyAuthInContainer } from "./auth";
import { SandboxError } from "../lib/errors";

export async function setupSandbox(
  config: SandboxConfig,
  logger: Logger,
): Promise<void> {
  const { runtime, containerName, image } = config;

  // 1. Pull image if needed
  logger.info(`Pulling image ${image}...`);
  await pullImage(runtime, image);

  // 2. Create container if it doesn't exist
  if (await containerExists(runtime, containerName)) {
    logger.info(`Container ${containerName} already exists`);
  } else {
    logger.info(`Creating container ${containerName}...`);
    await createContainer(config);
  }

  // 3. Start container if not running
  if (!(await containerRunning(runtime, containerName))) {
    logger.info(`Starting container ${containerName}...`);
    await startContainer(runtime, containerName);
  }

  // 4. Verify auth
  const authOk = await verifyAuthInContainer(runtime, containerName);
  if (!authOk) {
    throw new SandboxError(
      "Claude auth credentials not found in container. Ensure ~/.claude is mounted.",
    );
  }

  // 5. Install Claude Code CLI if not present
  const claudeCheck = await execInContainer(runtime, containerName, [
    "which",
    "claude",
  ]);

  if (claudeCheck.exitCode !== 0) {
    logger.info("Installing Claude Code CLI in container...");

    // Install Node.js and npm first (needed for claude code)
    const installNode = await execInContainer(runtime, containerName, [
      "bash",
      "-c",
      "apt-get update && apt-get install -y curl && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs",
    ]);

    if (installNode.exitCode !== 0) {
      throw new SandboxError(
        `Failed to install Node.js: ${installNode.stderr}`,
      );
    }

    // Install Claude Code
    const installClaude = await execInContainer(runtime, containerName, [
      "npm",
      "install",
      "-g",
      "@anthropic-ai/claude-code",
    ]);

    if (installClaude.exitCode !== 0) {
      throw new SandboxError(
        `Failed to install Claude Code: ${installClaude.stderr}`,
      );
    }
  }

  // 6. Verify installation
  const versionCheck = await execInContainer(runtime, containerName, [
    "claude",
    "--version",
  ]);

  if (versionCheck.exitCode !== 0) {
    throw new SandboxError("Claude Code CLI installation verification failed.");
  }

  logger.info(`Sandbox ready. Claude Code version: ${versionCheck.stdout}`);
}

/**
 * Ensures the sandbox is running and ready for use.
 * Does minimal checks (no full setup) for fast invocations.
 */
export async function ensureSandboxReady(
  config: SandboxConfig,
  logger: Logger,
): Promise<void> {
  const { runtime, containerName } = config;

  if (!(await containerExists(runtime, containerName))) {
    throw new SandboxError(
      `Container ${containerName} does not exist. Run 'claudebot service install' first.`,
    );
  }

  if (!(await containerRunning(runtime, containerName))) {
    logger.info(`Starting container ${containerName}...`);
    await startContainer(runtime, containerName);
  }
}
