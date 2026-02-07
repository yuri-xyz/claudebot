/**
 * Cron Job Storage
 *
 * Persists cron jobs to ~/.claudebot/crons.json
 */

import { mkdir } from "fs/promises";
import { dirname } from "path";
import { paths } from "../config/paths";
import { CronStorageSchema, type CronJob, type CronStorage } from "./types";

export async function loadCronStorage(): Promise<CronStorage> {
  try {
    const raw = await Bun.file(paths.cronsFile).text();
    const parsed = JSON.parse(raw) as unknown;
    return CronStorageSchema.parse(parsed);
  } catch {
    return { jobs: [] };
  }
}

export async function saveCronStorage(storage: CronStorage): Promise<void> {
  await mkdir(dirname(paths.cronsFile), { recursive: true });
  await Bun.write(paths.cronsFile, JSON.stringify(storage, null, 2));
}

export async function addCronJob(job: CronJob): Promise<void> {
  const storage = await loadCronStorage();
  storage.jobs.push(job);
  await saveCronStorage(storage);
}

export async function removeCronJob(id: string): Promise<boolean> {
  const storage = await loadCronStorage();
  const idx = storage.jobs.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  storage.jobs.splice(idx, 1);
  await saveCronStorage(storage);
  return true;
}

export async function updateCronJob(
  id: string,
  updates: Partial<CronJob>,
): Promise<boolean> {
  const storage = await loadCronStorage();
  const job = storage.jobs.find((j) => j.id === id);
  if (!job) return false;
  Object.assign(job, updates);
  await saveCronStorage(storage);
  return true;
}

export async function listCronJobs(): Promise<CronJob[]> {
  const storage = await loadCronStorage();
  return storage.jobs;
}

export async function getCronJob(id: string): Promise<CronJob | undefined> {
  const storage = await loadCronStorage();
  return storage.jobs.find((j) => j.id === id);
}
