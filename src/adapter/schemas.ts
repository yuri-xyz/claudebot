/**
 * Zod Schemas for Claude Code Protocol Messages
 */

import { z } from "zod";

export const PermissionSuggestionSchema = z.union([
  z.object({
    type: z.literal("setMode"),
    mode: z.string(),
    destination: z.string(),
  }),
  z.object({
    type: z.literal("addDirectories"),
    directories: z.array(z.string()),
    destination: z.string(),
  }),
  z.object({
    type: z.literal("addRules"),
    rules: z.array(
      z.object({ toolName: z.string(), ruleContent: z.string() }),
    ),
    behavior: z.string(),
    destination: z.string(),
  }),
]);

export const ControlRequestSchema = z.object({
  type: z.literal("control_request"),
  request_id: z.string(),
  request: z.object({
    subtype: z.literal("can_use_tool"),
    tool_name: z.string(),
    input: z.unknown(),
    tool_use_id: z.string(),
    permission_suggestions: z.array(PermissionSuggestionSchema).optional(),
    decision_reason: z.string().optional(),
  }),
});

export type ClaudeCodeControlRequest = z.infer<typeof ControlRequestSchema>;

export const AllowedPromptSchema = z.object({
  tool: z.literal("Bash"),
  prompt: z.string(),
});

export type AllowedPrompt = z.infer<typeof AllowedPromptSchema>;

/** Accepts both camelCase and snake_case fields, normalizes to camelCase. */
export const ExitPlanModeInputSchema = z
  .object({
    planFilePath: z.string().optional(),
    plan_file_path: z.string().optional(),
    plan: z.string().optional(),
    launchSwarm: z.boolean().optional(),
    launch_swarm: z.boolean().optional(),
    teammateCount: z.number().optional(),
    teammate_count: z.number().optional(),
    allowedPrompts: z.array(AllowedPromptSchema).optional(),
    allowed_prompts: z.array(AllowedPromptSchema).optional(),
    pushToRemote: z.boolean().optional(),
    push_to_remote: z.boolean().optional(),
    remoteSessionId: z.string().optional(),
    remote_session_id: z.string().optional(),
    remoteSessionUrl: z.string().optional(),
    remote_session_url: z.string().optional(),
    remoteSessionTitle: z.string().optional(),
    remote_session_title: z.string().optional(),
  })
  .passthrough()
  .transform((d) => ({
    planFilePath: d.planFilePath ?? d.plan_file_path,
    plan: d.plan,
    launchSwarm: d.launchSwarm ?? d.launch_swarm,
    teammateCount: d.teammateCount ?? d.teammate_count,
    allowedPrompts: d.allowedPrompts ?? d.allowed_prompts,
    pushToRemote: d.pushToRemote ?? d.push_to_remote,
    remoteSessionId: d.remoteSessionId ?? d.remote_session_id,
    remoteSessionUrl: d.remoteSessionUrl ?? d.remote_session_url,
    remoteSessionTitle: d.remoteSessionTitle ?? d.remote_session_title,
  }));

export const UserQuestionOptionSchema = z.object({
  label: z.string(),
  description: z.string(),
});

export const UserQuestionSchema = z.object({
  question: z.string(),
  header: z.string(),
  options: z.array(UserQuestionOptionSchema),
  multiSelect: z.boolean(),
});

export const AskUserQuestionInputSchema = z.object({
  questions: z.array(UserQuestionSchema),
});

export const ToolUseStartSchema = z.object({
  type: z.literal("content_block_start"),
  content_block: z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
  }),
});

export const ToolResultSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]).optional(),
  is_error: z.boolean().optional(),
});

export const ResultEventSchema = z.object({
  type: z.literal("result"),
  tool_use_id: z.string(),
  subtype: z.string().optional(),
  result: z.unknown().optional(),
});
