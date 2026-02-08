/**
 * Soul CLI Command — open the SOUL.md file for editing.
 */

import { defineCommand } from "citty";
import { paths } from "../config/paths";

export default defineCommand({
  meta: {
    name: "soul",
    description: "Open the SOUL.md persona file in micro editor",
  },
  async run() {
    const proc = Bun.spawn(["micro", paths.soulFile], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;
  },
});
