export { ClaudeCodeAdapter } from "./ClaudeCodeAdapter";
export {
  createBunProcessSpawner,
  createSandboxedProcessSpawner,
} from "./processSpawner";
export { buildArgs, DEFAULT_CLAUDE_CODE_MODEL } from "./argBuilder";
export { NdjsonParser } from "./ndjsonParser";
export {
  parseControlRequest,
  buildAllowResponse,
  buildDenyResponse,
  buildUserMessage,
} from "./protocol";
export {
  checkVersionCompatibility,
  parseVersion,
  SUPPORTED_CLAUDE_CODE_VERSION,
} from "./versionCheck";

export type {
  ClaudeCodeAdapterOptions,
  ClaudeCodeRunnerConfig,
  ClaudeCodeEventType,
  ClaudeCodeEventMap,
  ClaudeCodeEventHandler,
  AvailabilityResult,
  SpawnResult,
  ProcessSpawner,
  ProcessHandle,
  SpawnOptions,
  Logger,
  ControlRequest,
  PermissionSuggestion,
  UserQuestion,
  UserQuestionOption,
  UserQuestionAnswers,
  PlanResponse,
  MessageEvent,
  PermissionRequestEvent,
  UserQuestionEvent,
  PlanRequestEvent,
  EnterPlanModeEvent,
  ExecOutputEvent,
  ExecCompleteEvent,
  ErrorEvent,
  ExitEvent,
} from "./types";
