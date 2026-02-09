/**
 * Document Reading Tool
 *
 * Smart document reader that extracts text content from various file formats.
 * Currently supports: PDF
 */

import { z } from "zod";
import { match } from "ts-pattern";
import { extractText, getDocumentProxy } from "unpdf";
import type { ToolDefinition } from "./types";

const formatSchema = z.enum(["pdf"]);

const readDocumentTool: ToolDefinition = {
  name: "claudebot_read_document",
  description:
    "Read and extract text content from a document file. Returns the extracted text. Supported formats: PDF.",
  inputShape: {
    path: z.string().describe("Absolute path to the document file"),
    format: formatSchema.describe("Document format"),
  },
  async handler({ path, format }) {
    const fmt = formatSchema.parse(format);
    return match(fmt)
      .with("pdf", () => extractPdf(path))
      .exhaustive();
  },
};

async function extractPdf(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${path}`);
  }

  const buffer = await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });

  return `[PDF: ${totalPages} page${totalPages === 1 ? "" : "s"}]\n\n${text}`;
}

export const documentTools: ToolDefinition[] = [readDocumentTool];
