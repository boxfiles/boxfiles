/**
 * Context Fact Service.
 *
 * Provides a typed store of facts gathered from system, user, and project sources.
 */

export type FactSource = "system" | "user" | "project";

export type FactKey = string & { readonly __brand: "FactKey" };

export type ContextFact = {
  readonly key: FactKey;
  readonly source: FactSource;
  readonly value: unknown;
};

export type ContextSnapshot = Readonly<Record<string, unknown>>;

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
    const entries = [...this.facts.values()].map((fact) => [fact.key, fact.value] as const);
    return Object.fromEntries(entries);
  }
}
