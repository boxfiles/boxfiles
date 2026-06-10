export type PluginSourceKind = "npm" | "git" | "file";

export type NpmPluginSource = {
  readonly kind: "npm";
  readonly packageName: string;
  readonly version?: string;
};

export type GitPluginSource = {
  readonly kind: "git";
  readonly url: string;
  readonly ref?: string;
};

export type FilePluginSource = {
  readonly kind: "file";
  readonly path: string;
};

export type ParsedPluginSource = NpmPluginSource | GitPluginSource | FilePluginSource;

export class PluginSourceParseError extends Error {
  constructor(source: string, reason: string) {
    super(`Invalid plugin source ${JSON.stringify(source)}: ${reason}`);
    this.name = "PluginSourceParseError";
  }
}

export function parsePluginSource(source: string): ParsedPluginSource {
  const separatorIndex = source.indexOf(":");
  if (separatorIndex <= 0) {
    throw new PluginSourceParseError(source, "expected npm:, git:, or file: prefix");
  }

  const kind = source.slice(0, separatorIndex);
  const spec = source.slice(separatorIndex + 1);
  if (spec.trim().length === 0 || /\s/.test(spec)) {
    throw new PluginSourceParseError(source, "source value must be non-empty and contain no whitespace");
  }

  switch (kind) {
    case "npm":
      return parseNpmPluginSource(source, spec);
    case "git":
      return parseGitPluginSource(source, spec);
    case "file":
      return parseFilePluginSource(source, spec);
    default:
      throw new PluginSourceParseError(source, `unsupported source prefix ${JSON.stringify(kind)}`);
  }
}

function parseNpmPluginSource(source: string, spec: string): NpmPluginSource {
  if (spec.includes("://")) {
    throw new PluginSourceParseError(source, "npm source must be a package spec, not a URL");
  }

  const versionSeparatorIndex = findNpmVersionSeparator(spec);
  const packageName = versionSeparatorIndex === -1 ? spec : spec.slice(0, versionSeparatorIndex);
  const version = versionSeparatorIndex === -1 ? undefined : spec.slice(versionSeparatorIndex + 1);

  if (!isValidNpmPackageName(packageName)) {
    throw new PluginSourceParseError(source, "npm package name is malformed");
  }

  if (version !== undefined && !isValidNpmVersionSpec(version)) {
    throw new PluginSourceParseError(source, "npm version spec is malformed");
  }

  return version === undefined
    ? { kind: "npm", packageName }
    : { kind: "npm", packageName, version };
}

function parseGitPluginSource(source: string, spec: string): GitPluginSource {
  const refSeparatorIndex = spec.indexOf("#");
  if (refSeparatorIndex !== spec.lastIndexOf("#")) {
    throw new PluginSourceParseError(source, "git source must contain at most one ref separator");
  }

  const url = refSeparatorIndex === -1 ? spec : spec.slice(0, refSeparatorIndex);
  const ref = refSeparatorIndex === -1 ? undefined : spec.slice(refSeparatorIndex + 1);

  if (!isValidGitUrl(url)) {
    throw new PluginSourceParseError(source, "git URL is malformed or uses an unsupported protocol");
  }

  if (ref !== undefined && !isValidGitRef(ref)) {
    throw new PluginSourceParseError(source, "git ref is malformed");
  }

  return ref === undefined ? { kind: "git", url } : { kind: "git", url, ref };
}

function parseFilePluginSource(source: string, spec: string): FilePluginSource {
  if (spec.includes("\0") || spec.includes("://")) {
    throw new PluginSourceParseError(source, "file source must be a local path");
  }

  return { kind: "file", path: spec };
}

function findNpmVersionSeparator(spec: string): number {
  const searchFrom = spec.startsWith("@") ? spec.indexOf("/") : 0;
  if (searchFrom === -1) return -1;

  return spec.indexOf("@", searchFrom);
}

function isValidNpmPackageName(packageName: string): boolean {
  const unscopedPackagePattern = /^[a-z0-9][a-z0-9._~-]*$/;
  const scopedPackagePattern = /^@[a-z0-9][a-z0-9._~-]*\/[a-z0-9][a-z0-9._~-]*$/;
  return unscopedPackagePattern.test(packageName) || scopedPackagePattern.test(packageName);
}

function isValidNpmVersionSpec(version: string): boolean {
  if (version.length === 0) return false;
  if (version.includes("://")) return false;

  return /^[A-Za-z0-9._~^<>=*|+\-]+$/.test(version);
}

function isValidGitUrl(url: string): boolean {
  if (url.length === 0) return false;
  if (isScpLikeGitUrl(url)) return true;

  const supportedProtocolPrefixes = ["https://", "ssh://", "git://", "git+ssh://"];
  if (!supportedProtocolPrefixes.some((prefix) => url.startsWith(prefix))) return false;

  try {
    const parsed = new URL(url);
    return ["https:", "ssh:", "git:", "git+ssh:"].includes(parsed.protocol)
      && parsed.hostname.length > 0
      && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

function isScpLikeGitUrl(url: string): boolean {
  return /^[A-Za-z0-9._~-]+@[A-Za-z0-9.-]+:[^\s:]+$/.test(url);
}

function isValidGitRef(ref: string): boolean {
  if (ref.length === 0) return false;
  if (ref === "@") return false;
  if (ref.startsWith("/") || ref.endsWith("/")) return false;
  if (ref.includes("..") || ref.includes("//") || ref.includes("@{")) return false;
  if (/[\\\s~^:?*[\]\0\x00-\x1F\x7F]/.test(ref)) return false;

  const components = ref.split("/");
  return components.every(isValidGitRefComponent);
}

function isValidGitRefComponent(component: string): boolean {
  if (component.length === 0) return false;
  if (component.startsWith(".")) return false;
  if (component.endsWith(".") || component.endsWith(".lock")) return false;

  return true;
}
