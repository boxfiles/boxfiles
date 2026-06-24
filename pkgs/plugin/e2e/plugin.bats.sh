#!/usr/bin/env bats

load "/repo/pkgs/e2e-common/helpers.sh"

setup() {
  setup_empty_fixture
  mkdir -p "$DEMO_FIXTURE_ROOT/plugins/local"
  cat > "$DEMO_FIXTURE_ROOT/plugins/local/index.js" <<'EOF'
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export default {
  id: "local-plugin",
  actions: {
    touch: {
      kind: "local.touch",
      schema: {},
      validate(config) {
        return { success: true, value: config };
      },
      async plan(input) {
        return {
          actionId: input.action.id,
          manifestId: input.action.manifestId,
          kind: input.action.uses,
          summary: `Touch ${input.action.config.to}`,
          safety: { idempotent: true, unsafe: false },
          changes: [],
        };
      },
      async apply(input) {
        const target = join(process.env.HOME, input.action.config.to);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, "local plugin ran\n");
        return { actionId: input.action.id, success: true, message: "local plugin ran" };
      },
    },
  },
};
EOF
}

@test "plugin install and remove file source mutates boxfiles config only" {
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" plugin install local file:./plugins/local

  [ "$status" -eq 0 ]
  assert_file_contains "$DEMO_FIXTURE_ROOT/.boxfilesrc" '"local": "file:./plugins/local"'
  [ -f "$DEMO_FIXTURE_ROOT/plugins/local/index.js" ]

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" plugin remove local --purge

  [ "$status" -eq 0 ]
  [ -f "$DEMO_FIXTURE_ROOT/.boxfilesrc" ]
  run grep -F '"local"' "$DEMO_FIXTURE_ROOT/.boxfilesrc"
  [ "$status" -ne 0 ]
  [ -f "$DEMO_FIXTURE_ROOT/plugins/local/index.js" ]
}

@test "local file plugin action plans and applies" {
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" plugin install local file:./plugins/local
  [ "$status" -eq 0 ]

  write_manifest "local-plugin.yaml" <<'EOF'
name: local-plugin
steps:
  - uses: local.touch
    with:
      to: .config/boxfiles/local-plugin-hit.txt
EOF

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" manifests plan
  [ "$status" -eq 0 ]
  assert_output_contains "local-plugin (local-plugin.yaml)"

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply
  [ "$status" -eq 0 ]
  assert_file_contains "$HOME/.config/boxfiles/local-plugin-hit.txt" "local plugin ran"
}
