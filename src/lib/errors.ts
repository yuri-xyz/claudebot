export class ClaudebotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ClaudebotError";
  }
}

export class SandboxError extends ClaudebotError {
  constructor(message: string) {
    super(message, "SANDBOX_ERROR");
    this.name = "SandboxError";
  }
}

export class ConfigError extends ClaudebotError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class AdapterError extends ClaudebotError {
  constructor(message: string) {
    super(message, "ADAPTER_ERROR");
    this.name = "AdapterError";
  }
}

export class SkillsError extends ClaudebotError {
  constructor(message: string) {
    super(message, "SKILLS_ERROR");
    this.name = "SkillsError";
  }
}
