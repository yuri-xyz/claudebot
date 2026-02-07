/**
 * macOS launchd Service Management
 *
 * Generates and manages a LaunchAgent plist for the claudebot daemon.
 */

import { mkdir } from "fs/promises";
import { paths } from "../config/paths";
import type { ServiceStatus } from "./types";

const LABEL = "com.claudebot.service";

function generatePlist(executablePath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${executablePath}</string>
    <string>daemon</string>
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${paths.logsDir}/service-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${paths.logsDir}/service-stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${process.env.HOME}/.bun/bin:${process.env.HOME}/.local/bin</string>
  </dict>
</dict>
</plist>`;
}

export async function installLaunchd(
  executablePath: string,
): Promise<void> {
  await mkdir(paths.launchAgents, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });

  const plist = generatePlist(executablePath);
  await Bun.write(paths.servicePlist, plist);
}

export async function startLaunchd(): Promise<void> {
  const proc = Bun.spawn(
    ["launchctl", "load", "-w", paths.servicePlist],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to load service: ${stderr.trim()}`);
  }
}

export async function stopLaunchd(): Promise<void> {
  const proc = Bun.spawn(
    ["launchctl", "unload", paths.servicePlist],
    { stdout: "pipe", stderr: "pipe" },
  );
  await proc.exited;
}

export async function getLaunchdStatus(): Promise<ServiceStatus> {
  const warnings: string[] = [];

  // Check if plist exists
  const plistExists = await Bun.file(paths.servicePlist).exists();
  if (!plistExists) {
    return { installed: false, running: false, warnings: ["Service not installed"] };
  }

  // Check if loaded
  const proc = Bun.spawn(["launchctl", "list", LABEL], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  const running = exitCode === 0;

  let pid: number | undefined;
  if (running) {
    const stdout = await new Response(proc.stdout).text();
    const pidMatch = stdout.match(/"PID"\s*=\s*(\d+)/);
    if (pidMatch?.[1]) {
      pid = parseInt(pidMatch[1], 10);
    }
  }

  return { installed: true, running, pid, warnings };
}
