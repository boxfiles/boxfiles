# Context Map

Boxfiles uses multi-context domain docs. Start here, then read the context file closest to the code you are changing.

## Global

- `CONTEXT.md` — repo-wide Boxfiles domain language and shared concepts.

## Apps

- `apps/cli/CONTEXT.md` — CLI command surface, routing, and user-facing behavior, when created.
- `apps/docs/CONTEXT.md` — documentation app behavior and content model, when created.
- `apps/demo/CONTEXT.md` — demo app behavior, when created.

## Packages

- `pkgs/config/CONTEXT.md` — configuration loading and validation.
- `pkgs/core/CONTEXT.md` — context facts, manifests, action contracts, plans, and execution.
- `pkgs/diagnostics/CONTEXT.md` — user-facing diagnostic formatting.
- `pkgs/plugin/CONTEXT.md` — plugin shape, registry, source parsing, cache/install/load, and plugin fact gathering.
- `pkgs/provider-copy/CONTEXT.md` — `copy` action provider.
- `pkgs/provider-gpu/CONTEXT.md` — reserved GPU provider namespace.
- `pkgs/provider-link/CONTEXT.md` — `symlink` action provider.
- `pkgs/provider-network/CONTEXT.md` — reserved network provider namespace.
- `pkgs/provider-os/CONTEXT.md` — `os.*` context facts.
- `pkgs/provider-ownership/CONTEXT.md` — reserved ownership provider namespace.
- `pkgs/provider-packages/CONTEXT.md` — reserved package manager provider namespace.
- `pkgs/provider-permissions/CONTEXT.md` — reserved permissions provider namespace.
- `pkgs/provider-remove/CONTEXT.md` — `remove` action provider plan shape.
- `pkgs/provider-rename/CONTEXT.md` — reserved rename provider namespace.
- `pkgs/provider-run/CONTEXT.md` — `run` action provider.
- `pkgs/provider-user/CONTEXT.md` — `user.*` context facts.
- `pkgs/e2e-common/CONTEXT.md` — shared e2e test infrastructure, when created.

## ADRs

- `.memory/docs/adr/` — repo-wide architectural decisions.
- `.memory/docs/adr/<relative-path>/` — context-scoped decisions for a matching app or package path.
