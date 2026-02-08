# ── Stage 1: dependencies ────────────────────────────────────────────
FROM oven/bun:1-debian AS deps

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ── Stage 2: runtime ────────────────────────────────────────────────
FROM oven/bun:1-debian AS runtime

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl git bash ca-certificates gnupg \
    && rm -rf /var/lib/apt/lists/*

# Node.js LTS via NodeSource (required for Claude Code CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Java JRE (for signal-cli)
RUN apt-get update && apt-get install -y --no-install-recommends \
      default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# signal-cli
ARG SIGNAL_CLI_VERSION=0.13.12
RUN curl -fsSL "https://github.com/AsamK/signal-cli/releases/download/v${SIGNAL_CLI_VERSION}/signal-cli-${SIGNAL_CLI_VERSION}.tar.gz" \
      | tar xz -C /opt \
    && ln -s "/opt/signal-cli-${SIGNAL_CLI_VERSION}/bin/signal-cli" /usr/local/bin/signal-cli

# Application
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/ ./src/

# Data directories
RUN mkdir -p /root/.claudebot /root/.claude

VOLUME /root/.claudebot
VOLUME /root/.claude

ENTRYPOINT ["bun", "run", "src/index.ts"]
CMD ["daemon"]
