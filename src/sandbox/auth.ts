/**
 * Auth Credential Management for Sandbox
 *
 * Copies Claude authentication credentials into the container.
 * In practice, we mount ~/.claude as a volume during container creation,
 * so this module provides verification and manual copy fallback.
 */

import type { ContainerRuntime } from "./types";
import { execInContainer } from "./container";

export async function verifyAuthInContainer(
  runtime: ContainerRuntime,
  containerName: string,
): Promise<boolean> {
  // Check if the .claude directory is accessible in the container
  const result = await execInContainer(runtime, containerName, [
    "test",
    "-d",
    "/root/.claude",
  ]);
  return result.exitCode === 0;
}

export async function copyAuthToContainer(
  runtime: ContainerRuntime,
  containerName: string,
): Promise<void> {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "/root";

  // Use docker cp as a fallback when volume mounts aren't set up
  const proc = Bun.spawn(
    [runtime, "cp", `${homeDir}/.claude`, `${containerName}:/root/.claude`],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [stderr, exitCode] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Failed to copy auth credentials: ${stderr.trim()}`);
  }
}
