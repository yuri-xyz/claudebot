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
