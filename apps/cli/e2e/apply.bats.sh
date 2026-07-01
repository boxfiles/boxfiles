#!/usr/bin/env bats

load "/repo/pkgs/e2e-common/helpers.sh"

setup() {
  setup_demo_fixture
  rm -f "$DEMO_FIXTURE_ROOT/failure.yaml" "$DEMO_FIXTURE_ROOT/skipped.yaml"
}

write_failing_manifest() {
  write_manifest "failure.yaml" <<'EOF'
name: failure
steps:
  - uses: run
    with:
      command: "false"
  - uses: run
    with:
      command: touch ~/.config/boxfiles/failure-hit
EOF
}

write_skipped_manifest() {
  write_manifest "skipped.yaml" <<'EOF'
name: skipped
steps:
  - uses: run
    when: "false"
    with:
      command: touch ~/.config/boxfiles/skip-hit
EOF
}

@test "apply dry-run does not mutate" {
  assert_boxfiles_bin
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"Apply Dry Run"* ]]
  [[ "$output" == *"workstation"* ]]
  [ ! -f "$HOME/.config/boxfiles/welcome.json" ]
}

@test "apply live mutates target file" {
  assert_boxfiles_bin
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm
  [ "$status" -eq 0 ]
  [ -f "$HOME/.config/boxfiles/welcome.json" ]
  run cat "$HOME/.config/boxfiles/welcome.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"workstation"* ]]
}

@test "apply stops on first failure" {
  write_failing_manifest

  assert_boxfiles_bin
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm
  [ "$status" -ne 0 ]
  [[ "$output" == *"run failed with exit code 1"* ]]
  [ ! -f "$HOME/.config/boxfiles/failure-hit" ]
}

@test "apply skips false when" {
  write_skipped_manifest

  assert_boxfiles_bin
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm
  [ "$status" -eq 0 ]
  [ ! -f "$HOME/.config/boxfiles/skip-hit" ]
}

write_context_template_manifest() {
  write_manifest "context-template.yaml" <<'EOF'
name: context-template
steps:
  - uses: run
    with:
      command: touch {{ user.homedir }}/.config/boxfiles/context-template-hit
EOF
}

@test "apply renders context fact properties in action config" {
  write_context_template_manifest

  assert_boxfiles_bin
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ -f "$HOME/.config/boxfiles/context-template-hit" ]
}

@test "apply rejects unsafe without confirm" {
  write_failing_manifest

  assert_boxfiles_bin
  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply
  [ "$status" -ne 0 ]
  [[ "$output" == *"unsafe action requires --confirm"* ]] || echo "$output"
}
