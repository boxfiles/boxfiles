# @boxfiles/provider-remove

Remove action provider for Boxfiles.

This package adds the `remove` action kind. It validates removal requests and contributes delete operations to the compiled plan.

## Action kind

```yaml
uses: remove
with:
  path: ~/.config/old-tool
  recursive: true
  force: false
```

Remove operations are marked unsafe because they delete workstation state. Recursive removes are called out separately in plan safety metadata.

## Status

Planning is implemented. Apply is intentionally stubbed until Boxfiles has a concrete execution safety policy.
