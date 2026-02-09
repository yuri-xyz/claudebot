import { mkdir } from "fs/promises";
import { z } from "zod";
import { paths } from "./paths";
import { ClaudebotConfigSchema, type ClaudebotConfig } from "./types";

const StringArray = z.array(z.string());
const RawConfig = z.record(z.unknown());

function tryParseJsonArray(value: string): string[] | undefined {
  try {
    const result = StringArray.safeParse(JSON.parse(value));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** Coerce an unknown value to a plain record, falling back to {}. */
function toRecord(value: unknown): Record<string, unknown> {
  return RawConfig.catch({}).parse(value);
}

/** Merge env vars onto raw config object before Zod validation. */
export function applyEnvOverlay(
  raw: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): Record<string, unknown> {
  const result = { ...raw };

  if (env.DISCORD_TOKEN) {
    result.discord = { ...toRecord(result.discord), token: env.DISCORD_TOKEN };
  }

  if (env.SIGNAL_ACCOUNT) {
    const overlay: Record<string, unknown> = { account: env.SIGNAL_ACCOUNT };

    if (env.SIGNAL_ALLOWED_NUMBERS) {
      const parsed = tryParseJsonArray(env.SIGNAL_ALLOWED_NUMBERS);
      if (parsed) overlay.allowedNumbers = parsed;
    }
    if (env.SIGNAL_ALLOWED_UUIDS) {
      const parsed = tryParseJsonArray(env.SIGNAL_ALLOWED_UUIDS);
      if (parsed) overlay.allowedUuids = parsed;
    }

    result.signal = { ...toRecord(result.signal), ...overlay };
  }

  if (env.X402_EVM_PRIVATE_KEY) {
    result.x402 = { ...toRecord(result.x402), evmPrivateKey: env.X402_EVM_PRIVATE_KEY };
  }

  if (env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID) {
    result.agentmail = {
      ...toRecord(result.agentmail),
      apiKey: env.AGENTMAIL_API_KEY,
      inboxId: env.AGENTMAIL_INBOX_ID,
    };
  }

  return result;
}

export async function loadConfig(): Promise<ClaudebotConfig> {
  try {
    const raw = await Bun.file(paths.configFile).text();
    const parsed = RawConfig.parse(JSON.parse(raw));
    return ClaudebotConfigSchema.parse(applyEnvOverlay(parsed));
  } catch {
    return ClaudebotConfigSchema.parse(applyEnvOverlay({}));
  }
}

export async function saveConfig(config: ClaudebotConfig): Promise<void> {
  await mkdir(paths.dataDir, { recursive: true });
  await Bun.write(paths.configFile, JSON.stringify(config, null, 2));
}

export async function ensureDataDirs(): Promise<void> {
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });
  await mkdir(paths.skillsDir, { recursive: true });
}

export async function clearServiceLogs(): Promise<void> {
  await Bun.write(paths.serviceStdoutLog, "");
  await Bun.write(paths.serviceStderrLog, "");
}
