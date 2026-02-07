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
