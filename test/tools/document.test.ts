import { describe, test, expect } from "bun:test";
import { documentTools } from "../../src/tools/document";

describe("documentTools", () => {
  const tool = documentTools[0]!;

  test("tool has correct name and shape", () => {
    expect(tool.name).toBe("claudebot_read_document");
    expect(tool.inputShape.path).toBeDefined();
    expect(tool.inputShape.format).toBeDefined();
  });

  test("rejects non-existent file", async () => {
    await expect(
      tool.handler({ path: "/tmp/nonexistent-abc123.pdf", format: "pdf" }),
    ).rejects.toThrow("File not found");
  });

  test("extracts text from a real PDF", async () => {
    // Create a minimal valid PDF in /tmp
    const minimalPdf = `%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Hello World) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000360 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
434
%%EOF`;

    const tmpPath = "/tmp/claudebot-test-doc.pdf";
    await Bun.write(tmpPath, minimalPdf);

    const result = await tool.handler({ path: tmpPath, format: "pdf" });
    expect(result).toStartWith("[PDF: 1 page]");
    expect(result).toContain("Hello World");
  });
});
