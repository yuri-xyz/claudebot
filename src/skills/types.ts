export interface SkillMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  source: string;
  installedAt: string;
}

export interface ParsedSkill {
  metadata: SkillMetadata;
  rawContent: string;
  body: string;
}

export interface SkillSource {
  type: "github" | "url";
  identifier: string;
  rawUrl: string;
}
