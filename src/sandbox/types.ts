export type ContainerRuntime = "docker" | "podman";

export interface SandboxConfig {
  runtime: ContainerRuntime;
  containerName: string;
  image: string;
  mountPaths: string[];
}

export interface SandboxState {
  exists: boolean;
  running: boolean;
  claudeInstalled: boolean;
  runtime: ContainerRuntime;
  containerName: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Build a SandboxConfig from the user config's sandbox section and a resolved runtime. */
export function buildSandboxConfig(
  sandboxSettings: { containerName: string; image: string; mountPaths: string[] },
  runtime: ContainerRuntime,
): SandboxConfig {
  return {
    runtime,
    containerName: sandboxSettings.containerName,
    image: sandboxSettings.image,
    mountPaths: sandboxSettings.mountPaths,
  };
}
