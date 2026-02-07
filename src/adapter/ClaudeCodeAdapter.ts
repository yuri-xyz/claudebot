/**
 * Claude Code Adapter
 *
 * Manages Claude Code CLI processes with NDJSON communication,
 * event emission, and control protocol handling.
 */

import ms from "ms";
import type {
  ClaudeCodeAdapterOptions,
  ClaudeCodeEventHandler,
  ClaudeCodeEventMap,
  ClaudeCodeEventType,
  ClaudeCodeRunnerConfig,
  AvailabilityResult,
  SpawnResult,
  ControlRequest,
  ProcessHandle,
  UserQuestionAnswers,
  PlanResponse,
  Logger,
} from "./types";
import { buildArgs, DEFAULT_CLAUDE_CODE_MODEL } from "./argBuilder";
import {
  shouldAutoApprove,
  isAskUserQuestion,
  isExitPlanMode,
  isEnterPlanMode,
  createAutoApprovedSet,
} from "./autoApproval";
import {
  ExecOutputBufferManager,
  DEFAULT_EXEC_OUTPUT_THROTTLE_MS,
} from "./execBuffer";
import { NdjsonParser } from "./ndjsonParser";
import {
  parseControlRequest,
  extractQuestions,
  extractPlanModeInput,
  buildAllowResponse,
  buildDenyResponse,
  buildUserQuestionResponse,
  buildPlanResponse,
  buildUserMessage,
} from "./protocol";
import {
  ToolUseStartSchema,
  ToolResultSchema,
  ResultEventSchema,
} from "./schemas";
import { isStreamingExecTool } from "./streamingTools";
import {
  checkVersionCompatibility,
  SUPPORTED_CLAUDE_CODE_VERSION,
} from "./versionCheck";

const FORCE_KILL_TIMEOUT_MS = ms("5s");
const AVAILABILITY_CHECK_TIMEOUT_MS = ms("5s");

interface ProcessState {
  handle: ProcessHandle;
  pendingPermissionRequests: Map<string, ControlRequest>;
  activeBashTools: Set<string>;
  lastPlanFilePath?: string;
  parser: NdjsonParser;
}

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export class ClaudeCodeAdapter {
  private readonly options: Required<
    Pick<ClaudeCodeAdapterOptions, "processSpawner" | "execOutputThrottleMs">
  > &
    ClaudeCodeAdapterOptions;
  private readonly logger: Logger;
  private readonly autoApprovedTools: Set<string>;
  private readonly activeProcesses = new Map<string, ProcessState>();
  private readonly eventListeners = new Map<
    ClaudeCodeEventType,
    Set<ClaudeCodeEventHandler<ClaudeCodeEventType>>
  >();
  private processIdCounter = 0;
  private execBufferManager: ExecOutputBufferManager;

  constructor(options: ClaudeCodeAdapterOptions) {
    this.options = {
      ...options,
      execOutputThrottleMs:
        options.execOutputThrottleMs ?? DEFAULT_EXEC_OUTPUT_THROTTLE_MS,
    };
    this.logger = options.logger ?? noopLogger;
    this.autoApprovedTools = createAutoApprovedSet(
      options.additionalAutoApprovedTools,
    );

    this.execBufferManager = new ExecOutputBufferManager(
      this.options.execOutputThrottleMs,
      (toolUseId, content, stream) => {
        for (const [processId, state] of this.activeProcesses) {
          if (state.activeBashTools.has(toolUseId)) {
            this.emit("exec_output", {
              processId,
              toolUseId,
              chunk: content,
              stream,
            });
            break;
          }
        }
      },
    );
  }

  async checkAvailability(): Promise<AvailabilityResult> {
    try {
      const { stdout } = await this.options.processSpawner.execFile(
        "claude",
        ["--version"],
        { timeout: AVAILABILITY_CHECK_TIMEOUT_MS },
      );
      const version = stdout.trim();
      this.logger.info(`Claude Code CLI available: ${version}`);

      const compatibility = checkVersionCompatibility(version);

      if (!compatibility.isCompatible && compatibility.warning) {
        this.logger.warn(`Version warning: ${compatibility.warning}`);
      }

      return {
        available: true,
        version,
        versionCompatibility: {
          isCompatible: compatibility.isCompatible,
          warning: compatibility.warning,
          supportedVersion: SUPPORTED_CLAUDE_CODE_VERSION,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.info(`Claude Code CLI not available: ${message}`);
      return { available: false, error: message };
    }
  }

  async start(config: ClaudeCodeRunnerConfig): Promise<SpawnResult> {
    const processId = `claude-code-${++this.processIdCounter}`;
    const executable = config.executablePath ?? "claude";
    const args = buildArgs(config, DEFAULT_CLAUDE_CODE_MODEL);

    this.logger.info(
      `Spawning Claude Code process ${processId}: ${executable} ${args.join(" ")}`,
    );

    const handle = this.options.processSpawner.spawn(executable, args, {
      cwd: config.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        NO_COLOR: "1",
        TERM: "dumb",
      },
    });

    const state: ProcessState = {
      handle,
      pendingPermissionRequests: new Map(),
      activeBashTools: new Set(),
      parser: new NdjsonParser(
        (message) => this.handleMessage(processId, message),
        (line) =>
          this.logger.debug(
            `[${processId}] Non-JSON stdout: ${line.slice(0, 100)}`,
          ),
      ),
    };
    this.activeProcesses.set(processId, state);

    const userMessage = buildUserMessage(config.prompt);
    this.logger.debug(
      `[${processId}] Sending user message: ${userMessage.slice(0, 200)}`,
    );
    handle.writeStdin(userMessage + "\n");

    handle.onStdout((data: Buffer) => {
      const chunk = data.toString();
      this.logger.debug(
        `[${processId}] stdout chunk (${chunk.length} bytes)`,
      );
      state.parser.process(chunk);
    });

    handle.onStderr((data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.logger.debug(`[${processId}] stderr: ${message.slice(0, 200)}`);
        if (
          message.toLowerCase().includes("error") ||
          message.toLowerCase().includes("fatal")
        ) {
          this.emit("error", { processId, error: message });
        }
      }
    });

    handle.onError((error: Error) => {
      this.logger.error(`Process ${processId} error:`, error);
      this.emit("error", { processId, error: error.message });
      this.cleanup(processId);
    });

    handle.onExit((code: number | null, signal: string | null) => {
      this.logger.info(
        `Process ${processId} exited with code ${code}, signal ${signal}`,
      );
      this.emit("exit", { processId, code, signal });
      this.cleanup(processId);
    });

    return { processId };
  }

  sendMessage(processId: string, message: string): boolean {
    const state = this.activeProcesses.get(processId);
    if (!state) {
      this.logger.warn(`Cannot send message: process ${processId} not found`);
      return false;
    }

    const userMessage = buildUserMessage(message);
    return state.handle.writeStdin(userMessage + "\n");
  }

  abort(processId: string): boolean {
    const state = this.activeProcesses.get(processId);
    if (!state) {
      this.logger.warn(`Cannot abort: process ${processId} not found`);
      return false;
    }

    this.logger.info(`Aborting process ${processId}`);
    state.handle.kill("SIGTERM");

    setTimeout(() => {
      if (this.activeProcesses.has(processId)) {
        state.handle.kill("SIGKILL");
      }
    }, FORCE_KILL_TIMEOUT_MS);

    return true;
  }

  respondToPermission(
    processId: string,
    requestId: string,
    allowed: boolean,
  ): boolean {
    const state = this.activeProcesses.get(processId);
    if (!state) return false;

    const pendingRequest = state.pendingPermissionRequests.get(requestId);
    if (!pendingRequest) return false;

    const response = allowed
      ? buildAllowResponse(requestId, pendingRequest.request.input)
      : buildDenyResponse(requestId);

    const success = state.handle.writeStdin(response + "\n");

    if (success) {
      state.pendingPermissionRequests.delete(requestId);

      if (!allowed && isStreamingExecTool(pendingRequest.request.tool_name)) {
        const toolUseId = pendingRequest.request.tool_use_id;
        if (state.activeBashTools.has(toolUseId)) {
          state.activeBashTools.delete(toolUseId);
          this.execBufferManager.cleanup(toolUseId);
          this.emit("exec_complete", {
            processId,
            toolUseId,
            exitCode: null,
          });
        }
      }
    }

    return success;
  }

  respondToUserQuestion(
    processId: string,
    requestId: string,
    answers: UserQuestionAnswers | null,
  ): boolean {
    const state = this.activeProcesses.get(processId);
    if (!state) return false;

    const pendingRequest = state.pendingPermissionRequests.get(requestId);
    if (!pendingRequest) return false;

    const response =
      answers === null
        ? buildDenyResponse(requestId)
        : buildUserQuestionResponse(
            requestId,
            pendingRequest.request.input,
            answers,
          );

    const success = state.handle.writeStdin(response + "\n");

    if (success) {
      state.pendingPermissionRequests.delete(requestId);
    }

    return success;
  }

  respondToPlan(
    processId: string,
    requestId: string,
    response: PlanResponse | null,
  ): boolean {
    const state = this.activeProcesses.get(processId);
    if (!state) return false;

    const pendingRequest = state.pendingPermissionRequests.get(requestId);
    if (!pendingRequest) return false;

    if (response === null || response.action === "denied") {
      const denyResponse = buildDenyResponse(requestId);
      const success = state.handle.writeStdin(denyResponse + "\n");
      if (success) {
        state.pendingPermissionRequests.delete(requestId);
        state.handle.kill("SIGTERM");
      }
      return success;
    }

    const responseMessage = buildPlanResponse(
      requestId,
      pendingRequest.request.input,
      response,
    );

    const success = state.handle.writeStdin(responseMessage + "\n");

    if (success) {
      state.pendingPermissionRequests.delete(requestId);
    }

    return success;
  }

  on<E extends ClaudeCodeEventType>(
    event: E,
    handler: ClaudeCodeEventHandler<E>,
  ): () => void {
    let listeners = this.eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(event, listeners);
    }
    listeners.add(handler as ClaudeCodeEventHandler<ClaudeCodeEventType>);

    return () => {
      listeners?.delete(
        handler as ClaudeCodeEventHandler<ClaudeCodeEventType>,
      );
    };
  }

  cleanupAll(): void {
    for (const [id, state] of this.activeProcesses) {
      this.logger.info(`Cleaning up process ${id}`);
      state.handle.kill("SIGTERM");
    }
    this.activeProcesses.clear();
    this.execBufferManager.cleanupAll();
  }

  private emit<E extends ClaudeCodeEventType>(
    event: E,
    data: ClaudeCodeEventMap[E],
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const handler of listeners) {
        try {
          handler(data);
        } catch (error) {
          this.logger.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  private handleMessage(processId: string, rawMessage: unknown): void {
    const state = this.activeProcesses.get(processId);
    if (!state) return;

    const messageType =
      typeof rawMessage === "object" &&
      rawMessage !== null &&
      "type" in rawMessage
        ? String((rawMessage as { type: unknown }).type)
        : "unknown";

    this.logger.debug(`[${processId}] Event: type=${messageType}`);

    const controlRequest = parseControlRequest(rawMessage, this.logger);
    if (controlRequest) {
      this.handleControlRequest(processId, state, controlRequest);
      return;
    }

    this.handleBashToolEvents(processId, state, rawMessage);

    this.emit("message", { processId, message: rawMessage });
  }

  private handleControlRequest(
    processId: string,
    state: ProcessState,
    controlRequest: ControlRequest,
  ): void {
    this.logger.info(
      `[${processId}] Control request for tool: ${controlRequest.request.tool_name}`,
    );
    state.pendingPermissionRequests.set(
      controlRequest.request_id,
      controlRequest,
    );

    if (isAskUserQuestion(controlRequest)) {
      const questions = extractQuestions(controlRequest.request.input);
      this.emit("user_question", {
        processId,
        requestId: controlRequest.request_id,
        toolUseId: controlRequest.request.tool_use_id,
        questions,
      });
      return;
    }

    if (isEnterPlanMode(controlRequest)) {
      this.emit("enter_plan_mode", { processId });
      const response = buildAllowResponse(
        controlRequest.request_id,
        controlRequest.request.input,
      );
      state.handle.writeStdin(response + "\n");
      state.pendingPermissionRequests.delete(controlRequest.request_id);
      return;
    }

    if (shouldAutoApprove(controlRequest, this.autoApprovedTools)) {
      const response = buildAllowResponse(
        controlRequest.request_id,
        controlRequest.request.input,
      );
      state.handle.writeStdin(response + "\n");
      state.pendingPermissionRequests.delete(controlRequest.request_id);
      return;
    }

    if (isExitPlanMode(controlRequest)) {
      const planInput = extractPlanModeInput(controlRequest.request.input);
      const resolvedPlanFilePath =
        planInput.planFilePath ?? state.lastPlanFilePath;

      this.emit("plan_request", {
        processId,
        requestId: controlRequest.request_id,
        toolUseId: controlRequest.request.tool_use_id,
        planFilePath: resolvedPlanFilePath,
        planContent: planInput.plan,
        launchSwarm: planInput.launchSwarm,
        teammateCount: planInput.teammateCount,
        allowedPrompts: planInput.allowedPrompts,
        pushToRemote: planInput.pushToRemote,
        remoteSessionId: planInput.remoteSessionId,
        remoteSessionUrl: planInput.remoteSessionUrl,
        remoteSessionTitle: planInput.remoteSessionTitle,
      });
      return;
    }

    if (controlRequest.request.tool_name === "Write") {
      const input = controlRequest.request.input;
      const filePath =
        typeof input === "object" && input !== null && "file_path" in input
          ? String((input as { file_path: unknown }).file_path)
          : null;
      if (
        filePath?.includes(".claude/plans/") ||
        filePath?.includes("/.claude/plans/")
      ) {
        state.lastPlanFilePath = filePath;
      }
    }

    if (isStreamingExecTool(controlRequest.request.tool_name)) {
      state.activeBashTools.add(controlRequest.request.tool_use_id);
      this.emit("exec_output", {
        processId,
        toolUseId: controlRequest.request.tool_use_id,
        chunk: "",
        stream: "start",
      });
    }

    this.emit("permission_request", {
      processId,
      requestId: controlRequest.request_id,
      toolName: controlRequest.request.tool_name,
      toolInput: controlRequest.request.input,
      toolUseId: controlRequest.request.tool_use_id,
      decisionReason: controlRequest.request.decision_reason,
      permissionSuggestions: controlRequest.request.permission_suggestions,
    });
  }

  private handleBashToolEvents(
    processId: string,
    state: ProcessState,
    message: unknown,
  ): void {
    if (typeof message !== "object" || message === null) return;

    const toolUseStart = ToolUseStartSchema.safeParse(message);
    if (
      toolUseStart.success &&
      isStreamingExecTool(toolUseStart.data.content_block.name)
    ) {
      const toolUseId = toolUseStart.data.content_block.id;
      state.activeBashTools.add(toolUseId);
      this.emit("exec_output", {
        processId,
        toolUseId,
        chunk: "",
        stream: "start",
      });
      return;
    }

    const toolResult = ToolResultSchema.safeParse(message);
    if (
      toolResult.success &&
      state.activeBashTools.has(toolResult.data.tool_use_id)
    ) {
      const toolUseId = toolResult.data.tool_use_id;
      state.activeBashTools.delete(toolUseId);

      if (toolResult.data.content) {
        const content =
          typeof toolResult.data.content === "string"
            ? toolResult.data.content
            : JSON.stringify(toolResult.data.content);

        const stream = toolResult.data.is_error ? "stderr" : "stdout";
        this.execBufferManager.buffer(toolUseId, content, stream);
      }

      this.execBufferManager.flush(toolUseId);
      this.execBufferManager.cleanup(toolUseId);

      this.emit("exec_complete", {
        processId,
        toolUseId,
        exitCode: toolResult.data.is_error ? 1 : 0,
      });
      return;
    }

    const resultEvent = ResultEventSchema.safeParse(message);
    if (
      resultEvent.success &&
      state.activeBashTools.has(resultEvent.data.tool_use_id)
    ) {
      const toolUseId = resultEvent.data.tool_use_id;
      state.activeBashTools.delete(toolUseId);

      this.execBufferManager.flush(toolUseId);
      this.execBufferManager.cleanup(toolUseId);

      this.emit("exec_complete", {
        processId,
        toolUseId,
        exitCode: 0,
      });
    }
  }

  private cleanup(processId: string): void {
    const state = this.activeProcesses.get(processId);
    if (state) {
      for (const toolUseId of state.activeBashTools) {
        this.execBufferManager.cleanup(toolUseId);
      }
    }
    this.activeProcesses.delete(processId);
  }
}
