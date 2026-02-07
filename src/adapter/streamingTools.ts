/**
 * Streaming Tool Detection
 */

export const STREAMING_EXEC_TOOL_NAMES = ["Bash", "EXEC"] as const;

export type StreamingExecToolName = (typeof STREAMING_EXEC_TOOL_NAMES)[number];

export function isStreamingExecTool(
  toolName: string,
): toolName is StreamingExecToolName {
  return (STREAMING_EXEC_TOOL_NAMES as readonly string[]).includes(toolName);
}
