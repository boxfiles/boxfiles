#!/usr/bin/env bats

load "/repo/pkgs/e2e-common/helpers.sh"

setup() {
  setup_demo_fixture
  mkdir -p "$DEMO_FIXTURE_ROOT/files"
}

write_link_manifest() {
  write_manifest "link-test.yaml" <<'EOF'
name: link-test
steps:
  - uses: symlink
    with:
      from: source.txt
      to: ~/.config/boxfiles/linked.txt
EOF
}

@test "symlink creates parent dirs and target link" {
  printf 'linked\n' > "$DEMO_FIXTURE_ROOT/files/source.txt"
  write_link_manifest

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ -L "$HOME/.config/boxfiles/linked.txt" ]
  run readlink "$HOME/.config/boxfiles/linked.txt"
  [ "$status" -eq 0 ]
  [[ "$output" == "$DEMO_FIXTURE_ROOT/files/source.txt" ]]
}

@test "symlink existing target is left unchanged" {
  mkdir -p "$HOME/.config/boxfiles"
  printf 'existing\n' > "$HOME/.config/boxfiles/linked.txt"
  printf 'linked\n' > "$DEMO_FIXTURE_ROOT/files/source.txt"
  write_link_manifest

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ ! -L "$HOME/.config/boxfiles/linked.txt" ]
  assert_file_contains "$HOME/.config/boxfiles/linked.txt" "existing"
}
