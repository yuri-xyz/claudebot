/**
 * SKILL.md Parser
 *
 * Parses skill files with optional YAML frontmatter.
 * Format: YAML between --- markers, followed by markdown body.
 */

import { parse as parseYaml } from "yaml";
import type { ParsedSkill, SkillMetadata } from "./types";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function deriveNameFromSource(source: string): string {
  // Extract last path segment, clean it up
  const parts = source.replace(/\/$/, "").split("/");
  const last = parts[parts.length - 1] ?? "unknown";
  return last.replace(/\.md$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function parseSkillContent(
  content: string,
  source: string,
): ParsedSkill {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    // No frontmatter -- entire content is the body
    const name = deriveNameFromSource(source);
    return {
      metadata: {
        name,
        source,
        installedAt: new Date().toISOString(),
      },
      rawContent: content,
      body: content,
    };
  }

  const [, frontmatterRaw, body] = match;
  let yamlData: Record<string, unknown> = {};

  try {
    yamlData = (parseYaml(frontmatterRaw!) as Record<string, unknown>) ?? {};
  } catch {
    // Invalid YAML, treat as no frontmatter
    return {
      metadata: {
        name: deriveNameFromSource(source),
        source,
        installedAt: new Date().toISOString(),
      },
      rawContent: content,
      body: content,
    };
  }

  const metadata: SkillMetadata = {
    name:
      typeof yamlData.name === "string"
        ? yamlData.name
        : deriveNameFromSource(source),
    description:
      typeof yamlData.description === "string"
        ? yamlData.description
        : undefined,
    version:
      typeof yamlData.version === "string" ? yamlData.version : undefined,
    author: typeof yamlData.author === "string" ? yamlData.author : undefined,
    source,
    installedAt: new Date().toISOString(),
  };

  return {
    metadata,
    rawContent: content,
    body: body!,
  };
}
