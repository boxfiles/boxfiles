# @boxfiles/core

Owns the core provisioning model: context facts, manifests, action provider contracts, plans, and plan execution.

## Language

**Action Provider**:
A provider-owned implementation that validates an action config, produces an **Action Plan**, and may apply it.
_Avoid_: plugin, command handler

**Resolved Step**:
A manifest step after config validation and step id derivation.
_Avoid_: raw step

**Compiled Manifest**:
A parsed manifest with resolved steps and dependency metadata.
_Avoid_: loaded file

**Action Plan**:
The planned change produced for one resolved step.
_Avoid_: execution result

**Plan Executor**:
Runs action plans through their owning action providers.
_Avoid_: planner

## Boundaries

- `ContextService` owns fact storage and collision policy.
- `ManifestService` discovers, parses, and validates manifests.
- `PlanService` orders manifests and asks action providers to plan.
- `PlanExecutor` applies a compiled plan.
- Core must not know concrete built-in providers beyond the `ActionProvider` contract.

## Flow

```text
ContextService gathers Context Facts
  -> ManifestService discovers/parses manifests
  -> ManifestService resolves steps through Action Providers
  -> PlanService orders dependencies and builds Action Plans
  -> PlanExecutor applies each Action Plan
```
