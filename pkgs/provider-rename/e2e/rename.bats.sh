#!/usr/bin/env bats

load "/repo/pkgs/e2e-common/helpers.sh"

setup() {
  setup_empty_fixture
}

@test "rename moves a workstation file" {
  mkdir -p "$HOME/.config/boxfiles"
  printf 'renamed\n' > "$HOME/.config/boxfiles/source.txt"

  write_manifest "rename.yaml" <<'EOF'
name: rename-test
steps:
  - uses: rename
    with:
      from: ~/.config/boxfiles/source.txt
      to: ~/.local/share/boxfiles/target.txt
EOF

  run "$BOXFILES_BIN" --dir "$DEMO_FIXTURE_ROOT" apply --confirm

  [ "$status" -eq 0 ]
  [ ! -e "$HOME/.config/boxfiles/source.txt" ]
  assert_file_contains "$HOME/.local/share/boxfiles/target.txt" "renamed"
}
