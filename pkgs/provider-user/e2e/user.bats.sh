#!/usr/bin/env bats

load "${REPO_DIR:-/repo}/pkgs/e2e-common/helpers.sh"

setup() {
  setup_empty_fixture
}

@test "user provider emits current user context facts" {
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" context facts --json

  [ "$status" -eq 0 ]
  assert_output_contains '"user.username"'
  assert_output_contains '"user.uid"'
  assert_output_contains '"user.gid"'
  assert_output_contains '"user.homedir"'
  assert_output_contains '"user.shell"'
}

@test "user facts are not emitted under os namespace" {
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" context facts --json

  [ "$status" -eq 0 ]
  [[ "$output" != *'"os.user.username"'* ]]
  [[ "$output" != *'"os.homedir"'* ]]
}
