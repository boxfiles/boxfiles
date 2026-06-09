# @boxfiles/core

Core types and services for Boxfiles.

This package contains the shared domain model used by the CLI and provider packages:

- manifest parsing and validation
- context fact storage
- plugin and action provider contracts
- plan compilation types and services
- shared schema helpers and domain errors

Use this package when building a Boxfiles provider or when embedding Boxfiles planning logic in another tool.

## Status

Planning APIs are active. Execution safety is still being defined, so providers may expose planning behavior before real apply behavior.
