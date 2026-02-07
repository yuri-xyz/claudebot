# Claudebot Architecture

## Key Insight: ProcessSpawner Abstraction

The adapter's `ProcessSpawner` interface enables transparent sandboxing. Two implementations:

- `createBunProcessSpawner()` - runs `claude` directly on host (dev/fallback)
- `createSandboxedProcessSpawner(runtime, containerName)` - wraps with `docker exec -i <container> claude ...`

The adapter code doesn't know it's running inside Docker.

## Agent Invocation Flow

```
Trigger (Discord msg / CLI chat / cron job)
  -> invokeAgent(IncomingMessage, config, logger)
    -> Detect sandbox availability
    -> Select ProcessSpawner (sandboxed or direct)
    -> Generate MCP config for tools
    -> Create ClaudeCodeAdapter
    -> adapter.start({ prompt, cwd, permissionMode: "bypassPermissions", mcpConfigPath })
    -> Collect response text from NDJSON events
    -> Return response string
```

## Adapter from @cli-agent/claude-code-adapter

Adapted from `/Users/anon/dev/agentic/packages/claude-code-adapter/src/`.
Changes from upstream:
- `ClaudeCodeRunnerConfig` inlined (removed `@cli-agent/sdk` dependency)
- Added `mcpConfigPath` field for MCP tool support
- Added `processSpawner.ts` with Bun and sandboxed implementations
- `ms` and `zod` kept as dependencies

## MCP Tools

Tools run as a stdio MCP server (`src/tools/server.ts`). Config generated dynamically
at `~/.claudebot/mcp-config.json` and passed to Claude Code via `--mcp-config`.

Available tools:
- `claudebot_skills_list/install/fetch/remove` - Skills management
- `claudebot_cron_list/create/enable/disable/remove` - Cron job management

## Service Daemon

Single long-running process managed by launchd (macOS) or systemd (Linux).
Runs Discord bot connector and in-process cron scheduler (checks every 60s).
