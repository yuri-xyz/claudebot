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
  install(executablePath: string): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ServiceStatus>;
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
