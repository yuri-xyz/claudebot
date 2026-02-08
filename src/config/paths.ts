import { join } from "path";
import { homedir } from "os";

const home = homedir();

export const paths = {
  // claudebot data
  dataDir: join(home, ".claudebot"),
  configFile: join(home, ".claudebot", "config.json"),
  soulFile: join(home, ".claudebot", "SOUL.md"),
  memoriesFile: join(home, ".claudebot", "memories.md"),
  cronsFile: join(home, ".claudebot", "crons.json"),
  logsDir: join(home, ".claudebot", "logs"),
  mcpConfigFile: join(home, ".claudebot", "mcp-config.json"),
  pidFile: join(home, ".claudebot", "daemon.pid"),

  // Service logs
  serviceStdoutLog: join(home, ".claudebot", "logs", "service-stdout.log"),
  serviceStderrLog: join(home, ".claudebot", "logs", "service-stderr.log"),

  // Agent working directory
  sandboxDir: join(home, ".claudebot", "sandbox"),
  downloadsDir: join(home, ".claudebot", "sandbox", "downloads"),

  // IPC files
  signalProfileUpdateFile: join(home, ".claudebot", "signal-profile-update.json"),

  // Skills storage (managed by claudebot, served via MCP tools)
  skillsDir: join(home, ".claudebot", "skills"),

  // Service (macOS)
  launchAgents: join(home, "Library", "LaunchAgents"),
  servicePlist: join(
    home,
    "Library",
    "LaunchAgents",
    "com.claudebot.service.plist",
  ),

  // Service (Linux)
  systemdUserDir: join(home, ".config", "systemd", "user"),
  serviceUnit: join(home, ".config", "systemd", "user", "claudebot.service"),
} as const;
