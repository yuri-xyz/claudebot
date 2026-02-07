import { describe, test, expect } from "bun:test";
import {
  ControlRequestSchema,
  ToolUseStartSchema,
  ToolResultSchema,
} from "../../src/adapter/schemas";

describe("ControlRequestSchema", () => {
  test("validates a correct control request", () => {
    const msg = {
      type: "control_request",
      request_id: "req-123",
      request: {
        subtype: "can_use_tool",
        tool_name: "Bash",
        input: { command: "echo hello" },
        tool_use_id: "tool-456",
      },
    };

    const result = ControlRequestSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  test("rejects invalid type", () => {
    const msg = {
      type: "message",
      request_id: "req-123",
      request: {
        subtype: "can_use_tool",
        tool_name: "Bash",
        input: {},
        tool_use_id: "tool-456",
      },
    };

    const result = ControlRequestSchema.safeParse(msg);
    expect(result.success).toBe(false);
  });
});

describe("ToolUseStartSchema", () => {
  test("validates tool use start", () => {
    const msg = {
      type: "content_block_start",
      content_block: {
        type: "tool_use",
        id: "tool-1",
        name: "Bash",
      },
    };

    const result = ToolUseStartSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });
});

describe("ToolResultSchema", () => {
  test("validates tool result with string content", () => {
    const msg = {
      type: "tool_result",
      tool_use_id: "tool-1",
      content: "output text",
      is_error: false,
    };

    const result = ToolResultSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  test("validates tool result without content", () => {
    const msg = {
      type: "tool_result",
      tool_use_id: "tool-1",
    };

    const result = ToolResultSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });
});
