/**
 * Memories CLI Command — open the memories.md file for editing.
 */

import { defineCommand } from "citty";
import { paths } from "../config/paths";

export default defineCommand({
  meta: {
    name: "memories",
    description: "Open the memories.md file in micro editor",
  },
  async run() {
    const proc = Bun.spawn(["micro", paths.memoriesFile], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;
  },
});
