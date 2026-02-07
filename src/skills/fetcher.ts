/**
 * Skill Fetcher
 *
 * Resolves skill identifiers to fetchable URLs and downloads them.
 * Supports:
 * - "owner/repo" -> GitHub raw SKILL.md from repo root
 * - "owner/repo/skill-name" -> GitHub raw SKILL.md from subdirectory
 * - Full URLs -> fetched directly
 */

import type { SkillSource } from "./types";
import { SkillsError } from "../lib/errors";

const URL_REGEX = /^https?:\/\//;

export function resolveSkillSource(identifier: string): SkillSource {
  if (URL_REGEX.test(identifier)) {
    return {
      type: "url",
      identifier,
      rawUrl: identifier,
    };
  }

  // GitHub format: owner/repo or owner/repo/path/to/skill
  const parts = identifier.split("/");

  if (parts.length < 2) {
    throw new SkillsError(
      `Invalid skill identifier: "${identifier}". Use "owner/repo", "owner/repo/skill-name", or a full URL.`,
    );
  }

  const [owner, repo, ...pathParts] = parts;
  const skillPath =
    pathParts.length > 0 ? `${pathParts.join("/")}/SKILL.md` : "SKILL.md";

  // Try main branch first, then master
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${skillPath}`;

  return {
    type: "github",
    identifier,
    rawUrl,
  };
}

export async function fetchSkillContent(source: SkillSource): Promise<string> {
  let response = await fetch(source.rawUrl);

  // If main branch fails for GitHub, try master
  if (!response.ok && source.type === "github") {
    const masterUrl = source.rawUrl.replace("/main/", "/master/");
    response = await fetch(masterUrl);
  }

  if (!response.ok) {
    throw new SkillsError(
      `Failed to fetch skill from ${source.rawUrl}: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}
