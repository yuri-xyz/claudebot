import { mkdir } from "fs/promises";
import { paths } from "./paths";
import { ClaudebotConfigSchema, type ClaudebotConfig } from "./types";

export async function loadConfig(): Promise<ClaudebotConfig> {
  try {
    const raw = await Bun.file(paths.configFile).text();
    const parsed = JSON.parse(raw) as unknown;
    return ClaudebotConfigSchema.parse(parsed);
  } catch {
    return ClaudebotConfigSchema.parse({});
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
