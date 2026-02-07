/**
 * Container Runtime Detection
 *
 * Detects whether docker or podman is available.
 */

import type { ContainerRuntime } from "./types";
import { SandboxError } from "../lib/errors";

async function isAvailable(command: string): Promise<boolean> {
  try {
    const proc = Bun.spawn([command, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

export async function detectRuntime(
  preference: "docker" | "podman" | "auto" = "auto",
): Promise<ContainerRuntime> {
  if (preference !== "auto") {
    const available = await isAvailable(preference);
    if (!available) {
      throw new SandboxError(
        `${preference} is not available. Please install ${preference} first.`,
      );
    }
    return preference;
  }

  if (await isAvailable("docker")) return "docker";
  if (await isAvailable("podman")) return "podman";

  throw new SandboxError(
    "No container runtime found. Please install docker or podman.",
  );
}
