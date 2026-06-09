import type { CrustPlugin } from "@crustjs/core";
import {
  ManifestService,
  PluginService,
  RuntimeNotActiveError,
} from "@zenobius/boxfiles-core";
import { builtInPlugins } from "./providers";

const RUNTIME_STATE_KEY = "boxfiles.runtime";

export interface CliRuntime {
  readonly rootDir: string;
  readonly pluginService: PluginService;
  readonly manifestService: ManifestService;
}

let activeRuntime: CliRuntime | null = null;

export function createCliRuntime(rootDir: string): CliRuntime {
  const pluginService = new PluginService(rootDir);
  for (const plugin of builtInPlugins) {
    pluginService.registerPlugin(plugin, "builtin");
  }

  return {
    rootDir,
    pluginService,
    manifestService: new ManifestService(rootDir, pluginService),
  };
}

export function setActiveRuntime(runtime: CliRuntime): void {
  activeRuntime = runtime;
}

export function clearActiveRuntime(): void {
  activeRuntime = null;
}

export function getActiveRuntime(): CliRuntime {
  if (activeRuntime !== null) return activeRuntime;
  throw new RuntimeNotActiveError();
}

export function boxfilesRuntimePlugin(): CrustPlugin {
  return {
    name: "boxfiles-runtime",
    async middleware(context, next) {
      const rootDir = readRootDir(context.input?.flags);
      if (rootDir === null) {
        await next();
        return;
      }

      const previousRuntime = activeRuntime;
      const runtime = createCliRuntime(rootDir);
      context.state.set(RUNTIME_STATE_KEY, runtime);
      setActiveRuntime(runtime);

      try {
        await next();
      } finally {
        if (previousRuntime === null) {
          clearActiveRuntime();
          return;
        }

        setActiveRuntime(previousRuntime);
      }
    },
  };
}

function readRootDir(flags: unknown): string | null {
  if (!isRecord(flags)) return null;

  const dir = flags["dir"];
  if (typeof dir !== "string") return null;
  if (dir.trim().length === 0) return null;

  return dir;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
