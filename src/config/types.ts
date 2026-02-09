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

/** E.164 phone number: + followed by 1-15 digits */
const e164 = z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g. +1234567890)");

/** Signal ACI UUID */
const signalUuid = z.string().uuid("Must be a valid UUID");

export const SignalConfigSchema = z.object({
  account: e164.describe("Phone number in E.164 format, e.g. +1234567890"),
  signalCliBin: z.string().default("signal-cli").describe("Path to signal-cli binary"),
  profileName: z.string().default("claudebot").describe("Signal profile display name"),
  allowedNumbers: z.array(e164).default([]).describe("Allowed phone numbers (empty = allow all)"),
  allowedUuids: z.array(signalUuid).default([]).describe("Allowed Signal UUIDs (ACI identifiers)"),
});

export type SignalConfig = z.infer<typeof SignalConfigSchema>;

export const X402ConfigSchema = z.object({
  evmPrivateKey: z
    .string()
    .describe("0x-prefixed EVM private key with USDC balance"),
  network: z.enum(["base", "base-sepolia"]).default("base"),
});

export type X402Config = z.infer<typeof X402ConfigSchema>;

export const AgentMailConfigSchema = z.object({
  apiKey: z.string().describe("AgentMail API key"),
  inboxId: z.string().describe("Default inbox ID (email address)"),
});

export type AgentMailConfig = z.infer<typeof AgentMailConfigSchema>;

export const ClaudebotConfigSchema = z.object({
  discord: DiscordConfigSchema.optional(),
  sandbox: SandboxConfigSchema.default({}),
  agent: AgentConfigSchema.default({}),
  x402: X402ConfigSchema.optional(),
  signal: SignalConfigSchema.optional(),
  agentmail: AgentMailConfigSchema.optional(),
});

export type ClaudebotConfig = z.infer<typeof ClaudebotConfigSchema>;
