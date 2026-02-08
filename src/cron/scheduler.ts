/**
 * Cron Scheduler
 *
 * Simple in-process scheduler that checks cron expressions
 * and fires jobs when they match the current time.
 */

import type { CronJob } from "./types";

/**
 * Parses a 5-field cron expression and checks if it matches a given date.
 * Fields: minute hour day-of-month month day-of-week
 * Supports: *, numbers, ranges (1-5), lists (1,3,5), steps (∗/5)
 */
export function matchesCron(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  return (
    matchesField(minuteExpr, date.getMinutes(), 0, 59) &&
    matchesField(hourExpr, date.getHours(), 0, 23) &&
    matchesField(domExpr, date.getDate(), 1, 31) &&
    matchesField(monthExpr, date.getMonth() + 1, 1, 12) &&
    matchesField(dowExpr, date.getDay(), 0, 6)
  );
}

function matchesField(
  expr: string,
  value: number,
  min: number,
  max: number,
): boolean {
  if (expr === "*") return true;

  // Step: */n or range/n
  if (expr.includes("/")) {
    const [rangeStr, stepStr] = expr.split("/") as [string, string];
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) return false;

    let rangeMin = min;
    let rangeMax = max;
    if (rangeStr !== "*") {
      const range = parseRange(rangeStr);
      if (!range) return false;
      [rangeMin, rangeMax] = range;
    }

    if (value < rangeMin || value > rangeMax) return false;
    return (value - rangeMin) % step === 0;
  }

  // List: a,b,c
  if (expr.includes(",")) {
    return expr.split(",").some((part) => matchesField(part, value, min, max));
  }

  // Range: a-b
  if (expr.includes("-")) {
    const range = parseRange(expr);
    if (!range) return false;
    const [start, end] = range;
    return value >= start && value <= end;
  }

  // Single value
  const num = parseInt(expr, 10);
  return !isNaN(num) && num === value;
}

function parseRange(expr: string): [number, number] | null {
  const [startStr, endStr] = expr.split("-") as [string, string];
  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  if (isNaN(start) || isNaN(end)) return null;
  return [start, end];
}

/**
 * Returns true if a runAt timestamp is due (past, within a 60s grace window).
 */
export function isRunAtDue(runAt: string, now: Date): boolean {
  const target = new Date(runAt).getTime();
  if (isNaN(target)) return false;
  const diff = now.getTime() - target;
  return diff >= 0 && diff < 60_000;
}

/**
 * Gets jobs that should run at the given time.
 */
export function getJobsDue(jobs: CronJob[], now: Date): CronJob[] {
  return jobs.filter((job) => {
    if (!job.enabled) return false;
    if (job.runAt) return isRunAtDue(job.runAt, now);
    if (job.schedule) return matchesCron(job.schedule, now);
    return false;
  });
}
