# OpenClaw (formerly Clawdbot / Moltbot) - Feature Research

> Research compiled February 2026.
> OpenClaw is a large, well-known open-source project (174k+ GitHub stars) -- this document captures its feature set for reference and comparison with our claudebot project.

## Project Overview

**OpenClaw** is a free, open-source, self-hosted personal AI assistant created by Peter Steinberger. It connects your messaging platforms (WhatsApp, Telegram, Discord, Slack, iMessage, and more) to AI coding agents, running as a local gateway on your own hardware.

- **Repository**: https://github.com/openclaw/openclaw
- **Documentation**: https://docs.openclaw.ai/
- **License**: MIT
- **Language**: TypeScript
- **Runtime**: Node >= 22 (also supports pnpm, bun)
- **Stars**: 174,000+ / Forks: 28,000+
- **Default model**: `anthropic/claude-opus-4-6`

### Naming History

1. **Clawdbot** (November 2025) -- original name, inspired by the Claude/claw monster from Claude Code
2. **Moltbot** (January 27, 2026) -- renamed after Anthropic trademark complaints; lobster "molting" theme
3. **OpenClaw** (January 30, 2026) -- final name after "Moltbot" was deemed awkward; trademark searches cleared

---

## Architecture

### Gateway Model

The core of OpenClaw is a single-process **WebSocket Gateway** (`ws://127.0.0.1:18789`) that acts as the central nervous system:

- Manages sessions, routing, channels, tools, and events
- Serves as the single source of truth for all connections
- Bridges messaging platforms with AI agents
- Runs as a persistent daemon via launchd (macOS) or systemd (Linux)

### Agent Runtime

- The **Pi agent** operates in RPC mode with tool streaming and block streaming
- Agents run in `bypassPermissions` mode when sandboxed
- One gateway can host one agent (default) or many agents side-by-side

### Configuration

- Config stored at `~/.openclaw/openclaw.json`
- Minimal setup:
  ```json
  {
    "agent": {
      "model": "anthropic/claude-opus-4-6"
    }
  }
  ```

### Installation

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

The onboard wizard installs a launchd/systemd user service for persistent operation.

---

## Channel Integrations (Multi-Channel Inbox)

OpenClaw's defining feature is its multi-channel inbox -- it connects to messaging platforms and treats inbound DMs as the user interface.

### Supported Channels

| Channel | Library/Protocol | Notes |
|---------|-----------------|-------|
| WhatsApp | Baileys | DM pairing with codes |
| Telegram | grammY | DM pairing with codes |
| Discord | discord.js | Full bot API, slash commands |
| Slack | Bolt | Workspace integration |
| Signal | -- | DM pairing with codes |
| iMessage | BlueBubbles | macOS native |
| Google Chat | -- | Workspace integration |
| Microsoft Teams | -- | Enterprise integration |
| Matrix | -- | Federated chat |
| Zalo | -- | Vietnamese messenger |
| WebChat | Built-in | Browser-based control UI |

### Channel Architecture

- Each channel maintains isolated sessions keyed by channel/user ID
- Message routing is deterministic: replies return to the originating channel
- Per-channel chunking and routing with retry policies
- Typing indicators and presence status forwarding
- Media handling for images, audio, and documents

---

## Discord Integration (Deep Dive)

Since claudebot is also a Discord bot, the Discord integration is worth examining in detail.

### Core Features

- **DM support**: Direct messages with pairing mode (unknown senders get time-limited pairing codes)
- **Guild (server) channels**: Per-channel isolated sessions (`agent:<agentId>:discord:channel:<channelId>`)
- **Slash commands**: Auto-registered in Discord UI, honor allowlists on execution
- **Multi-account**: Multiple bot tokens via `channels.discord.accounts` array
- **Reply threading**: `[[reply_to_current]]` or `[[reply_to:<id>]]` tags for threaded replies

### Discord Tool Actions

The `discord` tool provides rich actions:

- **Message ops**: send, edit, delete, read, search
- **Reactions**: add/list reactions (unicode or custom emoji)
- **Threads**: create, list, reply
- **Pins**: pin, unpin, list
- **Member/Role/Channel info**: lookup and display metadata
- **Moderation**: timeout, kick, ban (disabled by default)
- **Presence**: set bot status/activity (disabled by default)
- **Stickers and polls**: create and send
- **Voice status**: query voice channel states
- **Scheduled events**: list and create

### Discord Access Control

Three DM policies:

1. **Pairing** (default): Unknown senders receive 1-hour pairing codes
2. **Allowlist**: Restrict to specific user IDs or names
3. **Open**: Allow any sender (`dm.allowFrom=["*"]`)

Guild channels support per-guild and per-channel user allowlists with optional mention requirements.

### Discord Configuration

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "...",
      "mediaMaxMb": 8,
      "historyLimit": 20,
      "textChunkLimit": 2000,
      "chunkMode": "length",
      "requireMention": true,
      "guilds": {
        "<guildId>": {
          "users": ["userId1"],
          "channels": {
            "<channelSlug>": {
              "allow": true,
              "requireMention": false,
              "systemPrompt": "extra context",
              "skills": ["specific-skill"]
            }
          }
        }
      }
    }
  }
}
```

### Additional Discord Features

- **PluralKit support**: Resolve proxied messages to underlying system members
- **Exec approvals**: Button UI for execution approval in DMs
- **Config writes**: `/config set|unset` commands for dynamic configuration
- **Retry/rate limiting**: Automatic retry on Discord 429s with exponential backoff and jitter
- **Reaction notifications**: Configurable per-guild (`off`, `own`, `all`, `allowlist`)
- **Newline chunking**: Split on paragraph boundaries before length chunking

---

## Skills System

### Overview

Skills are reusable knowledge packages (markdown files with supporting assets) that provide usage guidance and examples for tools. They extend OpenClaw's capabilities to interact with external services and automate workflows.

### ClawHub (Public Registry)

- **Repository**: https://github.com/openclaw/clawhub
- **Total skills**: 5,705 published (as of Feb 2026)
- **Curated list**: ~3,009 after filtering spam, duplicates, and malicious entries
- **Security**: VirusTotal partnership for skill scanning

### Skill Categories (30+)

| Category | Count | Examples |
|----------|-------|---------|
| Search and Research | 253 | Web search, RAG, documentation |
| DevOps and Cloud | 212 | AWS, GCP, Kubernetes |
| Web and Frontend | 201 | React, Next.js, CSS |
| AI and LLMs | 287 | Model management, prompt engineering |
| Marketing and Sales | 145 | SEO, content, CRM |
| Browser and Automation | 139 | Puppeteer, form filling |
| Productivity and Tasks | 134 | Calendar, email, todos |
| Coding Agents and IDEs | 133 | VS Code, CI/CD |
| Communication | 133 | Email, chat, notifications |
| Notes and PKM | 100 | Obsidian, Notion, Roam |
| Transportation | 73 | Flight check-in, routing |
| Git and GitHub | 66 | PRs, issues, actions |
| Image and Video | 60 | Generation, editing |
| Gaming | 62 | Game APIs, bots |
| Smart Home and IoT | 56 | Home Assistant, sensors |
| Health and Fitness | 55 | Tracking, wearables |
| Data and Analytics | 46 | Dashboards, ETL |

### Skill Storage

- Per-agent skills: `<workspace>/skills/`
- Shared skills: `~/.openclaw/skills/`
- Compatible with standard Claude Code `SKILL.md` format
- Auto-search and install from ClawHub when enabled

---

## Tools and MCP Integration

### Built-in Tools

OpenClaw includes 50+ built-in tools across categories:

- **Filesystem**: read, write, edit files
- **Shell**: execute commands and scripts
- **Browser**: dedicated Chrome/Chromium with snapshots, actions, uploads, and profiles
- **Messaging**: send/receive across all channels
- **Session management**: `sessions_*` tools for agent-to-agent coordination

### MCP (Model Context Protocol)

- Supports 100+ third-party MCP servers
- Tools are structured function definitions with JSON Schema input
- Configurable allow/deny lists for tool access
- Per-channel and per-session tool policies

---

## Automation

### Cron Jobs

- Built-in scheduler that persists jobs
- Wakes the agent at the right time
- Optionally delivers output back to a chat channel
- Configuration stored alongside other settings

### Webhooks

- External triggers can initiate agent actions
- HTTP endpoint for third-party service integration

### Gmail Pub/Sub

- Native integration for email-triggered automation
- Read inbox, send emails, manage calendar

---

## Voice and Audio

- **Voice Wake**: Always-on speech recognition on macOS/iOS/Android
- **Talk Mode**: Conversational voice interface
- **ElevenLabs integration**: Text-to-speech output
- Available on desktop and mobile companion apps

---

## Canvas (A2UI - Agent-to-User Interface)

- **Live Canvas**: Agent-driven visual workspace
- Renders interactive canvases that update in real-time
- Example: draggable Gantt charts you can edit directly
- Canvas host runs inside the Gateway
- Available on desktop and mobile nodes

---

## Multi-Agent Routing

- Route inbound channels/accounts/peers to isolated agents
- Per-agent workspaces with separate:
  - Personalities (AGENTS.md, SOUL.md)
  - Authentication and sessions (no cross-talk unless explicitly enabled)
  - Skills folders
  - Session history stored at `~/.openclaw/agents/<agentId>/sessions`

---

## Mobile Integration

- **iOS and Android companion apps** function as "nodes"
- Expose device capabilities to the agent:
  - Camera
  - Screen recording
  - Location
  - Notifications
- Canvas support on mobile
- Pair with the gateway for remote control

---

## Security Model

### DM Pairing

- Default behavior requires "DM pairing" on Telegram/WhatsApp/Signal
- Unknown senders receive time-limited pairing codes (1-hour expiry)
- Unknown messages are blocked until pairing is approved

### Docker Sandbox

When `agents.defaults.sandbox` is enabled:

- Non-main sessions run tools inside a Docker container
- One container and workspace per agent by default
- Security hardening includes:
  - Read-only root filesystem
  - tmpfs mounts for temporary files
  - No network access by default
  - Non-root user execution (UID 1000:1000)
  - Dropped Linux capabilities
  - seccomp/AppArmor profiles

### Group Safety

- Per-session Docker sandboxing for group channels
- Configurable tool allow/deny lists (`exec`, `process`, `read`, `write`, `edit`)
- macOS TCC integration for system permissions
- Elevated bash separated from system permissions

---

## Deployment Options

| Method | Notes |
|--------|-------|
| Local install | `npm install -g openclaw@latest` |
| Docker | Official image, security-first, non-root |
| Nix | Nix package available |
| Cloudflare Workers | Via `moltworker` project |
| DigitalOcean | Tutorial available |
| Tailscale | Serve/Funnel for remote access |
| SSH tunnels | Gateway stays on loopback |

### Update Channels

- `stable` -- production releases
- `beta` -- pre-release features
- `dev` -- bleeding edge

Switch via `openclaw update --channel <channel>`.

---

## Comparison with claudebot

| Feature | OpenClaw | claudebot |
|---------|----------|-----------|
| Runtime | Node >= 22 | Bun |
| Language | TypeScript | TypeScript |
| Primary channel | Multi (13+) | Discord |
| Agent | Custom Pi agent (RPC) | Claude Code CLI (NDJSON) |
| Sandbox | Docker (built-in) | Docker/Podman |
| Skills | ClawHub registry (5,705) | Local ~/.claude/skills/ |
| MCP | 100+ servers | Custom MCP tools |
| Cron | Built-in scheduler | Built-in scheduler |
| Voice | Yes (ElevenLabs) | No |
| Canvas | Yes (A2UI) | No |
| Mobile apps | iOS/Android | No |
| Multi-agent | Yes | Single agent |
| Service daemon | launchd/systemd | launchd/systemd |
| Config location | ~/.openclaw/ | ~/.claudebot/ |

### Key Architectural Similarity

Both projects share a similar pattern: a daemon process that connects a messaging platform to an AI agent running in a sandbox. OpenClaw's Gateway is analogous to claudebot's service daemon, and both use Docker containers for safe agent execution. The main difference is scope: OpenClaw is a multi-channel, multi-agent platform with a large plugin ecosystem, while claudebot is focused on single-channel Discord with Claude Code CLI integration.

---

## Feature Ideas for claudebot

> Research compiled February 2026. Features we're missing that would fit our stack (Bun, TypeScript, Claude Code CLI, Discord/Signal, cron, MCP tools, sandbox).

### Already Have

Soul/persona, persistent memories, cron/reminders, Discord + Signal connectors, sandboxed code execution, MCP tools, skills, x402 payments, image analysis, Docker deployment.

---

### Tier 1: High-Impact, Fits Naturally

#### Daily Briefing / Morning Digest

A cron job that runs every morning, gathers context from multiple sources (weather, calendar, news, GitHub notifications), and delivers a personalized summary to Discord or Signal. Google CC and ChatGPT Pulse both launched this as a flagship feature. Makes the bot proactive rather than reactive.

**Implementation:** A cron job whose prompt says "gather today's info and summarize." The bot uses `fetch` or MCP tools for data (weather API, GitHub, RSS). SOUL.md defines topics the user cares about. We already have cron + channel delivery.

#### Web Watching / Change Monitoring

Monitor URLs, RSS feeds, or API endpoints on a schedule. When something changes (price drop, new blog post, GitHub release, page update), send an alert with a summary of what changed. Tools like Browse AI, Visualping, and rtrvr.ai exist solely for this.

**Implementation:** A `claudebot_watch` MCP tool that stores URL + last-seen content hash. Recurring cron fetches the URL, diffs against stored content, invokes Claude to summarize the diff. All infrastructure already exists.

#### Structured Memory / Knowledge Graph

Instead of flat `memories.md`, maintain a structured knowledge base -- entities (people, projects, preferences, decisions) with typed relationships. When you mention "that project from last month," the bot looks up the entity and all associated context. The flat file approach degrades as memories grow.

**Implementation:** Simplest version: a JSON file with entities and relations, read/written via MCP tools (`claudebot_memory_search`, `claudebot_memory_add_entity`, `claudebot_memory_link`). Advanced version: SQLite with full-text search (Bun has native SQLite support).

#### Self-Reflection / Learning Loop

After each interaction (or daily), the bot reviews what went well and what didn't. Writes "lessons learned" and updates its own instructions. Example: "User prefers short answers," "When asked about code, always include the filename."

**Implementation:** A nightly cron job whose prompt is "Review today's interactions. What patterns do you notice? Update SOUL.md or memories.md accordingly." The bot already has file write access and cron. Reflection logs stored at `~/.claudebot/reflections.md`.

#### Cross-Channel Message Bridging

Forward messages or context between Discord and Signal. "Send this to my Signal" or "Forward what I said in Discord." The bot acts as a unified bridge between messaging platforms. No personal AI bot does this well -- we already have both connectors.

**Implementation:** A `claudebot_send_message` MCP tool that targets either platform. The prompt needs to know about both contexts. The connector infrastructure already supports sending to both.

---

### Tier 2: Medium-Impact, Creative

#### Ambient / Proactive Notifications

The bot proactively reaches out based on context. Not just scheduled reminders, but intelligent triggers: "That PR you were waiting on got merged," "It's been 3 days since you mentioned wanting to finish that blog post." The shift from reactive to proactive is the defining trend.

**Implementation:** Combines web watching + memory + cron. A periodic job polls data sources, Claude evaluates "is this worth notifying about?", sends to Discord/Signal if yes. The hard part is tuning the threshold.

#### Delegation / Sub-Agent Spawning

Spawn parallel sub-agents for complex tasks. "Research these 5 companies and compare them" spawns 5 sessions, a coordinator assembles the report. Core feature of AutoGPT, CrewAI, and Claude Code's sub-agents.

**Implementation:** A `claudebot_delegate` MCP tool that spawns a new Claude Code session with a sub-task prompt, collects output, returns to parent. We already have `invokeAgent()`. Start sequential, add parallelism later.

#### Git Repository Watcher

Monitor repos for new commits, PRs, issues, or releases. Summarize changes and deliver alerts. Combined with code execution, could run tests or do lightweight code review.

**Implementation:** A cron job that polls GitHub API (or `gh` CLI), compares against stored state, reports diffs. The sandbox already has shell access.

#### Webhook Triggers

HTTP endpoint that external services can POST to, triggering agent actions. GitHub webhooks, Stripe events, CI/CD notifications, custom integrations.

**Implementation:** A minimal HTTP server (Bun.serve) alongside the daemon. Routes map to agent invocations with the webhook payload as context. Config defines which webhooks are enabled.

---

### Tier 3: Niche but Interesting

#### Expense / Finance Tracking

Tell the bot about purchases ("spent $45 on groceries"), it maintains a running ledger. Monthly summaries, category breakdowns, budget alerts. Pure conversation-to-structured-data.

**Implementation:** A JSON or SQLite store for transactions, MCP tools for add/query/summarize. No external APIs needed.

#### Clipboard / Snippet Manager

"Save this" captures text, code, URLs into a tagged, searchable collection. "Find that bash command about Docker" retrieves it. A personal pastebin with AI search.

**Implementation:** A JSON file with entries `{tag, content, timestamp, source}`. MCP tools `claudebot_clip_save` and `claudebot_clip_search`. Trivial to build.

#### Mood / Tone Adaptation

Detect emotional tone and adapt response style. Frustrated? More concise. Casual? Warmer. Late at night? Gentler. AI companions with emotional intelligence report much higher user satisfaction.

**Implementation:** Purely a system prompt addition. Claude is already good at this with the right instructions. Could also log detected mood for insights.

#### Habit Tracking / Behavioral Insights

Learn patterns from conversations: when active, what topics discussed, productivity patterns. Surface insights: "You tend to ask about work stuff at 11pm" or "You've mentioned wanting to exercise 4 times but haven't set a reminder."

**Implementation:** Store interaction metadata (timestamp, topic tags) in a structured log. Weekly cron analyzes patterns and writes insights. Data collection happens through existing message handling.

#### Email Triage

Connect to email (IMAP/Gmail), triage inbox (urgent/FYI/spam/action-needed), draft responses, deliver digest. Most time-saving AI feature reported by users.

**Implementation:** IMAP libraries exist for Bun/Node. Cron fetches new emails, Claude categorizes, sends digest. Security concern: storing email credentials.

#### Voice Channel (Discord)

Join Discord voice channels, listen via speech-to-text, respond via TTS. Discord.js supports voice via `@discordjs/voice`. Needs Whisper/Deepgram + ElevenLabs/Piper.

**Implementation:** Non-trivial but documented. Main challenge is latency -- Claude Code CLI adds seconds of delay that feels awkward in voice.

---

### Key Patterns from Research

1. **Proactivity over reactivity** -- bots that reach out to you. Daily briefings, ambient notifications, web watchers.
2. **Structured memory** -- flat files are a starting point; entity graphs with relationships is where the field is heading.
3. **Self-improvement loops** -- agents that learn from their own performance, not just user feedback.
4. **Cross-platform unification** -- Discord + Signal already puts us ahead. Making the bot a bridge/hub is a differentiator.
5. **Digital twin** -- an AI that knows you well enough to act on your behalf: drafting in your voice, predicting what you'd want, nudging based on your own goals.

---

## Sources

- [OpenClaw GitHub Repository](https://github.com/openclaw/openclaw)
- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [OpenClaw Discord Channel Docs](https://docs.openclaw.ai/channels/discord)
- [Awesome OpenClaw Skills](https://github.com/VoltAgent/awesome-openclaw-skills)
- [ClawHub Skills Registry](https://github.com/openclaw/clawhub)
- [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [OpenClaw on npm](https://www.npmjs.com/package/openclaw)
- [Cloudflare MoltWorker](https://github.com/cloudflare/moltworker)
- [CNBC: From Clawdbot to Moltbot to OpenClaw](https://www.cnbc.com/2026/02/02/openclaw-open-source-ai-agent-rise-controversy-clawdbot-moltbot-moltbook.html)
- [OpenClaw Multi-Agent Routing Docs](https://docs.openclaw.ai/concepts/multi-agent)
- [OpenClaw Cron Jobs Docs](https://docs.openclaw.ai/automation/cron-jobs)
- [OpenClaw Docker Docs](https://docs.openclaw.ai/install/docker)
- [Google CC AI Morning Briefing](https://theoutpost.ai/news-story/google-tests-cc-an-ai-assistant-that-emails-you-a-personalized-daily-morning-briefing-22470/)
- [ChatGPT Pulse](https://jam7.com/resources/openai-chatgpt-pulse-launched-ai-agent)
- [Web Monitoring with AI - Visualping](https://visualping.io/blog/how-to-monitor-web-page-with-ai)
- [AI Knowledge Graph with Obsidian - TaskFoundry](https://www.taskfoundry.com/2025/06/smart-knowledge-graph-ai-obsidian-tana.html)
- [Self-Improving AI Agents - Yohei Nakajima](https://yoheinakajima.com/better-ways-to-build-self-improving-ai-agents/)
- [Self-Evolving Agents - OpenAI Cookbook](https://cookbook.openai.com/examples/partners/self_evolving_agents/autonomous_agent_retraining)
- [Ambient Agents - DigitalOcean](https://www.digitalocean.com/community/tutorials/ambient-agents-context-aware-ai)
- [Tell Me When: Agents That Wait - Microsoft Research](https://www.microsoft.com/en-us/research/blog/tell-me-when-building-agents-that-can-wait-monitor-and-act/)
- [Top AI Assistant Trends 2026 - Codiant](https://codiant.com/blog/top-ai-assistant-trends/)
- [AI Companion Guide - Simone.app](https://simone.app/blog/en/ai-companion-guide)
- [AutoGPT - GitHub](https://github.com/Significant-Gravitas/AutoGPT)
