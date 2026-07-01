#!/usr/bin/env bats

load "${REPO_DIR:-/repo}/pkgs/e2e-common/helpers.sh"

setup() {
  setup_empty_fixture
}

@test "context facts exposes os JSON facts" {
  assert_boxfiles_bin

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" context facts --json --prefix os.

  [ "$status" -eq 0 ]
  assert_json_os_baseline "$output"
}

@test "context facts unmatched JSON prefix returns empty object" {
  assert_boxfiles_bin

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" context facts --json --prefix missing-os-e2e.

  [ "$status" -eq 0 ]
  assert_json_empty_object "$output"
}

assert_json_os_baseline() {
  run jq -e '
    type == "object"
    and (."os.platform" | type == "string")
    and (."os.arch" | type == "string")
    and (keys | all(startswith("os.")))
  ' <<<"$1"
  [ "$status" -eq 0 ]
}

assert_json_empty_object() {
  run jq -e 'type == "object" and length == 0' <<<"$1"
  [ "$status" -eq 0 ]
}
