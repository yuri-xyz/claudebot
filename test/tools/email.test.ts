import { describe, test, expect, afterEach } from "bun:test";
import { createEmailTools } from "../../src/tools/email";

const ENV_KEY = "CLAUDEBOT_AGENTMAIL_API_KEY";
const ENV_INBOX = "CLAUDEBOT_AGENTMAIL_INBOX_ID";

function setEnv() {
  process.env[ENV_KEY] = "test-key";
  process.env[ENV_INBOX] = "test@agentmail.to";
}

describe("createEmailTools", () => {
  const savedKey = process.env[ENV_KEY];
  const savedInbox = process.env[ENV_INBOX];

  afterEach(() => {
    if (savedKey !== undefined) process.env[ENV_KEY] = savedKey;
    else delete process.env[ENV_KEY];

    if (savedInbox !== undefined) process.env[ENV_INBOX] = savedInbox;
    else delete process.env[ENV_INBOX];
  });

  test("returns empty array when env vars are missing", () => {
    delete process.env[ENV_KEY];
    delete process.env[ENV_INBOX];
    expect(createEmailTools()).toEqual([]);
  });

  test("returns empty array when only API key is set", () => {
    process.env[ENV_KEY] = "test-key";
    delete process.env[ENV_INBOX];
    expect(createEmailTools()).toEqual([]);
  });

  test("returns empty array when only inbox ID is set", () => {
    delete process.env[ENV_KEY];
    process.env[ENV_INBOX] = "test@agentmail.to";
    expect(createEmailTools()).toEqual([]);
  });

  test("returns 4 tools when both env vars are set", () => {
    setEnv();
    expect(createEmailTools()).toHaveLength(4);
  });

  test("tools have correct names", () => {
    setEnv();
    const names = createEmailTools().map((t) => t.name);
    expect(names).toEqual([
      "claudebot_email_send",
      "claudebot_email_list",
      "claudebot_email_read",
      "claudebot_email_reply",
    ]);
  });

  test("send tool has correct input shape", () => {
    setEnv();
    const send = createEmailTools()[0]!;
    expect(send.inputShape.to).toBeDefined();
    expect(send.inputShape.subject).toBeDefined();
    expect(send.inputShape.text).toBeDefined();
    expect(send.inputShape.cc).toBeDefined();
    expect(send.inputShape.bcc).toBeDefined();
  });

  test("list tool has limit input", () => {
    setEnv();
    const list = createEmailTools()[1]!;
    expect(list.inputShape.limit).toBeDefined();
  });

  test("read tool has threadId input", () => {
    setEnv();
    const read = createEmailTools()[2]!;
    expect(read.inputShape.threadId).toBeDefined();
  });

  test("reply tool has messageId and text inputs", () => {
    setEnv();
    const reply = createEmailTools()[3]!;
    expect(reply.inputShape.messageId).toBeDefined();
    expect(reply.inputShape.text).toBeDefined();
  });
});
