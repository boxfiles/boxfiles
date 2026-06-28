# Domain Docs

How engineering skills consume this repo's domain documentation.

## Layout

This repo uses **multi-context** domain docs.

Expected structure:

```text
/
├── CONTEXT-MAP.md
├── .memory/docs/adr/                  # system-wide decisions
├── apps/<name>/CONTEXT.md             # app-specific context, when needed
└── pkgs/<name>/CONTEXT.md             # package-specific context, when needed
```

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root. It points at relevant context files.
- Relevant per-context **`CONTEXT.md`** files for the code area being changed.
- **`.memory/docs/adr/`** for system-wide decisions.
- **`.memory/docs/adr/<relativepath>/`** for context-scoped decisions.

If any files don't exist, proceed silently. The producer skill (`/eng-grill-with-docs`) creates them lazily when terms or decisions get resolved.

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept needed isn't in the glossary yet, note it for `/eng-grill-with-docs`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly instead of silently overriding it.
