import { describe, test, expect } from "bun:test";
import { ClaudebotConfigSchema, SignalConfigSchema } from "../../src/config/types";

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

  test("parses config with signal section", () => {
    const config = ClaudebotConfigSchema.parse({
      signal: {
        account: "+1234567890",
        allowedNumbers: ["+9876543210"],
      },
    });
    expect(config.signal!.account).toBe("+1234567890");
    expect(config.signal!.signalCliBin).toBe("signal-cli");
    expect(config.signal!.allowedNumbers).toEqual(["+9876543210"]);
  });
});

describe("SignalConfigSchema", () => {
  test("parses valid E.164 numbers", () => {
    const result = SignalConfigSchema.parse({
      account: "+1234567890",
      allowedNumbers: ["+44712345678"],
    });
    expect(result.account).toBe("+1234567890");
    expect(result.signalCliBin).toBe("signal-cli");
  });

  test("rejects account without + prefix", () => {
    const result = SignalConfigSchema.safeParse({ account: "1234567890" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain("E.164");
    }
  });

  test("rejects account with leading zero after +", () => {
    const result = SignalConfigSchema.safeParse({ account: "+0123456789" });
    expect(result.success).toBe(false);
  });

  test("rejects account with non-digit characters", () => {
    const result = SignalConfigSchema.safeParse({ account: "+1-234-567" });
    expect(result.success).toBe(false);
  });

  test("rejects empty account", () => {
    const result = SignalConfigSchema.safeParse({ account: "" });
    expect(result.success).toBe(false);
  });

  test("rejects account with only +", () => {
    const result = SignalConfigSchema.safeParse({ account: "+" });
    expect(result.success).toBe(false);
  });

  test("rejects allowedNumbers with invalid format", () => {
    const result = SignalConfigSchema.safeParse({
      account: "+1234567890",
      allowedNumbers: ["not-a-number"],
    });
    expect(result.success).toBe(false);
  });

  test("accepts custom signalCliBin path", () => {
    const result = SignalConfigSchema.parse({
      account: "+1234567890",
      signalCliBin: "/usr/local/bin/signal-cli",
    });
    expect(result.signalCliBin).toBe("/usr/local/bin/signal-cli");
  });
});
