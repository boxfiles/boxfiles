FROM ghcr.io/jdx/mise:latest AS build
WORKDIR /repo

COPY package.json bun.lockb* moon.yml ./
COPY apps/cli/moon.yml apps/cli/moon.yml
COPY pkgs/config/moon.yml pkgs/config/moon.yml
COPY pkgs/core/moon.yml pkgs/core/moon.yml
COPY pkgs/diagnostics/moon.yml pkgs/diagnostics/moon.yml
COPY pkgs/provider-copy/moon.yml pkgs/provider-copy/moon.yml
COPY pkgs/provider-gpu/moon.yml pkgs/provider-gpu/moon.yml
COPY pkgs/provider-link/moon.yml pkgs/provider-link/moon.yml
COPY pkgs/provider-network/moon.yml pkgs/provider-network/moon.yml
COPY pkgs/provider-os/moon.yml pkgs/provider-os/moon.yml
COPY pkgs/provider-ownership/moon.yml pkgs/provider-ownership/moon.yml
COPY pkgs/provider-packages/moon.yml pkgs/provider-packages/moon.yml
COPY pkgs/provider-permissions/moon.yml pkgs/provider-permissions/moon.yml
COPY pkgs/provider-remove/moon.yml pkgs/provider-remove/moon.yml
COPY pkgs/provider-rename/moon.yml pkgs/provider-rename/moon.yml
COPY pkgs/provider-run/moon.yml pkgs/provider-run/moon.yml
COPY pkgs/provider-user/moon.yml pkgs/provider-user/moon.yml
COPY . .
RUN mise install && mise use -g bun && bunx --package @moonrepo/cli moon run cli:build

FROM ghcr.io/jdx/mise:latest AS test
WORKDIR /repo
COPY --from=build /repo /repo
RUN mise use -g bats bun && printf '%s\n' '#!/usr/bin/env sh' 'exec bunx --package @moonrepo/cli moon "$@"' > /usr/local/bin/moon && chmod +x /usr/local/bin/moon
ENV PATH="/usr/local/bin:/mise/shims:/usr/local/cargo/bin:/usr/local/sbin:/usr/bin:/sbin:/bin"
ENTRYPOINT []

CMD ["moon", "run", ":e2e"]
