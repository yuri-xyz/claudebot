/**
 * macOS launchd Service Management
 *
 * Generates and manages a LaunchAgent plist for the claudebot daemon.
 */

import { mkdir } from "fs/promises";
import { paths } from "../config/paths";
import type { ServiceStatus } from "./types";

const LABEL = "com.claudebot.service";

function generatePlist(programArgs: string[]): string {
  const argsXml = programArgs
    .map((a) => `    <string>${a}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argsXml}
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${paths.serviceStdoutLog}</string>
  <key>StandardErrorPath</key>
  <string>${paths.serviceStderrLog}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${process.env.HOME}/.bun/bin:${process.env.HOME}/.local/bin</string>
  </dict>
</dict>
</plist>`;
}

export async function installLaunchd(
  programArgs: string[],
): Promise<void> {
  await mkdir(paths.launchAgents, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });

  const plist = generatePlist(programArgs);
  await Bun.write(paths.servicePlist, plist);
}

export async function startLaunchd(): Promise<void> {
  const proc = Bun.spawn(
    ["launchctl", "load", "-w", paths.servicePlist],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stderr, exitCode] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
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

  const plistExists = await Bun.file(paths.servicePlist).exists();
  if (!plistExists) {
    return { installed: false, running: false, warnings: ["Service not installed"] };
  }

  const proc = Bun.spawn(["launchctl", "list", LABEL], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  const running = exitCode === 0;

  let pid: number | undefined;
  if (running) {
    const pidMatch = stdout.match(/"PID"\s*=\s*(\d+)/);
    if (pidMatch?.[1]) {
      pid = parseInt(pidMatch[1], 10);
    }
  }

  return { installed: true, running, pid, warnings };
}
