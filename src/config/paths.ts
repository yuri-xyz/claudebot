import { join } from "path";
import { homedir } from "os";

const home = homedir();

export const paths = {
  // claudebot data
  dataDir: join(home, ".claudebot"),
  configFile: join(home, ".claudebot", "config.json"),
  cronsFile: join(home, ".claudebot", "crons.json"),
  logsDir: join(home, ".claudebot", "logs"),
  mcpConfigFile: join(home, ".claudebot", "mcp-config.json"),
  pidFile: join(home, ".claudebot", "daemon.pid"),

  // Claude ecosystem
  claudeDir: join(home, ".claude"),
  skillsDir: join(home, ".claude", "skills"),
  claudeConfigDir: join(home, ".claude"),

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
