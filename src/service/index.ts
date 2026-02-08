import { resolve, join } from "path";

export { detectPlatform } from "./platform";
export {
  installLaunchd,
  startLaunchd,
  stopLaunchd,
  getLaunchdStatus,
} from "./launchd";
export {
  installSystemd,
  startSystemd,
  stopSystemd,
  getSystemdStatus,
} from "./systemd";
export type { ServiceStatus, ServicePlatform } from "./types";

import { detectPlatform } from "./platform";
import {
  installLaunchd,
  startLaunchd,
  stopLaunchd,
  getLaunchdStatus,
} from "./launchd";
import {
  installSystemd,
  startSystemd,
  stopSystemd,
  getSystemdStatus,
} from "./systemd";
import type { ServiceStatus, ServicePlatform } from "./types";

export interface ServiceManager {
  platform: ServicePlatform;
  install(programArgs: string[]): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ServiceStatus>;
}

/**
 * Build the program arguments array for the daemon entrypoint.
 * @param callerDir - pass `import.meta.dir` from the calling CLI module
 */
export function buildDaemonArgs(callerDir: string): string[] {
  const entrypoint = resolve(join(callerDir, "..", "index.ts"));
  const bunPath = process.argv[0] ?? "bun";
  return [bunPath, "run", entrypoint, "daemon"];
}

export function getServiceManager(): ServiceManager {
  const platform = detectPlatform();

  if (platform === "launchd") {
    return {
      platform,
      install: installLaunchd,
      start: startLaunchd,
      stop: stopLaunchd,
      getStatus: getLaunchdStatus,
    };
  }

  return {
    platform,
    install: installSystemd,
    start: startSystemd,
    stop: stopSystemd,
    getStatus: getSystemdStatus,
  };
}
