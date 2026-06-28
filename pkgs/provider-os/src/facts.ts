import { readFile } from "node:fs/promises";
import * as runtimeOs from "node:os";
import type { ContextDefinition, JsonValue } from "@boxfiles/core";

export type OsFactMap = Readonly<Record<string, JsonValue>>;

export type OsApi = {
    readonly platform: () => NodeJS.Platform;
    readonly type: () => string;
    readonly release: () => string;
    readonly version: () => string;
    readonly arch: () => string;
    readonly machine: () => string;
    readonly hostname: () => string;
    readonly homedir: () => string;
    readonly tmpdir: () => string;
    readonly userInfo: () => { readonly username?: string };
    readonly totalmem: () => number;
    readonly freemem: () => number;
};

export type OsReleaseFacts = {
    readonly id?: string;
    readonly versionId?: string;
    readonly prettyName?: string;
    readonly idLike?: readonly string[];
};

export type OsFactOptions = {
    readonly os?: OsApi;
    readonly osReleasePath?: string;
    readonly readFile?: (path: string, encoding: "utf8") => Promise<string>;
};

const factKeys = [
    "os.platform",
    "os.type",
    "os.release",
    "os.version",
    "os.arch",
    "os.machine",
    "os.hostname",
    "os.homedir",
    "os.tmpdir",
    "os.user.username",
    "os.memory.total",
    "os.memory.free",
    "os.distro.id",
    "os.distro.versionId",
    "os.distro.prettyName",
    "os.distro.idLike",
] as const;

export function createOsContext(options: OsFactOptions = {}): ContextDefinition {
    let snapshot: Promise<OsFactMap> | null = null;
    const context: Record<string, () => Promise<JsonValue | undefined>> = {};

    for (const key of factKeys) {
        context[key] = async () => {
            snapshot ??= buildOsFactMap(options);
            return (await snapshot)[key];
        };
    }

    return context;
}

export async function buildOsFactMap(options: OsFactOptions = {}): Promise<OsFactMap> {
    const os = options.os ?? runtimeOs;
    const facts: Record<string, JsonValue> = {};

    setStringFact(facts, "os.platform", readOptional(() => os.platform()));
    setStringFact(facts, "os.type", readOptional(() => os.type()));
    setStringFact(facts, "os.release", readOptional(() => os.release()));
    setStringFact(facts, "os.version", readOptional(() => os.version()));
    setStringFact(facts, "os.arch", readOptional(() => os.arch()));
    setStringFact(facts, "os.machine", readOptional(() => os.machine()));
    setStringFact(facts, "os.hostname", readOptional(() => os.hostname()));
    setStringFact(facts, "os.homedir", readOptional(() => os.homedir()));
    setStringFact(facts, "os.tmpdir", readOptional(() => os.tmpdir()));
    setStringFact(facts, "os.user.username", readOptional(() => os.userInfo().username));
    setNumberFact(facts, "os.memory.total", readOptional(() => os.totalmem()));
    setNumberFact(facts, "os.memory.free", readOptional(() => os.freemem()));

    if (facts["os.platform"] !== "linux") return facts;

    const distro = await readLinuxOsRelease(options);
    setStringFact(facts, "os.distro.id", distro.id);
    setStringFact(facts, "os.distro.versionId", distro.versionId);
    setStringFact(facts, "os.distro.prettyName", distro.prettyName);
    setStringArrayFact(facts, "os.distro.idLike", distro.idLike);
    return facts;
}

export function parseOsRelease(text: string): OsReleaseFacts {
    const values: Record<string, string> = {};

    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith("#")) continue;
        const separatorIndex = line.indexOf("=");
        if (separatorIndex <= 0) continue;
        values[line.slice(0, separatorIndex)] = unquoteOsReleaseValue(line.slice(separatorIndex + 1).trim());
    }

    const idLike = values["ID_LIKE"]?.split(/\s+/u).filter((value) => value.length > 0);
    return {
        id: emptyToUndefined(values["ID"]),
        versionId: emptyToUndefined(values["VERSION_ID"]),
        prettyName: emptyToUndefined(values["PRETTY_NAME"]),
        idLike: idLike === undefined || idLike.length === 0 ? undefined : idLike,
    };
}

async function readLinuxOsRelease(options: OsFactOptions): Promise<OsReleaseFacts> {
    try {
        const text = await (options.readFile ?? readFile)(options.osReleasePath ?? "/etc/os-release", "utf8");
        return parseOsRelease(text);
    } catch {
        return {};
    }
}

function readOptional<T>(read: () => T): T | undefined {
    try {
        return read();
    } catch {
        return undefined;
    }
}

function setStringFact(facts: Record<string, JsonValue>, key: string, value: string | undefined): void {
    if (value === undefined || value.length === 0) return;
    facts[key] = value;
}

function setNumberFact(facts: Record<string, JsonValue>, key: string, value: number | undefined): void {
    if (value === undefined || !Number.isFinite(value)) return;
    facts[key] = value;
}

function setStringArrayFact(facts: Record<string, JsonValue>, key: string, value: readonly string[] | undefined): void {
    if (value === undefined || value.length === 0) return;
    facts[key] = value;
}

function unquoteOsReleaseValue(value: string): string {
    if (value.length < 2) return value;
    const quote = value[0];
    if ((quote !== "\"" && quote !== "'") || value[value.length - 1] !== quote) return value;
    return value.slice(1, -1).replace(/\\(["'\\$`])/gu, "$1");
}

function emptyToUndefined(value: string | undefined): string | undefined {
    if (value === undefined || value.length === 0) return undefined;
    return value;
}
