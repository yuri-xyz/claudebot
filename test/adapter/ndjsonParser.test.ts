import { describe, test, expect, mock } from "bun:test";
import { NdjsonParser } from "../../src/adapter/ndjsonParser";

describe("NdjsonParser", () => {
  test("parses complete JSON lines", () => {
    const messages: unknown[] = [];
    const parser = new NdjsonParser((msg) => messages.push(msg));

    parser.process('{"type":"test","value":1}\n');

    expect(messages).toEqual([{ type: "test", value: 1 }]);
  });

  test("parses multiple lines in a single chunk", () => {
    const messages: unknown[] = [];
    const parser = new NdjsonParser((msg) => messages.push(msg));

    parser.process('{"a":1}\n{"b":2}\n{"c":3}\n');

    expect(messages).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  test("buffers partial lines across chunks", () => {
    const messages: unknown[] = [];
    const parser = new NdjsonParser((msg) => messages.push(msg));

    parser.process('{"type":"te');
    expect(messages).toEqual([]);

    parser.process('st","value":42}\n');
    expect(messages).toEqual([{ type: "test", value: 42 }]);
  });

  test("handles non-JSON lines", () => {
    const messages: unknown[] = [];
    const nonJson: string[] = [];
    const parser = new NdjsonParser(
      (msg) => messages.push(msg),
      (line) => nonJson.push(line),
    );

    parser.process("not json\n");

    expect(messages).toEqual([]);
    expect(nonJson).toEqual(["not json"]);
  });

  test("skips empty lines", () => {
    const messages: unknown[] = [];
    const parser = new NdjsonParser((msg) => messages.push(msg));

    parser.process('\n\n{"a":1}\n\n');

    expect(messages).toEqual([{ a: 1 }]);
  });

  test("flush processes remaining buffer", () => {
    const messages: unknown[] = [];
    const parser = new NdjsonParser((msg) => messages.push(msg));

    parser.process('{"final":true}');
    expect(messages).toEqual([]);

    parser.flush();
    expect(messages).toEqual([{ final: true }]);
  });

  test("reset clears the buffer", () => {
    const messages: unknown[] = [];
    const parser = new NdjsonParser((msg) => messages.push(msg));

    parser.process('{"partial":');
    parser.reset();
    parser.process('{"complete":true}\n');

    expect(messages).toEqual([{ complete: true }]);
  });
});
