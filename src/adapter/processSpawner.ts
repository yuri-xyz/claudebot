/**
 * Bun-based ProcessSpawner implementations.
 *
 * Provides two implementations:
 * - createBunProcessSpawner(): Direct host execution
 * - createSandboxedProcessSpawner(): Execution inside a Docker/Podman container
 */

import type { ProcessSpawner, ProcessHandle, SpawnOptions } from "./types";
import type { ContainerRuntime } from "../sandbox/types";

/**
 * Creates a ProcessSpawner that runs commands directly on the host using Bun.
 */
export function createBunProcessSpawner(): ProcessSpawner {
  return {
    spawn(
      executable: string,
      args: string[],
      options: SpawnOptions,
    ): ProcessHandle {
      const proc = Bun.spawn([executable, ...args], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdoutListeners: Array<(data: Buffer) => void> = [];
      const stderrListeners: Array<(data: Buffer) => void> = [];
      const exitListeners: Array<
        (code: number | null, signal: string | null) => void
      > = [];
      const errorListeners: Array<(error: Error) => void> = [];

      // Read stdout stream
      (async () => {
        try {
          const reader = proc.stdout.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const buf = Buffer.from(value);
            for (const listener of stdoutListeners) {
              listener(buf);
            }
          }
        } catch (err) {
          if (err instanceof Error) {
            for (const listener of errorListeners) {
              listener(err);
            }
          }
        }
      })();

      // Read stderr stream
      (async () => {
        try {
          if (proc.stderr) {
            const reader = proc.stderr.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const buf = Buffer.from(value);
              for (const listener of stderrListeners) {
                listener(buf);
              }
            }
          }
        } catch {
          // stderr read errors are non-fatal
        }
      })();

      // Wait for exit
      proc.exited.then((code) => {
        for (const listener of exitListeners) {
          listener(code, null);
        }
      });

      return {
        pid: proc.pid,
        writeStdin(data: string): boolean {
          try {
            proc.stdin.write(data);
            return true;
          } catch {
            return false;
          }
        },
        kill(signal?: string) {
          try {
            if (signal === "SIGKILL") {
              proc.kill(9);
            } else {
              proc.kill();
            }
          } catch {
            // Process may already be dead
          }
        },
        onStdout(listener: (data: Buffer) => void) {
          stdoutListeners.push(listener);
        },
        onStderr(listener: (data: Buffer) => void) {
          stderrListeners.push(listener);
        },
        onExit(
          listener: (code: number | null, signal: string | null) => void,
        ) {
          exitListeners.push(listener);
        },
        onError(listener: (error: Error) => void) {
          errorListeners.push(listener);
        },
      };
    },

    async execFile(
      executable: string,
      args: string[],
      options: { timeout?: number },
    ): Promise<{ stdout: string; stderr: string }> {
      const proc = Bun.spawn([executable, ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });

      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      if (options.timeout) {
        timer = setTimeout(() => {
          timedOut = true;
          proc.kill();
        }, options.timeout);
      }

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      await proc.exited;

      if (timer) clearTimeout(timer);

      if (timedOut) {
        throw new Error(`Command timed out after ${options.timeout}ms`);
      }

      return { stdout, stderr };
    },
  };
}

/**
 * Creates a ProcessSpawner that runs commands inside a Docker/Podman container.
 * Wraps all commands with `docker exec -i <containerName>`.
 */
export function createSandboxedProcessSpawner(
  runtime: ContainerRuntime,
  containerName: string,
): ProcessSpawner {
  const hostSpawner = createBunProcessSpawner();

  return {
    spawn(
      executable: string,
      args: string[],
      options: SpawnOptions,
    ): ProcessHandle {
      const dockerArgs = ["exec", "-i"];

      if (options.cwd) {
        dockerArgs.push("-w", options.cwd);
      }

      for (const [key, value] of Object.entries(options.env ?? {})) {
        if (value !== undefined) {
          dockerArgs.push("-e", `${key}=${value}`);
        }
      }

      dockerArgs.push(containerName, executable, ...args);

      return hostSpawner.spawn(runtime, dockerArgs, {
        // No cwd for the docker command itself; cwd is passed via -w
        stdio: options.stdio,
      });
    },

    async execFile(
      executable: string,
      args: string[],
      options: { timeout?: number },
    ): Promise<{ stdout: string; stderr: string }> {
      return hostSpawner.execFile(
        runtime,
        ["exec", containerName, executable, ...args],
        options,
      );
    },
  };
}
