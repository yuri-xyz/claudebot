/**
 * Auto-Approval Logic
 */

import type { ControlRequest } from "./types";

export const AUTO_APPROVED_TOOLS = new Set([
  "Config",
  "Skill",
  "TodoWrite",
  "TodoRead",
  "TaskCreate",
  "TaskUpdate",
  "TaskGet",
  "TaskList",
  "TaskOutput",
  "TaskStop",
  "KillShell",
  "Task",
  "Agent",
  "ListMcpResources",
  "ReadMcpResource",
  "WebFetch",
  "WebSearch",
]);

export function createAutoApprovedSet(
  additionalTools?: string[],
): Set<string> {
  if (!additionalTools || additionalTools.length === 0) {
    return AUTO_APPROVED_TOOLS;
  }
  return new Set([...AUTO_APPROVED_TOOLS, ...additionalTools]);
}

export function shouldAutoApprove(
  request: ControlRequest,
  autoApprovedSet: Set<string> = AUTO_APPROVED_TOOLS,
): boolean {
  return autoApprovedSet.has(request.request.tool_name);
}

export function isAskUserQuestion(request: ControlRequest): boolean {
  return request.request.tool_name === "AskUserQuestion";
}

export function isExitPlanMode(request: ControlRequest): boolean {
  return request.request.tool_name === "ExitPlanMode";
}

export function isEnterPlanMode(request: ControlRequest): boolean {
  return request.request.tool_name === "EnterPlanMode";
}
