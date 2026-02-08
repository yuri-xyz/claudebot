/**
 * Shared diagnostic checks for doctor/setup commands.
 */

import { existsSync } from "fs";
import { paths } from "../config/paths";
import { loadConfig } from "../config/config";
import { ClaudebotConfigSchema } from "../config/types";
import {
  checkVersionCompatibility,
  SUPPORTED_CLAUDE_CODE_VERSION,
} from "../adapter/versionCheck";
import { detectRuntime } from "../sandbox/runtime";
import { getServiceManager } from "../service";
import { errorMessage } from "../lib/errors";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  optional: boolean;
}

// ── Individual checks ────────────────────────────────────────────────

export function checkBun(): CheckResult {
  return {
    name: "Bun runtime",
    status: "pass",
    message: `v${Bun.version}`,
    optional: false,
  };
}

export async function checkClaudeCli(): Promise<CheckResult> {
  try {
    const proc = Bun.spawn(["claude", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      return {
        name: "Claude CLI",
        status: "fail",
        message: "claude exited with non-zero status",
        optional: false,
      };
    }

    const version = output.trim();
    const compat = checkVersionCompatibility(version);

    if (compat.isCompatible) {
      return {
        name: "Claude CLI",
        status: "pass",
        message: `v${version} (supported: ${SUPPORTED_CLAUDE_CODE_VERSION})`,
        optional: false,
      };
    }

    return {
      name: "Claude CLI",
      status: "warn",
      message: compat.warning ?? `v${version}`,
      optional: false,
    };
  } catch {
    return {
      name: "Claude CLI",
      status: "fail",
      message: "not found — install from https://docs.anthropic.com/en/docs/claude-code",
      optional: false,
    };
  }
}

export async function checkContainerRuntime(): Promise<CheckResult> {
  try {
    const runtime = await detectRuntime("auto");
    return {
      name: "Container runtime",
      status: "pass",
      message: runtime,
      optional: true,
    };
  } catch {
    return {
      name: "Container runtime",
      status: "warn",
      message: "neither docker nor podman found (sandbox unavailable)",
      optional: true,
    };
  }
}

export async function checkConfigFile(): Promise<CheckResult> {
  try {
    const raw = await Bun.file(paths.configFile).text();
    ClaudebotConfigSchema.parse(JSON.parse(raw));
    return {
      name: "Config file",
      status: "pass",
      message: paths.configFile,
      optional: false,
    };
  } catch (err) {
    if (!existsSync(paths.configFile)) {
      return {
        name: "Config file",
        status: "fail",
        message: `missing — run "claudebot setup" to create`,
        optional: false,
      };
    }
    return {
      name: "Config file",
      status: "fail",
      message: `invalid — ${errorMessage(err)}`,
      optional: false,
    };
  }
}

export function checkDataDirs(): CheckResult {
  const dirs = [
    { label: "dataDir", path: paths.dataDir },
    { label: "logsDir", path: paths.logsDir },
    { label: "skillsDir", path: paths.skillsDir },
  ];

  const missing = dirs.filter((d) => !existsSync(d.path));

  if (missing.length === 0) {
    return {
      name: "Data directories",
      status: "pass",
      message: "all present",
      optional: false,
    };
  }

  return {
    name: "Data directories",
    status: "fail",
    message: `missing: ${missing.map((d) => d.label).join(", ")} — run "claudebot setup"`,
    optional: false,
  };
}

export async function checkDiscord(): Promise<CheckResult> {
  try {
    const config = await loadConfig();
    if (config.discord?.token) {
      return {
        name: "Discord",
        status: "pass",
        message: "token configured",
        optional: true,
      };
    }
    return {
      name: "Discord",
      status: "warn",
      message: "no token set (discord connector won't start)",
      optional: true,
    };
  } catch {
    return {
      name: "Discord",
      status: "warn",
      message: "could not read config",
      optional: true,
    };
  }
}

export function checkApiKey(): CheckResult {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      name: "API key",
      status: "pass",
      message: "ANTHROPIC_API_KEY is set",
      optional: false,
    };
  }
  return {
    name: "API key",
    status: "warn",
    message: "ANTHROPIC_API_KEY not set — Claude CLI may prompt for auth",
    optional: false,
  };
}

export async function checkService(): Promise<CheckResult> {
  try {
    const manager = getServiceManager();
    const status = await manager.getStatus();

    if (!status.installed) {
      return {
        name: "Background service",
        status: "warn",
        message: `not installed — run "claudebot service install"`,
        optional: true,
      };
    }

    if (!status.running) {
      return {
        name: "Background service",
        status: "warn",
        message: `installed but not running — run "claudebot service start"`,
        optional: true,
      };
    }

    const pidInfo = status.pid ? ` (pid ${status.pid})` : "";
    return {
      name: "Background service",
      status: "pass",
      message: `running via ${manager.platform}${pidInfo}`,
      optional: true,
    };
  } catch {
    return {
      name: "Background service",
      status: "warn",
      message: "could not check service status",
      optional: true,
    };
  }
}

// ── Aggregation ──────────────────────────────────────────────────────

export async function runAllChecks(): Promise<CheckResult[]> {
  return [
    checkBun(),
    await checkClaudeCli(),
    await checkContainerRuntime(),
    await checkConfigFile(),
    checkDataDirs(),
    await checkDiscord(),
    checkApiKey(),
    await checkService(),
  ];
}

// ── Output ───────────────────────────────────────────────────────────

const SYMBOLS: Record<CheckStatus, string> = {
  pass: "\x1b[32m\u2714\x1b[0m", // green checkmark
  warn: "\x1b[33m\u26A0\x1b[0m", // yellow warning
  fail: "\x1b[31m\u2718\x1b[0m", // red cross
};

export function printCheckResults(results: CheckResult[]): void {
  console.log("\nclaudebot doctor");
  console.log("================\n");

  for (const r of results) {
    const symbol = SYMBOLS[r.status];
    const tag = r.optional ? " (optional)" : "";
    console.log(`  ${symbol}  ${r.name}${tag}: ${r.message}`);
  }

  console.log();
}

export function hasRequiredFailures(results: CheckResult[]): boolean {
  return results.some((r) => r.status === "fail" && !r.optional);
}
