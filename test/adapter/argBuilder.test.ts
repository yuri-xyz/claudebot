import { describe, test, expect } from "bun:test";
import { buildArgs } from "../../src/adapter/argBuilder";
import type { ClaudeCodeRunnerConfig } from "../../src/adapter/types";

describe("buildArgs", () => {
  test("produces default arguments", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "Hello",
      cwd: "/tmp",
    };

    const args = buildArgs(config);

    expect(args).toContain("--print");
    expect(args).toContain("--input-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--output-format");
    expect(args).toContain("--verbose");
    expect(args).toContain("--model");
  });

  test("includes resume session ID", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
      resumeSessionId: "session-123",
    };

    const args = buildArgs(config);

    expect(args).toContain("--resume");
    expect(args).toContain("session-123");
  });

  test("includes permission mode", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
      permissionMode: "bypassPermissions",
    };

    const args = buildArgs(config);

    expect(args).toContain("--permission-mode");
    expect(args).toContain("bypassPermissions");
  });

  test("includes max turns", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
      maxTurns: 25,
    };

    const args = buildArgs(config);

    expect(args).toContain("--max-turns");
    expect(args).toContain("25");
  });

  test("includes max budget", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
      maxBudgetUsd: 5.0,
    };

    const args = buildArgs(config);

    expect(args).toContain("--max-budget-usd");
    expect(args).toContain("5");
  });

  test("includes MCP config path with strict mode", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
      mcpConfigPath: "/path/to/mcp.json",
    };

    const args = buildArgs(config);

    expect(args).toContain("--strict-mcp-config");
    expect(args).toContain("--mcp-config");
    expect(args).toContain("/path/to/mcp.json");
  });

  test("always includes disable-slash-commands", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
    };

    const args = buildArgs(config);

    expect(args).toContain("--disable-slash-commands");
  });

  test("includes allowed tools", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
      allowedTools: ["Edit", "Write"],
    };

    const args = buildArgs(config);

    expect(args).toContain("--allowedTools");
    expect(args).toContain("Edit");
    expect(args).toContain("Write");
  });

  test("uses custom model", () => {
    const config: ClaudeCodeRunnerConfig = {
      prompt: "test",
      cwd: "/tmp",
    };

    const args = buildArgs(config, "opus");

    expect(args).toContain("--model");
    expect(args).toContain("opus");
  });
});
