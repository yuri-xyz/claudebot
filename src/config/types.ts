import { z } from "zod";

export const DiscordConfigSchema = z.object({
  token: z.string(),
  allowedChannelIds: z.array(z.string()).default([]),
  allowedUserIds: z.array(z.string()).default([]),
  allowedUsernames: z.array(z.string()).default([]),
});

export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

export const SandboxConfigSchema = z.object({
  runtime: z.enum(["docker", "podman", "auto"]).default("auto"),
  image: z.string().default("ubuntu:24.04"),
  containerName: z.string().default("claudebot-sandbox"),
  mountPaths: z.array(z.string()).default([]),
});

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;

export const AgentConfigSchema = z.object({
  model: z.string().default("sonnet"),
  maxTurns: z.number().default(50),
  maxBudgetUsd: z.number().optional(),
  systemPrompt: z.string().default("You are a helpful personal assistant."),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const ClaudebotConfigSchema = z.object({
  discord: DiscordConfigSchema.optional(),
  sandbox: SandboxConfigSchema.default({}),
  agent: AgentConfigSchema.default({}),
});

export type ClaudebotConfig = z.infer<typeof ClaudebotConfigSchema>;
