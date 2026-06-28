import * as runtimeOs from "node:os";
import type { ContextDefinition, JsonValue } from "@boxfiles/core";

export type UserFactMap = Readonly<Record<string, JsonValue>>;

export type UserInfo = {
    readonly username?: string;
    readonly uid?: number;
    readonly gid?: number;
    readonly homedir?: string;
    readonly shell?: string | null;
};

export type UserApi = {
    readonly userInfo: () => UserInfo;
};

export type UserFactOptions = {
    readonly os?: UserApi;
};

const factKeys = [
    "user.username",
    "user.uid",
    "user.gid",
    "user.homedir",
    "user.shell",
] as const;

export function createUserContext(options: UserFactOptions = {}): ContextDefinition {
    let snapshot: UserFactMap | null = null;
    const context: Record<string, () => JsonValue | undefined> = {};

    for (const key of factKeys) {
        context[key] = () => {
            snapshot ??= buildUserFactMap(options);
            return snapshot[key];
        };
    }

    return context;
}

export function buildUserFactMap(options: UserFactOptions = {}): UserFactMap {
    const os = options.os ?? runtimeOs;
    const facts: Record<string, JsonValue> = {};
    const info = readOptional(() => os.userInfo());
    if (info === undefined) return facts;

    setStringFact(facts, "user.username", info.username);
    setNonNegativeNumberFact(facts, "user.uid", info.uid);
    setNonNegativeNumberFact(facts, "user.gid", info.gid);
    setStringFact(facts, "user.homedir", info.homedir);
    setStringFact(facts, "user.shell", info.shell ?? undefined);

    return facts;
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

function setNonNegativeNumberFact(facts: Record<string, JsonValue>, key: string, value: number | undefined): void {
    if (value === undefined || !Number.isFinite(value) || value < 0) return;
    facts[key] = value;
}
