/**
 * x402 Payment-Capable Fetch Tool
 *
 * Wraps fetch() with @x402/fetch to automatically handle HTTP 402 responses
 * by paying with USDC on Base (EVM). Only registered when a wallet key is configured.
 */

import { z } from "zod";
import { match } from "ts-pattern";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { ToolDefinition } from "./types";

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type X402Network = "base" | "base-sepolia";

const EvmPrivateKeySchema = z
  .string()
  .startsWith("0x")
  .transform((k) => k as `0x${string}`);

function networkToChainId(network: X402Network): `${string}:${string}` {
  return match(network)
    .with("base", () => "eip155:8453" as const)
    .with("base-sepolia", () => "eip155:84532" as const)
    .exhaustive();
}

let paymentFetch: FetchFn | undefined;

function buildPaymentFetch(): FetchFn {
  const key = EvmPrivateKeySchema.parse(process.env.CLAUDEBOT_X402_EVM_PRIVATE_KEY);
  const network = (process.env.CLAUDEBOT_X402_NETWORK ?? "base") as X402Network;

  const account = privateKeyToAccount(key);
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: account,
    networks: [networkToChainId(network)],
  });

  return wrapFetchWithPayment(fetch, client);
}

function getPaymentFetch(): FetchFn {
  paymentFetch ??= buildPaymentFetch();
  return paymentFetch;
}

const x402FetchTool: ToolDefinition = {
  name: "claudebot_x402_fetch",
  description:
    "Fetch a URL with automatic x402 payment support. If the server returns HTTP 402 Payment Required, payment is handled automatically using USDC on Base. Use this for x402-compatible paid APIs.",
  inputShape: {
    url: z.string().describe("The URL to fetch"),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .optional()
      .describe("HTTP method (defaults to GET)"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Optional HTTP headers as key-value pairs"),
    body: z
      .string()
      .optional()
      .describe("Optional request body (for POST/PUT/PATCH)"),
  },
  async handler({ url, method, headers, body }) {
    const wrappedFetch = getPaymentFetch();
    const response = await wrappedFetch(url, {
      method: method ?? "GET",
      ...(headers ? { headers } : {}),
      ...(body ? { body } : {}),
    });

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (!response.ok) {
      return `HTTP ${response.status} ${response.statusText}\n\n${text}`;
    }

    const meta = [`Status: ${response.status}`];
    if (contentType) meta.push(`Content-Type: ${contentType}`);

    return `${meta.join(" | ")}\n\n${text}`;
  },
};

export function createX402Tools(): ToolDefinition[] {
  if (!process.env.CLAUDEBOT_X402_EVM_PRIVATE_KEY) return [];
  return [x402FetchTool];
}
