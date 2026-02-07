import { describe, test, expect } from "bun:test";
import {
  parseControlRequest,
  buildAllowResponse,
  buildDenyResponse,
  buildUserMessage,
  extractQuestions,
} from "../../src/adapter/protocol";

describe("parseControlRequest", () => {
  test("parses valid control request", () => {
    const msg = {
      type: "control_request",
      request_id: "req-1",
      request: {
        subtype: "can_use_tool",
        tool_name: "Bash",
        input: { command: "ls" },
        tool_use_id: "tool-1",
      },
    };

    const result = parseControlRequest(msg);
    expect(result).not.toBeNull();
    expect(result!.request_id).toBe("req-1");
    expect(result!.request.tool_name).toBe("Bash");
  });

  test("returns null for non-control messages", () => {
    expect(parseControlRequest({ type: "message" })).toBeNull();
    expect(parseControlRequest(null)).toBeNull();
    expect(parseControlRequest("string")).toBeNull();
  });
});

describe("buildAllowResponse", () => {
  test("builds correct allow response", () => {
    const response = JSON.parse(buildAllowResponse("req-1", { cmd: "ls" }));

    expect(response.type).toBe("control_response");
    expect(response.response.request_id).toBe("req-1");
    expect(response.response.response.behavior).toBe("allow");
    expect(response.response.response.updatedInput).toEqual({ cmd: "ls" });
  });
});

describe("buildDenyResponse", () => {
  test("builds correct deny response", () => {
    const response = JSON.parse(buildDenyResponse("req-2"));

    expect(response.type).toBe("control_response");
    expect(response.response.request_id).toBe("req-2");
    expect(response.response.response.behavior).toBe("deny");
  });
});

describe("buildUserMessage", () => {
  test("builds correct user message", () => {
    const msg = JSON.parse(buildUserMessage("Hello!"));

    expect(msg.type).toBe("user");
    expect(msg.message.role).toBe("user");
    expect(msg.message.content).toEqual([
      { type: "text", text: "Hello!" },
    ]);
  });
});

describe("extractQuestions", () => {
  test("extracts questions from valid input", () => {
    const input = {
      questions: [
        {
          question: "Which option?",
          header: "Choice",
          options: [{ label: "A", description: "Option A" }],
          multiSelect: false,
        },
      ],
    };

    const questions = extractQuestions(input);
    expect(questions).toHaveLength(1);
    expect(questions[0]!.question).toBe("Which option?");
  });

  test("returns empty for invalid input", () => {
    expect(extractQuestions(null)).toEqual([]);
    expect(extractQuestions({})).toEqual([]);
  });
});
