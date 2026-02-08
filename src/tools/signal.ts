/**
 * Signal Profile Update Tool
 *
 * Writes a profile update request to a JSON file that the Signal connector
 * watches and processes via its already-running SignalCliClient.
 */

import { mkdirSync } from "fs";
import { z } from "zod";
import { paths } from "../config/paths";
import type { ProfileUpdate } from "../connectors/signal/client";
import type { ToolDefinition } from "./types";

const DEFAULT_EXT = "jpg";

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

async function downloadAvatar(url: string): Promise<string> {
  mkdirSync(paths.downloadsDir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download avatar: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const ext = CONTENT_TYPE_TO_EXT[contentType] ?? DEFAULT_EXT;
  const dest = `${paths.downloadsDir}/signal-avatar.${ext}`;

  await Bun.write(dest, await res.arrayBuffer());
  return dest;
}

const signalUpdateProfileTool: ToolDefinition = {
  name: "claudebot_signal_update_profile",
  description:
    "Update the bot's Signal profile. Can change display name, family name, about text, about emoji, and avatar. At least one field must be provided. The change takes effect immediately.",
  inputShape: {
    givenName: z.string().optional().describe("Display name / given name"),
    familyName: z.string().optional().describe("Family / last name"),
    about: z.string().optional().describe("About / status text"),
    aboutEmoji: z.string().optional().describe("About emoji"),
    avatarUrl: z.string().url().optional().describe("URL to an image to use as avatar"),
  },
  async handler({ givenName, familyName, about, aboutEmoji, avatarUrl }) {
    if (!givenName && !familyName && !about && !aboutEmoji && !avatarUrl) {
      return "Error: at least one field must be provided.";
    }

    const avatar = avatarUrl ? await downloadAvatar(avatarUrl) : undefined;

    const request: ProfileUpdate = Object.fromEntries(
      Object.entries({ givenName, familyName, about, aboutEmoji, avatar })
        .filter(([, v]) => v != null),
    );

    await Bun.write(paths.signalProfileUpdateFile, JSON.stringify(request, null, 2));

    const fields = Object.keys(request).join(", ");
    return `Profile update request written (${fields}). The Signal connector will apply it shortly.`;
  },
};

export function createSignalTools(): ToolDefinition[] {
  if (!process.env.CLAUDEBOT_SIGNAL_ACCOUNT) return [];
  return [signalUpdateProfileTool];
}
