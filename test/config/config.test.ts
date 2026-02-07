import { describe, test, expect } from "bun:test";
import { ClaudebotConfigSchema } from "../../src/config/types";

describe("ClaudebotConfigSchema", () => {
  test("parses empty config with defaults", () => {
    const config = ClaudebotConfigSchema.parse({});

    expect(config.sandbox.runtime).toBe("auto");
    expect(config.sandbox.containerName).toBe("claudebot-sandbox");
    expect(config.sandbox.image).toBe("ubuntu:24.04");
    expect(config.agent.model).toBe("sonnet");
    expect(config.agent.maxTurns).toBe(50);
    expect(config.discord).toBeUndefined();
  });

  test("parses full config", () => {
    const config = ClaudebotConfigSchema.parse({
      discord: {
        token: "test-token",
        allowedChannelIds: ["123"],
        allowedUserIds: ["456"],
      },
      sandbox: {
        runtime: "podman",
        image: "debian:12",
        containerName: "my-bot",
        mountPaths: ["/home/user/projects"],
      },
      agent: {
        model: "opus",
        maxTurns: 100,
        maxBudgetUsd: 10,
      },
    });

    expect(config.discord!.token).toBe("test-token");
    expect(config.sandbox.runtime).toBe("podman");
    expect(config.agent.model).toBe("opus");
  });

  test("rejects invalid runtime", () => {
    const result = ClaudebotConfigSchema.safeParse({
      sandbox: { runtime: "invalid" },
    });
    expect(result.success).toBe(false);
  });
});
