#!/usr/bin/env bats

load "${REPO_DIR:-/repo}/pkgs/e2e-common/helpers.sh"

setup() {
  setup_demo_fixture
  write_manifest ".boxfilesrc.yaml" <<'EOF'
plugins: {}
EOF
}

@test "manifests files lists demo manifests and ignores assets/config" {
  assert_boxfiles_bin

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" manifests files

  [ "$status" -eq 0 ]
  assert_output_contains "Discovered Manifests"
  assert_output_contains "workstation.yaml"
  assert_output_contains "base/foundation.toml"
  assert_output_contains "runtime/javascript.yaml"
  assert_output_contains "boxfiles.yaml"
  [[ "$output" != *".boxfilesrc"* ]]
  [[ "$output" != *"files/sample.yaml"* ]]
  [[ "$output" != *"applications/files/package-list.yml"* ]]
}

@test "manifests validate reports invalid manifest path" {
  write_manifest "broken.yaml" <<'EOF'
steps: [
EOF

  assert_boxfiles_bin
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" manifests validate

  [ "$status" -ne 0 ]
  assert_output_contains "Manifest Validation Errors"
  assert_output_contains "broken.yaml"
}

@test "manifests plan shows dependency tree order" {
  assert_boxfiles_bin

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" manifests plan

  [ "$status" -eq 0 ]
  assert_output_contains "Manifest Plan"
  assert_output_contains "workstation (workstation.yaml)"
  assert_output_contains "base.foundation (base/foundation.toml)"
  assert_output_contains "development.source-control (development/source-control.toml)"
}
