# Claudebot

Personal AI bot that runs [Claude Code](https://docs.anthropic.com/en/docs/claude-code) inside a Docker/Podman sandbox. Talk to it over Discord, schedule it with cron, or chat in your terminal.

```
you:  hey, remind me to check the deploy in 2 hours
bot:  Done — I set a reminder for 4:30 PM. I'll ping you here.
```

## Features

- **Discord bot** — message-based and slash command interface with image analysis, typing indicators, and chunked responses
- **Sandboxed execution** — agent runs inside a Docker/Podman container with `bypassPermissions` (safe because it's isolated)
- **Cron & reminders** — schedule recurring jobs or one-shot reminders that fire back into Discord
- **Skills** — install reusable knowledge packages from GitHub or [skills.sh](https://skills.sh)
- **Persona** — define the bot's name, personality, and voice via a `SOUL.md` file that the bot itself can edit
- **MCP tools** — skills and cron management exposed as MCP tools so the agent can manage itself
- **Background service** — launchd (macOS) or systemd (Linux) daemon keeps it running

## Quick Start

```bash
# Prerequisites
npm install -g @anthropic-ai/claude-code
export ANTHROPIC_API_KEY=sk-...

# Install
git clone https://github.com/yuri-xyz/claudebot.git
cd claudebot
bun install

# Bootstrap (creates config, installs service, writes persona)
bun run dev -- setup

# Or just chat directly
bun run dev -- chat
```

The setup wizard prompts for a Discord bot token and allowed usernames, writes config to `~/.claudebot/config.json`, and installs the background service.

## CLI

```bash
claudebot chat [prompt]         # Interactive terminal chat (or single-shot with prompt)
claudebot setup                 # Bootstrap wizard
claudebot doctor                # Verify dependencies and config
claudebot service install       # Install background service
claudebot service start|stop    # Control the daemon
claudebot service status        # Show service health
claudebot service logs [-f]     # Tail service logs
claudebot skills ls             # List installed skills
claudebot skills get <id>       # Install skill from GitHub or skills.sh
claudebot skills search <query> # Search the skills.sh registry
claudebot soul                  # Edit persona file
claudebot replace               # Reinstall service without resetting config
```

## Configuration

Config lives at `~/.claudebot/config.json`:

```jsonc
{
  "discord": {
    "token": "...",
    "allowedUsernames": ["yourname"],
    "allowedUserIds": [],
    "allowedChannelIds": []       // empty = all channels
  },
  "sandbox": {
    "runtime": "auto",            // "docker", "podman", or "auto"
    "image": "ubuntu:24.04",
    "containerName": "claudebot-sandbox"
  },
  "agent": {
    "model": "sonnet",
    "maxTurns": 50,
    "maxBudgetUsd": null          // optional spending cap per invocation
  }
}
```

## Architecture

```
Discord / CLI / Cron
        |
   IncomingMessage
        |
   invokeAgent()
        |
   ClaudeCodeAdapter ──stdin/stdout──> Claude Code CLI
        |                                    |
   ProcessSpawner                      Docker container
   (Bun.spawn or docker exec)
```

The `ProcessSpawner` abstraction makes sandboxing transparent — the adapter doesn't know whether it's running locally or inside a container. When a container named `claudebot-sandbox` exists, execution is routed through `docker exec`; otherwise it falls back to direct host execution.

The background service daemon manages two responsibilities:
1. **Discord connector** — listens for messages, routes them to the agent
2. **Cron scheduler** — checks due jobs every 60 seconds, fires them as independent agent invocations

## Discord

The bot responds to regular messages and two slash commands:

| Feature | Details |
|---------|---------|
| `/ask <prompt>` | Ask Claude a question |
| `/status` | Health check |
| Image analysis | JPEG, PNG, GIF, WebP up to 10 MB |
| Access control | Filter by username, user ID, or channel ID |
| Reminders | The agent can schedule reminders via the `claudebot_cron_create` MCP tool |

## Persona

The bot's personality is defined in `~/.claudebot/SOUL.md`. On first run, it contains a "hatching" prompt that asks the user to shape who the bot is. The bot can edit its own SOUL file when asked to change its personality.

```bash
claudebot soul    # open in editor
```

## Skills

Skills are markdown knowledge packages compatible with the standard Claude Code skills format:

```bash
claudebot skills get anthropics/claude-code-skills/git   # from GitHub
claudebot skills search "typescript"                      # search registry
```

Installed to `~/.claudebot/skills/`. The agent can also install/remove skills itself via MCP tools.

## Development

```bash
bun test              # 88 tests, ~50ms
bun run typecheck     # strict TypeScript
bun run dev -- chat   # run without installing
```

## Tech Stack

[Bun](https://bun.sh) +
[TypeScript](https://www.typescriptlang.org) +
[discord.js](https://discord.js.org) +
[citty](https://github.com/unjs/citty) +
[zod](https://zod.dev) +
[ts-pattern](https://github.com/gvergnaud/ts-pattern) +
[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
