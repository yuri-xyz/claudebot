/**
 * Skill Fetcher
 *
 * Resolves skill identifiers to fetchable URLs and downloads them.
 * Supports:
 * - "owner/repo" -> GitHub raw SKILL.md from repo root
 * - "owner/repo/skill-name" -> GitHub raw SKILL.md from subdirectory
 * - Full URLs -> fetched directly
 */

import type { SkillSource, SkillSearchResult } from "./types";
import { SkillsError } from "../lib/errors";

const SKILLS_API = "https://skills.sh/api";

const URL_REGEX = /^https?:\/\//;

export function resolveSkillSource(identifier: string): SkillSource {
  if (URL_REGEX.test(identifier)) {
    return {
      type: "url",
      identifier,
      rawUrl: identifier,
    };
  }

  // GitHub format: owner/repo or owner/repo/skill-name
  const parts = identifier.split("/");

  if (parts.length < 2) {
    throw new SkillsError(
      `Invalid skill identifier: "${identifier}". Use "owner/repo", "owner/repo/skill-name", or a full URL.`,
    );
  }

  const [owner, repo, ...pathParts] = parts;
  const base = `https://raw.githubusercontent.com/${owner}/${repo}`;

  return {
    type: "github",
    identifier,
    // Primary candidate — refined during fetch with fallbacks
    rawUrl: pathParts.length > 0
      ? `${base}/main/skills/${pathParts.join("/")}/SKILL.md`
      : `${base}/main/SKILL.md`,
  };
}

export async function fetchSkillContent(source: SkillSource): Promise<string> {
  if (source.type === "url") {
    const response = await fetch(source.rawUrl);
    if (!response.ok) {
      throw new SkillsError(
        `Failed to fetch skill from ${source.rawUrl}: ${response.status} ${response.statusText}`,
      );
    }
    return response.text();
  }

  // For GitHub sources, try multiple candidate paths across branches.
  // Skills may live at skills/<name>/SKILL.md, <name>/SKILL.md, or root SKILL.md.
  const candidates = buildCandidateUrls(source.identifier);

  for (const url of candidates) {
    const response = await fetch(url);
    if (response.ok) return response.text();
  }

  throw new SkillsError(
    `Could not find SKILL.md for "${source.identifier}". Tried ${candidates.length} paths.`,
  );
}

const BRANCHES = ["main", "master"];

function buildCandidateUrls(identifier: string): string[] {
  const parts = identifier.split("/");
  const [owner, repo, ...pathParts] = parts;
  const base = `https://raw.githubusercontent.com/${owner}/${repo}`;
  const urls: string[] = [];

  for (const branch of BRANCHES) {
    if (pathParts.length > 0) {
      const name = pathParts.join("/");
      // Most common: skills/<name>/SKILL.md
      urls.push(`${base}/${branch}/skills/${name}/SKILL.md`);
      // Direct subdirectory: <name>/SKILL.md
      urls.push(`${base}/${branch}/${name}/SKILL.md`);
    } else {
      // Repo root SKILL.md
      urls.push(`${base}/${branch}/SKILL.md`);
    }
  }

  return urls;
}

export async function searchSkills(
  query: string,
  limit = 20,
): Promise<SkillSearchResult[]> {
  const url = `${SKILLS_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new SkillsError(
      `Skills search failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { skills: SkillSearchResult[] };
  return data.skills;
}
