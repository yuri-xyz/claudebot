/**
 * Replace CLI Command — reinstall the service without resetting settings.
 */

import { defineCommand } from "citty";
import { getServiceManager, buildDaemonArgs } from "../service";
import { ensureDataDirs, clearServiceLogs } from "../config/config";
import { generateMcpConfig } from "../tools";
import { errorMessage } from "../lib/errors";

export default defineCommand({
  meta: {
    name: "replace",
    description: "Reinstall the service without resetting settings",
  },
  async run() {
    console.log("claudebot replace\n");
    const svc = getServiceManager();

    // 1. Stop if running
    const status = await svc.getStatus();
    if (status.running) {
      console.log("Stopping service...");
      await svc.stop();
    }

    // 2. Ensure dirs exist, clear logs, regenerate MCP config
    await ensureDataDirs();
    await clearServiceLogs();
    await generateMcpConfig();

    // 3. Reinstall and start
    try {
      const programArgs = buildDaemonArgs(import.meta.dir);
      console.log(`Installing service (${svc.platform})...`);
      await svc.install(programArgs);

      console.log("Starting service...");
      await svc.start();
      console.log("Service running.\n");
    } catch (err) {
      console.error(`Failed: ${errorMessage(err)}`);
      process.exit(1);
    }
  },
});
