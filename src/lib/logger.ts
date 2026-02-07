export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;
  return {
    debug(message: string, ...args: unknown[]) {
      if (process.env.DEBUG) {
        console.debug(prefix, message, ...args);
      }
    },
    info(message: string, ...args: unknown[]) {
      console.info(prefix, message, ...args);
    },
    warn(message: string, ...args: unknown[]) {
      console.warn(prefix, message, ...args);
    },
    error(message: string, ...args: unknown[]) {
      console.error(prefix, message, ...args);
    },
  };
}

export const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
