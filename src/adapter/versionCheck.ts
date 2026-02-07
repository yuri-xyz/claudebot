/**
 * Version Compatibility Checking
 */

export const SUPPORTED_CLAUDE_CODE_VERSION = "2.1.29";

export const VERSION_DRIFT_THRESHOLDS = {
  major: 1,
  minor: 3,
  patch: 8,
} as const;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export interface VersionCompatibility {
  isCompatible: boolean;
  installedVersion: ParsedVersion | null;
  supportedVersion: ParsedVersion;
  warning: string | null;
  drift: VersionDrift | null;
}

export interface VersionDrift {
  major: number;
  minor: number;
  patch: number;
  trigger: "major" | "minor" | "patch" | null;
  isOlder: boolean;
}

export function parseVersion(versionString: string): ParsedVersion | null {
  if (!versionString) return null;

  const match = versionString.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  const [, majorStr, minorStr, patchStr] = match;
  const major = parseInt(majorStr!, 10);
  const minor = parseInt(minorStr!, 10);
  const patch = parseInt(patchStr!, 10);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) return null;

  return { major, minor, patch, raw: `${major}.${minor}.${patch}` };
}

export function calculateVersionDrift(
  installed: ParsedVersion,
  supported: ParsedVersion,
): VersionDrift {
  const majorDiff = installed.major - supported.major;
  const minorDiff = installed.minor - supported.minor;
  const patchDiff = installed.patch - supported.patch;

  const isOlder =
    majorDiff < 0 ||
    (majorDiff === 0 && minorDiff < 0) ||
    (majorDiff === 0 && minorDiff === 0 && patchDiff < 0);

  let trigger: "major" | "minor" | "patch" | null = null;

  if (Math.abs(majorDiff) >= VERSION_DRIFT_THRESHOLDS.major) {
    trigger = "major";
  } else if (Math.abs(minorDiff) >= VERSION_DRIFT_THRESHOLDS.minor) {
    trigger = "minor";
  } else if (Math.abs(patchDiff) >= VERSION_DRIFT_THRESHOLDS.patch) {
    trigger = "patch";
  }

  return { major: majorDiff, minor: minorDiff, patch: patchDiff, trigger, isOlder };
}

function generateWarningMessage(
  installed: ParsedVersion,
  supported: ParsedVersion,
  drift: VersionDrift,
): string {
  const direction = drift.isOlder ? "older" : "newer";
  const action = drift.isOlder
    ? "Please update Claude Code CLI."
    : "Please check for app updates.";

  if (drift.trigger === "major") {
    return `Claude Code CLI version ${installed.raw} is ${Math.abs(drift.major)} major version(s) ${direction} than ${supported.raw}. ${action}`;
  }
  if (drift.trigger === "minor") {
    return `Claude Code CLI version ${installed.raw} is ${Math.abs(drift.minor)} minor version(s) ${direction} than ${supported.raw}. ${action}`;
  }
  if (drift.trigger === "patch") {
    return `Claude Code CLI version ${installed.raw} is ${Math.abs(drift.patch)} patch version(s) ${direction} than ${supported.raw}. ${action}`;
  }
  return "";
}

export function checkVersionCompatibility(
  installedVersionString: string | null | undefined,
): VersionCompatibility {
  const supportedVersion = parseVersion(SUPPORTED_CLAUDE_CODE_VERSION)!;

  if (!installedVersionString) {
    return {
      isCompatible: false,
      installedVersion: null,
      supportedVersion,
      warning: "Could not determine Claude Code CLI version.",
      drift: null,
    };
  }

  const installedVersion = parseVersion(installedVersionString);

  if (!installedVersion) {
    return {
      isCompatible: false,
      installedVersion: null,
      supportedVersion,
      warning: `Could not parse version: "${installedVersionString}"`,
      drift: null,
    };
  }

  const drift = calculateVersionDrift(installedVersion, supportedVersion);

  if (drift.trigger === null) {
    return {
      isCompatible: true,
      installedVersion,
      supportedVersion,
      warning: null,
      drift,
    };
  }

  const warning = generateWarningMessage(
    installedVersion,
    supportedVersion,
    drift,
  );

  return {
    isCompatible: false,
    installedVersion,
    supportedVersion,
    warning,
    drift,
  };
}

export function isVersionCompatible(
  installedVersionString: string | null | undefined,
): boolean {
  return checkVersionCompatibility(installedVersionString).isCompatible;
}
