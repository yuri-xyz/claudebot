# Claudebot

Personal AI bot that orchestrates Claude Code inside a Docker/Podman sandbox, with Discord bot frontend, cron scheduling, skills management, and MCP tools.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Testing**: `bun test`
- **CLI framework**: citty
- **Discord**: discord.js 14.x
- **Validation**: zod
- **MCP**: @modelcontextprotocol/sdk

## Project Structure

- `src/adapter/` - Claude Code CLI adapter (NDJSON protocol, event system)
- `src/sandbox/` - Docker/Podman container lifecycle
- `src/service/` - Background daemon (launchd/systemd)
- `src/connectors/discord/` - Discord bot connector
- `src/cron/` - Scheduled job system
- `src/tools/` - MCP tools (skills, cron management)
- `src/skills/` - Skills fetch/install/manage
- `src/config/` - Configuration and paths
- `src/cli/` - CLI command handlers
- `src/lib/` - Shared utilities

## Key Patterns

- The adapter's `ProcessSpawner` abstraction enables transparent sandboxing
- Agent runs in `bypassPermissions` mode (safe because it's inside a container)
- Agent is invoked on-demand (not a loop) - triggered by Discord messages, chat, or cron
- The service daemon is always running (for Discord bot + cron scheduling)

## Commands

```bash
bun run dev -- chat              # Interactive chat
bun run dev -- skills ls         # List skills
bun run dev -- service install   # Install background service
bun test                         # Run tests
bun run typecheck                # Type check
```
