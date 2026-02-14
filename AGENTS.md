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
- **Email**: agentmail (email automation)
- **Documents**: unpdf (PDF text extraction)
- **Markdown**: markdansi (terminal markdown rendering)
- **Blockchain**: viem (Ethereum interactions)
- **HTTP 402**: @x402 suite (payment-gated API handling)
- **Time parsing**: ms (human-readable time strings)
- **YAML**: yaml (configuration parsing)

## Commands

```bash
bun test              # Run all tests (~50ms)
bun run typecheck     # Type check (tsc --noEmit)
bun run dev -- chat   # Interactive chat
bun run build         # Build project
bun run publish       # Publish/deploy
```

## Project Structure

```
src/
  adapter/        Claude Code CLI wrapper (NDJSON protocol, event system, process spawning)
  cli/            CLI command handlers (citty) - chat, service, install commands
  config/         Configuration loading, paths, validation (zod schemas)
  connectors/     Platform integrations (Discord bot, message handling)
  cron/           Scheduled job system (scheduler, storage, executor)
  lib/            Shared utilities (logger, errors, type helpers)
  sandbox/        Docker/Podman container lifecycle management
  service/        Background daemon, agent invocation, system prompt composition
  skills/         Skill fetching, installation, parsing from GitHub/skills.sh
  tools/          MCP server and tool definitions (cron, email, documents, x402, signal)
  index.ts        CLI entry point
test/             Unit tests (mirrors src/ structure)
scripts/          Build and deployment scripts
```

## Key Patterns

- **ProcessSpawner abstraction** — `createBunProcessSpawner()` for direct execution, `createSandboxedProcessSpawner()` for container execution. The adapter is unaware of which is in use.
- **On-demand invocation** — the agent is not a loop. It's triggered by Discord messages, CLI chat, or cron jobs via `invokeAgent()`.
- **MCP tool registration** — tools use `ToolDefinition` with JSON Schema input, registered via `McpServer.tool()` using a Zod shape (`Record<string, ZodTypeAny>`), not a `ZodObject`.
- **Event-driven adapter** — `ClaudeCodeAdapter` emits typed events (`message`, `exec_output`, `error`, `exit`). Consumers subscribe with `.on()`.
- **Composable system prompts** — built from named blocks in `src/service/promptParts.ts`, assembled per-source in `buildSystemPrompt()`.
- **Tool ecosystem** — Rich MCP tools for email (agentmail), documents (unpdf), blockchain (viem), payment APIs (@x402), and system integration.
- **Configuration-driven tools** — Tools are conditionally enabled based on user config (API keys, credentials).

## MCP Tools Available

| Tool Category | Purpose | Dependencies |
|---------------|---------|--------------|
| **Cron** | Schedule reminders and recurring tasks | Built-in |
| **Skills** | Install/manage reusable knowledge packages | Built-in |
| **Email** | Send emails via agentmail service | `agentmail` config |
| **Documents** | Extract text from PDFs and documents | `unpdf` |
| **Signal** | Send Signal messages | Signal CLI setup |
| **X402** | Handle payment-gated HTTP APIs | `@x402` suite |

## Conventions

- Prefer `ts-pattern` `match().with()` over `switch/case`
- Validate external inputs with Zod schemas
- Use `errorMessage()` helper from `src/lib/errors.ts` for safe error stringification
- Guard Discord channel methods: `"sendTyping" in msg.channel` (not all channel types support all methods)
- citty positional args have type `string | boolean | string[] | undefined` — cast to `string` when consuming
- Use `markdansi` for terminal markdown rendering in CLI commands
- Handle HTTP 402 responses automatically with `@x402/fetch` wrapper

## Data Paths

All user data lives under `~/.claudebot/`:

| Path | Purpose |
|------|---------|
| `config.json` | Main configuration (Discord, email, Signal, etc.) |
| `SOUL.md` | Bot persona (editable by the agent) |
| `crons.json` | Scheduled jobs storage |
| `mcp-config.json` | MCP tool server configuration |
| `skills/` | Installed skills from GitHub/skills.sh |
| `logs/` | Service logs and debugging output |

## Testing

- All tests are pure unit tests under `test/` mirroring `src/` structure
- Run with `bun test` — no setup, no network, no fixtures
- Always run `bun run typecheck && bun test` before considering work complete
- Tests focus on business logic, not integration or external dependencies

## Configuration

The bot supports rich configuration for various integrations:

```json
{
  "discord": { "token": "...", "channels": [...] },
  "agentmail": { "apiKey": "...", "inboxId": "..." },
  "signal": { "account": "...", "recipients": [...] },
  "x402": { "walletPrivateKey": "..." }
}
```

Tools are automatically enabled/disabled based on available configuration.
