import { describe, test, expect } from "bun:test";
import { chunkMessage, formatError } from "../../../src/connectors/discord/formatting";

describe("chunkMessage", () => {
  test("returns single chunk for short messages", () => {
    const chunks = chunkMessage("Hello world");
    expect(chunks).toEqual(["Hello world"]);
  });

  test("chunks long messages at newlines", () => {
    const longText = Array(50).fill("A".repeat(50)).join("\n");
    const chunks = chunkMessage(longText);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
  });

  test("preserves content when chunking", () => {
    const text = "Line 1\nLine 2\nLine 3";
    const chunks = chunkMessage(text);
    expect(chunks.join("\n")).toBe(text);
  });
});

describe("formatError", () => {
  test("formats error message", () => {
    const result = formatError("Something went wrong");
    expect(result).toContain("Error");
    expect(result).toContain("Something went wrong");
  });
});
