/**
 * Linux systemd Service Management
 */

import { mkdir } from "fs/promises";
import { paths } from "../config/paths";
import type { ServiceStatus } from "./types";

const SERVICE_NAME = "claudebot";

function generateUnit(executablePath: string): string {
  return `[Unit]
Description=Claudebot Personal AI Bot
After=network.target

[Service]
Type=simple
ExecStart=${executablePath} daemon
Restart=always
RestartSec=5
Environment=PATH=/usr/local/bin:/usr/bin:/bin:${process.env.HOME}/.bun/bin:${process.env.HOME}/.local/bin

[Install]
WantedBy=default.target
`;
}

export async function installSystemd(
  executablePath: string,
): Promise<void> {
  await mkdir(paths.systemdUserDir, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });

  const unit = generateUnit(executablePath);
  await Bun.write(paths.serviceUnit, unit);

  // Reload systemd user daemon
  const proc = Bun.spawn(["systemctl", "--user", "daemon-reload"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
}

export async function startSystemd(): Promise<void> {
  const proc = Bun.spawn(
    ["systemctl", "--user", "start", SERVICE_NAME],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to start service: ${stderr.trim()}`);
  }
}

export async function stopSystemd(): Promise<void> {
  const proc = Bun.spawn(
    ["systemctl", "--user", "stop", SERVICE_NAME],
    { stdout: "pipe", stderr: "pipe" },
  );
  await proc.exited;
}

export async function getSystemdStatus(): Promise<ServiceStatus> {
  const unitExists = await Bun.file(paths.serviceUnit).exists();
  if (!unitExists) {
    return { installed: false, running: false, warnings: ["Service not installed"] };
  }

  const proc = Bun.spawn(
    ["systemctl", "--user", "is-active", SERVICE_NAME],
    { stdout: "pipe", stderr: "pipe" },
  );
  const stdout = await new Response(proc.stdout).text();
  const running = stdout.trim() === "active";

  const warnings: string[] = [];

  let pid: number | undefined;
  if (running) {
    const pidProc = Bun.spawn(
      ["systemctl", "--user", "show", SERVICE_NAME, "--property=MainPID"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const pidOut = await new Response(pidProc.stdout).text();
    const match = pidOut.match(/MainPID=(\d+)/);
    if (match?.[1] && match[1] !== "0") {
      pid = parseInt(match[1], 10);
    }
  }

  return { installed: true, running, pid, warnings };
}
