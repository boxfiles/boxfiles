/**
 * Context Fact Service.
 *
 * Provides a typed store of facts gathered from system, user, and project sources.
 */

import Type from "typebox";
import {
    BrandedStringSchema,
    NonBlankStringSchema,
} from "../common/schema";
import {
    DuplicateContextFactError,
    EmptyFactKeyError,
    InvalidFactCollisionPolicyError,
} from "../exceptions/context";


export const FactSourceSchema = Type.Union([
    Type.Literal("system"),
    Type.Literal("user"),
    Type.Literal("project"),
    Type.Literal("plugin"),
]);

export const FactValueKindSchema = Type.Union([
    Type.Literal("static"),
    Type.Literal("computed"),
]);

export const FactCollisionSchema = Type.Union([
    Type.Literal("error"),
    Type.Literal("override"),
    Type.Literal("keep-first"),
]);

export const FactKeySchema = BrandedStringSchema<"FactKey">();

export const FactMetadataSchema = Type.Object({
    source: Type.Readonly(FactSourceSchema),
    pluginId: Type.Readonly(Type.Optional(NonBlankStringSchema)),
    providerId: Type.Readonly(Type.Optional(NonBlankStringSchema)),
    valueKind: Type.Readonly(FactValueKindSchema),
    sensitive: Type.Readonly(Type.Boolean()),
    collision: Type.Readonly(FactCollisionSchema),
});

export const ContextFactSchema = Type.Object({
    key: Type.Readonly(FactKeySchema),
    source: Type.Readonly(FactSourceSchema),
    value: Type.Readonly(Type.Unknown()),
    metadata: Type.Readonly(FactMetadataSchema),
});

export const ContextSnapshotSchema = Type.Record(Type.String(), Type.Unknown());

export type FactSource = Type.Static<typeof FactSourceSchema>;
export type FactValueKind = Type.Static<typeof FactValueKindSchema>;
export type FactCollision = Type.Static<typeof FactCollisionSchema>;
export type FactMetadata = Type.Static<typeof FactMetadataSchema>;
export type FactKey = Type.Static<typeof FactKeySchema>;
export type ContextFact = Type.Static<typeof ContextFactSchema>;
export type ContextSnapshot = Readonly<
    Type.Static<typeof ContextSnapshotSchema>
>;

export class ContextService {
    private readonly facts = new Map<FactKey, ContextFact>();

    constructor(initialFacts: readonly ContextFact[] = []) {
        for (const fact of initialFacts) {
            this.set(fact);
        }
    }

    static create(initialFacts: readonly ContextFact[] = []): ContextService {
        return new ContextService(initialFacts);
    }

    static factKey(value: string): FactKey {
        const key = value.trim();
        if (key.length === 0) {
            throw new EmptyFactKeyError();
        }

        return key as FactKey;
    }

    set(fact: ContextFact): void {
        const existing = this.facts.get(fact.key);
        if (!existing) {
            this.facts.set(fact.key, fact);
            return;
        }

        switch (fact.metadata.collision) {
            case "error":
                throw new DuplicateContextFactError(fact.key);
            case "keep-first":
                return;
            case "override":
                this.facts.set(fact.key, fact);
                return;
            default:
                assertNever(fact.metadata.collision);
        }
    }

    get(key: FactKey): ContextFact | null {
        return this.facts.get(key) ?? null;
    }

    snapshot(): ContextSnapshot {
        const entries = [...this.facts.values()].map(
            (fact) => [fact.key, fact.value] as const,
        );
        return Object.fromEntries(entries);
    }
}

function assertNever(value: never): never {
    throw new InvalidFactCollisionPolicyError(String(value));
}
