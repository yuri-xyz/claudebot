export interface ServiceStatus {
  installed: boolean;
  running: boolean;
  pid?: number;
  warnings: string[];
}

export type ServicePlatform = "launchd" | "systemd";
