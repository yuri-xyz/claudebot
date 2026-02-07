/**
 * Claude Code Control Protocol Helpers
 */

import type {
  ControlRequest,
  UserQuestionAnswers,
  PlanResponse,
  UserQuestion,
  PlanModeInput,
} from "./types";
import type { Logger } from "../lib/logger";
import {
  ControlRequestSchema,
  AskUserQuestionInputSchema,
  ExitPlanModeInputSchema,
} from "./schemas";

export function parseControlRequest(
  msg: unknown,
  logger?: Logger,
): ControlRequest | null {
  const result = ControlRequestSchema.safeParse(msg);
  if (result.success) {
    logger?.debug(
      `parseControlRequest: detected control_request with request_id=${result.data.request_id}`,
    );
    return result.data as ControlRequest;
  }
  return null;
}

export function extractQuestions(input: unknown): UserQuestion[] {
  const result = AskUserQuestionInputSchema.safeParse(input);
  if (result.success) {
    return result.data.questions;
  }
  return [];
}

export function extractPlanModeInput(input: unknown): PlanModeInput {
  const result = ExitPlanModeInputSchema.safeParse(input);
  return result.success ? result.data : {};
}

export function buildAllowResponse(
  requestId: string,
  originalInput: unknown,
): string {
  return JSON.stringify({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: {
        behavior: "allow",
        updatedInput: originalInput,
      },
    },
  });
}

export function buildDenyResponse(requestId: string): string {
  return JSON.stringify({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: {
        behavior: "deny",
      },
    },
  });
}

export function buildUserQuestionResponse(
  requestId: string,
  originalInput: unknown,
  answers: UserQuestionAnswers,
): string {
  const updatedInput = {
    ...(typeof originalInput === "object" && originalInput !== null
      ? originalInput
      : {}),
    answers,
  };

  return JSON.stringify({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: {
        behavior: "allow",
        updatedInput,
      },
    },
  });
}

export function buildPlanResponse(
  requestId: string,
  originalInput: unknown,
  planResponse: PlanResponse,
): string {
  if (planResponse.action === "denied") {
    return buildDenyResponse(requestId);
  }

  const updatedInput = {
    ...(typeof originalInput === "object" && originalInput !== null
      ? originalInput
      : {}),
    ...(planResponse.action === "changes_requested"
      ? { userNote: planResponse.userNote }
      : {}),
  };

  return JSON.stringify({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: {
        behavior: "allow",
        updatedInput,
      },
    },
  });
}

export function buildUserMessage(prompt: string): string {
  return JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "text", text: prompt }],
    },
  });
}
