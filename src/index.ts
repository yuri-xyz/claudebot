#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "claudebot",
    version: "0.1.0",
    description: "Personal AI bot powered by Claude Code",
  },
  subCommands: {
    service: () => import("./cli/service").then((m) => m.default),
    chat: () => import("./cli/chat").then((m) => m.default),
    skills: () => import("./cli/skills").then((m) => m.default),
    doctor: () => import("./cli/doctor").then((m) => m.default),
    setup: () => import("./cli/setup").then((m) => m.default),
    link: () => import("./cli/link").then((m) => m.default),
    container: () => import("./cli/container").then((m) => m.default),
    memories: () => import("./cli/memories").then((m) => m.default),
    replace: () => import("./cli/replace").then((m) => m.default),
    soul: () => import("./cli/soul").then((m) => m.default),
    daemon: () =>
      import("./service/daemon").then((m) =>
        defineCommand({
          meta: { name: "daemon", description: "Run the daemon (internal)" },
          async run() {
            await m.runDaemon();
          },
        }),
      ),
    sandbox: () =>
      import("./config/paths").then(({ paths }) =>
        defineCommand({
          meta: {
            name: "sandbox",
            description: "Print the agent sandbox directory path",
          },
          run() {
            console.log(paths.sandboxDir);
          },
        }),
      ),
    "mcp-server": () =>
      import("./tools/server").then((m) =>
        defineCommand({
          meta: {
            name: "mcp-server",
            description: "Run the MCP tool server (internal)",
          },
          async run() {
            await m.runMcpServer();
          },
        }),
      ),
  },
});

runMain(main);
