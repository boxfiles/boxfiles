---
name: typescript-styleguide
description: |
  Rules and guidelines for reading and writing typescript. 
  Use when the user asks to "optimize TypeScript performance", "speed up tsc compilation", "configure tsconfig.json", "fix type errors", "improve async patterns", or encounters TS errors (TS2322, TS2339, "is not assignable to"). Also triggers on .ts, .tsx, .d.ts file work involving type definitions, module organization, or memory management. Does NOT cover TypeScript basics, framework-specific patterns, or testing.
  Results in a list of rules with priority, category, and prefix for automated refactoring and code generation.
---

# TypeScript Best Practices

Comprehensive performance optimization guide for TypeScript applications. Contains 42 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Configuring tsconfig.json for a new or existing project
- Writing complex type definitions or generics
- Optimizing async/await patterns and data fetching
- Organizing modules and managing imports
- Reviewing code for compilation or runtime performance

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Type System Performance | CRITICAL | `type-` |
| 2 | Compiler Configuration | CRITICAL | `tscfg-` |
| 3 | Async Patterns | HIGH | `async-` |
| 4 | Module Organization | HIGH | `module-` |
| 5 | Type Safety Patterns | MEDIUM-HIGH | `safety-` |
| 6 | Memory Management | MEDIUM | `mem-` |
| 7 | Runtime Optimization | LOW-MEDIUM | `runtime-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Table of Contents

1. Type System Performance — **CRITICAL**
   - Add explicit return types to exported functions.
   - Avoid deeply nested generic types.
   - Avoid large union types.
   - Extract conditional types to named aliases.
   - Limit type recursion depth.
   - Prefer interfaces over type intersections.
   - Simplify complex mapped types.
2. Compiler Configuration — **CRITICAL**
   - Configure include and exclude properly.
   - Enable incremental compilation when appropriate.
   - Enable `skipLibCheck` for faster builds when dependency types are trusted.
   - Enable `strictFunctionTypes`.
   - Use `isolatedModules` for single-file transpilation.
   - Use project references for large codebases.
3. Async Patterns — **HIGH**
   - Annotate async function return types.
   - Avoid `await` inside loops unless operations are intentionally sequential.
   - Avoid unnecessary `async`/`await`.
   - Defer await until value is needed.
   - Use `Promise.all` for independent operations.
4. Module Organization — **HIGH**
   - Avoid barrel file imports.
   - Avoid circular dependencies.
   - Control `@types` package inclusion.
   - Use dynamic imports for large modules.
   - Use type-only imports for types.
5. Type Safety Patterns — **MEDIUM-HIGH**
   - Enable `strictNullChecks`.
   - Prefer `unknown` over `any`.
   - Use assertion functions for validation.
   - Use const assertions for literal types.
   - Use exhaustive checks for union types.
   - Use type guards for runtime type checking.
6. Memory Management — **MEDIUM**
   - Avoid closure memory leaks.
   - Avoid global state accumulation.
   - Clean up event listeners.
   - Clear timers and intervals.
   - Use `WeakMap` for object metadata.
7. Runtime Optimization — **LOW-MEDIUM**
   - Avoid object spread in hot loops.
   - Cache property access in loops.
   - Prefer native array methods over lodash.
   - Use `for...of` for simple iteration.
   - Use modern string methods.
   - Use `Set`/`Map` for O(1) lookups.
8. Advanced Patterns — **LOW**
   - Use branded types for type-safe IDs.
   - Use `satisfies` for type validation with inference.
   - Use template literal types for string patterns.

## Boxfiles repo constraints

- `strict` mode is enabled. Treat type errors as blockers.
- MUST NOT use `any`; prefer `unknown`, discriminated unions, branded IDs, generics, or explicit domain types.
- MUST NOT weaken `tsconfig.json` strictness to pass checks.
- Prefer readonly data where mutation is not required.
- Prefer exhaustive `switch` plus `never` checks over stringly branching.
- Avoid destructuring fields from objects; use dot notation for refactor clarity.
- Do not use package barrel exports to hide ownership.

## References

1. https://github.com/microsoft/TypeScript/wiki/Performance
2. https://www.typescriptlang.org/docs/handbook/
3. https://v8.dev/blog
4. https://nodejs.org/en/learn/diagnostics/memory
