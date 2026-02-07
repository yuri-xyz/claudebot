import { describe, test, expect } from "bun:test";
import { parseSkillContent } from "../../src/skills/parser";

describe("parseSkillContent", () => {
  test("parses content with YAML frontmatter", () => {
    const content = `---
name: my-skill
description: A test skill
version: 1.0.0
author: test
---
# My Skill

This is the body.`;

    const skill = parseSkillContent(content, "test/repo");

    expect(skill.metadata.name).toBe("my-skill");
    expect(skill.metadata.description).toBe("A test skill");
    expect(skill.metadata.version).toBe("1.0.0");
    expect(skill.metadata.author).toBe("test");
    expect(skill.metadata.source).toBe("test/repo");
    expect(skill.body).toContain("# My Skill");
  });

  test("parses content without frontmatter", () => {
    const content = "# Just a markdown file\n\nSome content.";

    const skill = parseSkillContent(content, "owner/repo/my-skill");

    expect(skill.metadata.name).toBe("my-skill");
    expect(skill.body).toBe(content);
    expect(skill.rawContent).toBe(content);
  });

  test("derives name from source path", () => {
    const content = "# Content";

    const skill = parseSkillContent(content, "owner/repo/nested/cool-skill");

    expect(skill.metadata.name).toBe("cool-skill");
  });

  test("handles frontmatter with missing optional fields", () => {
    const content = `---
name: minimal
---
Body content`;

    const skill = parseSkillContent(content, "test");

    expect(skill.metadata.name).toBe("minimal");
    expect(skill.metadata.description).toBeUndefined();
    expect(skill.metadata.version).toBeUndefined();
  });

  test("handles invalid YAML gracefully", () => {
    // Use content that won't match the frontmatter regex at all
    const content = `---
broken frontmatter without closing`;

    const skill = parseSkillContent(content, "test/repo");

    expect(skill.metadata.name).toBeTruthy();
    expect(skill.body).toBe(content);
    expect(skill.rawContent).toBe(content);
  });
});
