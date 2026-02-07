/**
 * Container Lifecycle Management
 */

import type { ContainerRuntime, ExecResult, SandboxConfig, SandboxState } from "./types";
import { SandboxError } from "../lib/errors";

async function run(
  runtime: ContainerRuntime,
  args: string[],
): Promise<ExecResult> {
  const proc = Bun.spawn([runtime, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function containerExists(
  runtime: ContainerRuntime,
  name: string,
): Promise<boolean> {
  const result = await run(runtime, [
    "inspect",
    "--format",
    "{{.State.Status}}",
    name,
  ]);
  return result.exitCode === 0;
}

export async function containerRunning(
  runtime: ContainerRuntime,
  name: string,
): Promise<boolean> {
  const result = await run(runtime, [
    "inspect",
    "--format",
    "{{.State.Running}}",
    name,
  ]);
  return result.exitCode === 0 && result.stdout === "true";
}

export async function getContainerState(
  config: SandboxConfig,
): Promise<SandboxState> {
  const exists = await containerExists(config.runtime, config.containerName);
  const running = exists
    ? await containerRunning(config.runtime, config.containerName)
    : false;

  let claudeInstalled = false;
  if (running) {
    const result = await execInContainer(
      config.runtime,
      config.containerName,
      ["claude", "--version"],
    );
    claudeInstalled = result.exitCode === 0;
  }

  return {
    exists,
    running,
    claudeInstalled,
    runtime: config.runtime,
    containerName: config.containerName,
  };
}

export async function createContainer(config: SandboxConfig): Promise<void> {
  const { runtime, containerName, image, mountPaths } = config;

  const args = [
    "create",
    "--name",
    containerName,
    "--interactive",
    "--tty",
  ];

  // Mount the .claude directory for auth
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "/root";
  args.push("-v", `${homeDir}/.claude:/root/.claude`);

  // Mount configured paths
  for (const mountPath of mountPaths) {
    args.push("-v", `${mountPath}:${mountPath}`);
  }

  args.push(image);
  // Keep the container running with a long-lived process
  args.push("sleep", "infinity");

  const result = await run(runtime, args);
  if (result.exitCode !== 0) {
    throw new SandboxError(
      `Failed to create container: ${result.stderr}`,
    );
  }
}

export async function startContainer(
  runtime: ContainerRuntime,
  name: string,
): Promise<void> {
  const result = await run(runtime, ["start", name]);
  if (result.exitCode !== 0) {
    throw new SandboxError(`Failed to start container: ${result.stderr}`);
  }
}

export async function stopContainer(
  runtime: ContainerRuntime,
  name: string,
): Promise<void> {
  const result = await run(runtime, ["stop", name]);
  if (result.exitCode !== 0) {
    throw new SandboxError(`Failed to stop container: ${result.stderr}`);
  }
}

export async function removeContainer(
  runtime: ContainerRuntime,
  name: string,
): Promise<void> {
  const result = await run(runtime, ["rm", "-f", name]);
  if (result.exitCode !== 0) {
    throw new SandboxError(`Failed to remove container: ${result.stderr}`);
  }
}

export async function execInContainer(
  runtime: ContainerRuntime,
  name: string,
  command: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): Promise<ExecResult> {
  const args = ["exec"];

  if (options?.cwd) {
    args.push("-w", options.cwd);
  }

  for (const [key, value] of Object.entries(options?.env ?? {})) {
    args.push("-e", `${key}=${value}`);
  }

  args.push(name, ...command);

  return run(runtime, args);
}

export async function pullImage(
  runtime: ContainerRuntime,
  image: string,
): Promise<void> {
  const result = await run(runtime, ["pull", image]);
  if (result.exitCode !== 0) {
    throw new SandboxError(`Failed to pull image ${image}: ${result.stderr}`);
  }
}
