# Deployment

Claudebot runs as a Docker container on Railway. This document covers configuration, authentication, and operational details.

---

## Environment Variable Config Overlay

The config loader merges environment variables onto `~/.claudebot/config.json` before Zod validation. Env vars override file values for the same field. When no config file exists (ephemeral containers), env vars alone are sufficient.

### Supported Env Vars

| Env Var | Config Path | Notes |
|---------|-------------|-------|
| `DISCORD_TOKEN` | `discord.token` | Discord bot token |
| `SIGNAL_ACCOUNT` | `signal.account` | E.164 phone number |
| `SIGNAL_ALLOWED_NUMBERS` | `signal.allowedNumbers` | JSON array of E.164 numbers |
| `SIGNAL_ALLOWED_UUIDS` | `signal.allowedUuids` | JSON array of Signal ACI UUIDs |
| `X402_EVM_PRIVATE_KEY` | `x402.evmPrivateKey` | 0x-prefixed EVM private key |
| `AGENTMAIL_API_KEY` | `agentmail.apiKey` | AgentMail API key |
| `AGENTMAIL_INBOX_ID` | `agentmail.inboxId` | AgentMail inbox address |

**Behavior:**
- Only set when the env var is present and non-empty
- Spread existing config section first, then override with env var
- JSON array values are parsed with `JSON.parse`; invalid JSON is silently ignored
- `AGENTMAIL_*` requires both env vars to activate (either alone is ignored)
- No prefix convention — matches upstream SDK patterns (`DISCORD_TOKEN`, `ANTHROPIC_API_KEY`)

### Implementation

`applyEnvOverlay()` in `src/config/config.ts` — exported and unit tested.

---

## Claude Code CLI Authentication

The bot spawns Claude Code CLI (`claude`) for agent invocations. The CLI needs authentication. Two options:

### Option A: API Key (permanent, pay-per-token)

Set `ANTHROPIC_API_KEY` as an env var. The CLI reads it automatically.

- **Pros:** Never expires. No setup scripts. Works in any environment.
- **Cons:** Pay-per-token billing (not included in Pro/Max subscription).

### Option B: OAuth Token (subscription-based, ~1 year expiry)

Generate a long-lived OAuth token via `claude setup-token` (requires Pro or Max subscription). The CLI reads it from `CLAUDE_CODE_OAUTH_TOKEN`.

- **Pros:** Uses your existing subscription quota.
- **Cons:** Expires after ~1 year. Requires manual rotation. Requires onboarding flag (see below).

**Generating the token:**

```bash
# Run locally in your terminal (interactive — opens browser)
claude setup-token
# Prints a token like: sk-ant-oat01-...
```

**Container requirements for OAuth:**

The CLI requires an onboarding flag in a fresh container, otherwise it prompts for interactive setup. The Dockerfile handles this:

```dockerfile
RUN echo '{"hasCompletedOnboarding": true}' > /root/.claude.json
```

Then set the env var:

```bash
railway variables set CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."
```

### Auth Precedence

The CLI checks in this order (first match wins):

1. `ANTHROPIC_API_KEY` — API key, overrides everything
2. `CLAUDE_CODE_OAUTH_TOKEN` — OAuth token, overrides credential file
3. `~/.claude/.credentials.json` — local credential file (from `claude /login`, short-lived)

---

## Railway Setup

### Volume

Railway bans `VOLUME` in Dockerfiles and allows **one volume per service**. We mount a single volume at `/data` and the entrypoint script symlinks subdirectories to the expected paths:

| Volume Path | Symlinked To | Purpose |
|-------------|-------------|---------|
| `/data/claudebot` | `/root/.claudebot` | Config, crons, logs, persona |
| `/data/signal-cli` | `/root/.local/share/signal-cli` | Signal identity keys and message store |
| `/data/claude` | `/root/.claude` | Claude CLI settings, skills, session data |

```bash
railway volume add --mount-path /data
```

The entrypoint script (`entrypoint.sh`) creates the subdirs and symlinks on every boot before starting the app.

### Environment Variables

Set secrets via the Railway CLI:

```bash
railway variables set \
  ANTHROPIC_API_KEY="sk-ant-api03-..." \
  DISCORD_TOKEN="..." \
  SIGNAL_ACCOUNT="+1234567890" \
  SIGNAL_ALLOWED_NUMBERS='["+1234567890"]' \
  SIGNAL_ALLOWED_UUIDS='["uuid-here"]'
```

Or use `CLAUDE_CODE_OAUTH_TOKEN` instead of `ANTHROPIC_API_KEY` for subscription auth.

### Networking

The bot only makes **outbound** connections (Discord API, Signal servers, Anthropic API). No inbound access is needed:

- **Public networking:** No domain, no TCP proxy. Delete any Railway-generated domains.
- **Private networking:** Not needed unless adding internal services.

### Publishing

```bash
bun run publish
```

Runs `scripts/publish.ts` which:
1. Verifies no uncommitted changes, untracked files, or unpushed commits
2. Deploys via `railway up --detach`

### Checking Deployment

```bash
railway logs --deployment    # Build and startup logs
railway status               # Project/service info
railway variables --json     # Verify env vars are set
```

---

## Dockerfile

The Dockerfile is a multi-stage build:

1. **deps stage** — `bun install --frozen-lockfile --production`
2. **runtime stage** — installs system dependencies:
   - Node.js LTS (required by Claude Code CLI, which is an npm package)
   - Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
   - Java JRE (required by signal-cli)
   - signal-cli binary

The Dockerfile is required (vs Railway's Nixpacks auto-detect) because of the non-trivial system dependencies. Nixpacks would only see a Bun project and skip Node.js, Java, and signal-cli.

Data directories are created via `mkdir` in the Dockerfile. Actual persistence comes from Railway volumes mounted at those paths.

---

## Connector Behavior Without Config

All connectors are optional. The daemon logs a warning and continues if a connector is not configured:

| Connector | Required Config | Behavior When Missing |
|-----------|----------------|----------------------|
| Discord | `DISCORD_TOKEN` | Logs warning, skips |
| Signal | `SIGNAL_ACCOUNT` | Logs warning, skips |

The daemon runs successfully with zero connectors configured — it just won't receive any messages.
