/**
 * Platform Detection
 */

import type { ServicePlatform } from "./types";

export function detectPlatform(): ServicePlatform {
  if (process.platform === "darwin") return "launchd";
  return "systemd";
}
