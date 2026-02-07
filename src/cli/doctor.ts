/**
 * Doctor CLI Command — diagnose system readiness.
 */

import { defineCommand } from "citty";
import { runAllChecks, printCheckResults, hasRequiredFailures } from "./checks";

export default defineCommand({
  meta: {
    name: "doctor",
    description: "Check system requirements and configuration",
  },
  async run() {
    const results = await runAllChecks();
    printCheckResults(results);

    if (hasRequiredFailures(results)) {
      console.log('Some required checks failed. Run "claudebot setup" to fix.\n');
      process.exit(1);
    }

    console.log("All required checks passed.\n");
  },
});
