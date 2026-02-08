import { describe, test, expect } from "bun:test";
import { resolveSkillSource } from "../../src/skills/fetcher";

describe("resolveSkillSource", () => {
  test("resolves owner/repo format", () => {
    const source = resolveSkillSource("vercel-labs/skills");

    expect(source.type).toBe("github");
    expect(source.identifier).toBe("vercel-labs/skills");
    expect(source.rawUrl).toBe(
      "https://raw.githubusercontent.com/vercel-labs/skills/main/SKILL.md",
    );
  });

  test("resolves owner/repo/skill-name format", () => {
    const source = resolveSkillSource("vercel-labs/skills/find-skills");

    expect(source.type).toBe("github");
    expect(source.rawUrl).toBe(
      "https://raw.githubusercontent.com/vercel-labs/skills/main/skills/find-skills/SKILL.md",
    );
  });

  test("resolves full URL", () => {
    const url = "https://example.com/skill.md";
    const source = resolveSkillSource(url);

    expect(source.type).toBe("url");
    expect(source.rawUrl).toBe(url);
  });

  test("throws for invalid identifier", () => {
    expect(() => resolveSkillSource("invalid")).toThrow(
      "Invalid skill identifier",
    );
  });

  test("handles deep paths", () => {
    const source = resolveSkillSource("owner/repo/path/to/deep/skill");

    expect(source.rawUrl).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/skills/path/to/deep/skill/SKILL.md",
    );
  });
});
