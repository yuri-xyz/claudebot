/**
 * Discord Slash Command Registration
 */

import { REST, Routes } from "discord.js";

const COMMANDS = [
  {
    name: "ask",
    description: "Ask Claude a question",
    options: [
      {
        name: "prompt",
        description: "What to ask Claude",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "status",
    description: "Show claudebot status",
  },
];

export async function registerSlashCommands(
  token: string,
  clientId: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationCommands(clientId), {
    body: COMMANDS,
  });
}
