# Agents

Instructions for AI agents working on this codebase.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode, `noUncheckedIndexedAccess`)
- **Testing**: `bun test`
- **CLI framework**: citty
- **Discord**: discord.js 14.x
- **Validation**: zod
- **Pattern matching**: ts-pattern (prefer `match()` over `switch/case`)
- **MCP**: @modelcontextprotocol/sdk

## Commands

```bash
bun test              # Run all tests (~50ms)
bun run typecheck     # Type check (tsc --noEmit)
bun run dev -- chat   # Interactive chat
```

## Project Structure

```
src/
  adapter/        Claude Code CLI wrapper (NDJSON protocol, event system, process spawning)
  cli/            CLI command handlers (citty)
  config/         Configuration loading, paths, validation (zod schemas)
  connectors/     Platform integrations (Discord)
  cron/           Scheduled job system (scheduler, storage, executor)
  lib/            Shared utilities (logger, errors)
  sandbox/        Docker/Podman container lifecycle
  service/        Background daemon, agent invocation, system prompt composition
  skills/         Skill fetching, installation, parsing
  tools/          MCP server and tool definitions
  index.ts        CLI entry point
test/             Unit tests (mirrors src/ structure)
```

## Key Patterns

- **ProcessSpawner abstraction** — `createBunProcessSpawner()` for direct execution, `createSandboxedProcessSpawner()` for container execution. The adapter is unaware of which is in use.
- **On-demand invocation** — the agent is not a loop. It's triggered by Discord messages, CLI chat, or cron jobs via `invokeAgent()`.
- **MCP tool registration** — tools use `ToolDefinition` with JSON Schema input, registered via `McpServer.tool()` using a Zod shape (`Record<string, ZodTypeAny>`), not a `ZodObject`.
- **Event-driven adapter** — `ClaudeCodeAdapter` emits typed events (`message`, `exec_output`, `error`, `exit`). Consumers subscribe with `.on()`.
- **Composable system prompts** — built from named blocks in `src/service/promptParts.ts`, assembled per-source in `buildSystemPrompt()`.

## Conventions

- Prefer `ts-pattern` `match().with()` over `switch/case`
- Validate external inputs with Zod schemas
- Use `errorMessage()` helper from `src/lib/errors.ts` for safe error stringification
- Guard Discord channel methods: `"sendTyping" in msg.channel` (not all channel types support all methods)
- citty positional args have type `string | boolean | string[] | undefined` — cast to `string` when consuming

## Data Paths

All user data lives under `~/.claudebot/`:

| Path | Purpose |
|------|---------|
| `config.json` | Main configuration |
| `SOUL.md` | Bot persona |
| `crons.json` | Scheduled jobs |
| `mcp-config.json` | MCP tool server config |
| `skills/` | Installed skills |
| `logs/` | Service logs |

## Testing

- All tests are pure unit tests under `test/` mirroring `src/` structure
- Run with `bun test` — no setup, no network, no fixtures
- Always run `bun run typecheck && bun test` before considering work complete
