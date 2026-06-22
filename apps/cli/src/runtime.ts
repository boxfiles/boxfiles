import type { CrustPlugin } from "@crustjs/core";
import {
  ManifestService,
  RuntimeNotActiveError,
  } from "@boxfiles/core";
import { PluginRegistry } from "@boxfiles/plugin";
import { builtInPlugins } from "./providers";

const RUNTIME_STATE_KEY = "boxfiles.runtime";

export interface CliRuntime {
  readonly rootDir: string;
  readonly pluginService: PluginRegistry;
  readonly manifestService: ManifestService;
}

let activeRuntime: CliRuntime | null = null;

export function createCliRuntime(rootDir: string): CliRuntime {
  const pluginService = new PluginRegistry();
  for (const plugin of builtInPlugins) {
    pluginService.registerPlugin(plugin, "builtin");
  }

  return {
    rootDir,
    pluginService,
    manifestService: new ManifestService(rootDir, pluginService),
  };
}

export async function createConfiguredCliRuntime(
  rootDir: string,
): Promise<CliRuntime> {
  return await createRuntimeForRoute(rootDir);
}

async function createRuntimeForRoute(
  rootDir: string,
  commandPath?: readonly string[],
): Promise<CliRuntime> {
  const runtime = createCliRuntime(rootDir);
  if (!shouldLoadInstalledPlugins(commandPath)) return runtime;

  return runtime;
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
      const runtime = await createRuntimeForRoute(
        rootDir,
        context.route?.commandPath,
      );
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

function shouldLoadInstalledPlugins(
  commandPath: readonly string[] | undefined,
): boolean {
  if (commandPath === undefined) return true;

  const pluginCommandIndex = commandPath.findIndex(
    (segment) => segment === "plugin",
  );
  if (pluginCommandIndex === -1) return true;

  const subcommand = commandPath[pluginCommandIndex + 1];
  return subcommand !== "install" && subcommand !== "remove";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
