#!/usr/bin/env bats

load "/repo/pkgs/e2e-common/helpers.sh"

setup() {
  setup_empty_fixture
}

@test "run action requires confirm" {
  write_manifest "run.yaml" <<'EOF'
name: run
steps:
  - uses: run
    with:
      command: touch ~/.config/boxfiles/run-hit
EOF

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply

  [ "$status" -ne 0 ]
  assert_output_contains "unsafe action requires --confirm"
  [ ! -f "$HOME/.config/boxfiles/run-hit" ]
}

@test "run action stops on command failure" {
  write_manifest "run.yaml" <<'EOF'
name: run
steps:
  - uses: run
    with:
      command: "false"
  - uses: run
    with:
      command: touch ~/.config/boxfiles/after-failure
EOF

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -ne 0 ]
  assert_output_contains "run failed with exit code 1"
  [ ! -f "$HOME/.config/boxfiles/after-failure" ]
}

@test "run action check makes command idempotent" {
  mkdir -p "$HOME/.config/boxfiles"
  touch "$HOME/.config/boxfiles/already-done"
  write_manifest "run.yaml" <<'EOF'
name: run
steps:
  - uses: run
    with:
      check: test -f ~/.config/boxfiles/already-done
      command: touch ~/.config/boxfiles/should-not-run
EOF

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ ! -f "$HOME/.config/boxfiles/should-not-run" ]
}

@test "run action skips false when" {
  write_manifest "run.yaml" <<'EOF'
name: run
steps:
  - uses: run
    when: "false"
    with:
      command: touch ~/.config/boxfiles/skip-hit
EOF

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ ! -f "$HOME/.config/boxfiles/skip-hit" ]
}
