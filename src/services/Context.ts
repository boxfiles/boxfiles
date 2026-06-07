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


export const FactSourceSchema = Type.Union([
    Type.Literal("system"),
    Type.Literal("user"),
    Type.Literal("project"),
]);

export const FactKeySchema = BrandedStringSchema<"FactKey">();

export const ContextFactSchema = Type.Object({
    key: Type.Readonly(FactKeySchema),
    source: Type.Readonly(FactSourceSchema),
    value: Type.Readonly(Type.Unknown()),
});

export const ContextSnapshotSchema = Type.Record(Type.String(), Type.Unknown());

export type FactSource = Type.Static<typeof FactSourceSchema>;
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
            throw new Error("Fact key must not be empty");
        }

        return key as FactKey;
    }

    set(fact: ContextFact): void {
        this.facts.set(fact.key, fact);
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
