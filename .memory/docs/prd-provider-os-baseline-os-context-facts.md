# PRD: provider-os baseline OS context facts

## Problem Statement

Boxfiles has an `os` **Provider**, but it currently registers no **OS Context Facts**. Users cannot write or test planning behavior that depends on baseline workstation operating-system identity, such as platform, architecture, release, or Linux distribution. The placeholder package also leaves unclear whether Boxfiles should use a broad npm inventory dependency or a smaller read-only fact-gathering path.

## Solution

Implement baseline **OS Context Facts** in the `os` **Provider**. The first slice gathers stable, read-only **Baseline OS Identity Facts** using built-in runtime APIs and a tiny Linux distribution parser. Facts are exposed as flat `os.*` **Context Facts**, with unavailable facts omitted rather than filled with placeholder values.

For observability and end-to-end testing, add a minimal `context facts` CLI surface that displays gathered **Context Facts**. The command defaults to human-readable Markdown and supports JSON output plus prefix filtering for stable scripts and Bats assertions.

## User Stories

1. As a Boxfiles manifest author, I want an `os.platform` fact, so that plans can distinguish Linux, macOS, Windows, and BSD hosts.
2. As a Boxfiles manifest author, I want an `os.arch` fact, so that plans can distinguish CPU architecture when choosing workstation setup behavior.
3. As a Boxfiles manifest author, I want OS release and version facts, so that planning can account for host version differences.
4. As a Boxfiles manifest author on Linux, I want distro identity facts, so that plans can distinguish Ubuntu, Fedora-family, Alpine, and other distributions.
5. As a Boxfiles manifest author on Linux, I want distro ancestry represented as a token list, so that future planning can match distro families without each consumer parsing raw strings.
6. As a Boxfiles user, I want unavailable OS facts to be absent, so that planning does not accidentally treat placeholder strings as real host facts.
7. As a Boxfiles user, I want OS facts to be gathered without mutating workstation state, so that dry-run and planning remain safe.
8. As a Boxfiles maintainer, I want provider-os to avoid broad npm inventory dependencies initially, so that dependency risk stays low until rich inventory is actually needed.
9. As a Boxfiles maintainer, I want OS fact gathering isolated behind a small deep module, so that parsing and normalization can be tested without shelling out or depending on the developer machine.
10. As a Boxfiles maintainer, I want the provider's public package API to remain the default plugin export, so that helper internals can change without becoming user-facing API.
11. As a Boxfiles maintainer, I want fact keys to be flat and namespaced, so that they follow the existing `os.*` **Context Fact** vocabulary and collision model.
12. As a Boxfiles CLI user, I want to list gathered context facts, so that I can see what Boxfiles knows about the current workstation.
13. As a Boxfiles CLI user, I want to filter displayed context facts by prefix, so that I can inspect only `os.*` facts.
14. As a script author, I want context facts as JSON, so that automation and end-to-end tests can assert exact fact keys and values.
15. As a script author, I want JSON output to be a stable object keyed by fact token, so that consumers can read values without extra transformations.
16. As a CLI user, I want no-match prefix filtering to succeed with an empty result, so that exploratory queries do not become errors.
17. As a Boxfiles maintainer, I want provider-os documentation to list emitted facts and omission behavior, so that future work does not reintroduce ambiguity.
18. As a Boxfiles maintainer, I want rich inventory, libc detection, WSL detection, and container detection deferred, so that this slice stays small and fact semantics stay clear.

## Implementation Decisions

- The `os` **Provider** will expose **Context Facts** only. It will not expose actions.
- The first slice implements **Baseline OS Identity Facts**, not rich system inventory.
- No npm package will be added for the first slice. Built-in runtime OS APIs cover generic host facts, and Linux distribution facts can be gathered by parsing the standard OS release file.
- Fact names will be flat, stable, and namespaced under `os.*` rather than a single nested `os` object.
- Unavailable facts will be omitted. The provider will not emit `unknown`, `null`, or other placeholders for absent information.
- Failed optional probes will omit only the failed fact and continue gathering the rest of the snapshot.
- Memory facts will use raw numeric byte values.
- Linux distro ancestry will be represented as an array of strings.
- OS fact gathering will use a process-level snapshot cache so multiple flat fact resolvers do not repeat the same file reads during a single CLI run.
- The provider implementation should include an internal deep module for snapshot construction, Linux OS release parsing, and flat fact-map creation.
- Internal helpers may be imported by package-local tests, but the package's public export remains the plugin default export.
- Add a `context facts` CLI command to observe gathered **Context Facts**.
- `context facts` defaults to Markdown output for consistency with existing human-facing CLI output.
- `context facts --json` emits a plain object keyed by fact token.
- `context facts --prefix os.` filters facts by key prefix.
- Output keys are sorted lexicographically for stable human output and stable scripts.
- Prefix filters with no matches succeed and return an empty result.
- Sensitive metadata support is deferred because the current plugin context gathering path hardcodes sensitivity metadata and cannot express per-fact sensitivity without a broader context metadata model change.

## Testing Decisions

- Good tests should assert observable behavior and stable contracts: emitted fact keys, omission behavior, JSON shape, prefix filtering, and provider registration. They should not assert incidental implementation details such as exact helper call order.
- Package-level unit tests should cover Linux OS release parsing, including quoted values, unquoted values, whitespace-separated distro ancestry, missing fields, malformed lines, and omission of unavailable fields.
- Package-level integration tests should gather facts through the plugin registry/context gathering path and assert that `os.*` **Context Facts** are registered as flat facts.
- CLI end-to-end tests should use the compiled binary through Bats, following the existing CLI e2e pattern.
- CLI e2e should assert `context facts --json --prefix os.` succeeds and includes stable baseline keys such as `os.platform` and `os.arch`.
- CLI e2e should assert an unmatched prefix returns success with an empty JSON object.
- CLI e2e should use JSON assertions rather than fragile text matching for machine output.
- Documentation updates should be treated as part of the contract: the README should state emitted facts, omitted-fact behavior, and deferred scope.

## Out of Scope

- Rich hardware, network, disk, service, process, GPU, or package inventory.
- Adding `systeminformation`.
- Adding `detect-libc` or emitting `os.libc.*` facts.
- WSL detection.
- Container detection.
- CPU list facts.
- Sensitive context metadata model changes.
- Template evaluation or manifest condition semantics based on these facts.
- A broad context debugging suite beyond the minimal `context facts` command.
- Publicly exporting provider-os helper modules as stable API.

## Further Notes

Research concluded that `systeminformation` is the best broad npm inventory package if Boxfiles later needs rich cross-platform inventory, including BSD claims. That is deliberately deferred because the current need is baseline **OS Context Facts**, and adding a broad dependency for simple platform and distro facts would be dependency bloat.

Deferred items are tracked in the memory TODO checklist for later slices.
