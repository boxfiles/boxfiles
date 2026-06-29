#### BASE STAGE
#### Installs moon.

FROM docker.io/library/debian:bookworm-slim AS base
WORKDIR /repo

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl git jq xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Install moon binary
RUN curl -fsSL https://moonrepo.dev/install/moon.sh | bash
ENV PATH="/root/.moon/bin:/root/.proto/bin:$PATH"

#### SKELETON STAGE
#### Scaffolds repository skeleton structures.

FROM base AS skeleton

# Copy entire repository and scaffold
COPY . .
RUN moon docker scaffold repo

#### BUILD STAGE
#### Builds the project.

FROM base AS build

# Copy workspace configs
COPY --from=skeleton /repo/.moon/docker/configs .
COPY --from=skeleton /repo/.moon/docker/sources/.prototools .prototools

# Install toolchains and dependencies
RUN moon docker setup

# Copy project sources
COPY --from=skeleton /repo/.moon/docker/sources .
RUN "$(find /root/.proto/tools/proto -mindepth 2 -maxdepth 2 -type f -name proto | sort -V | tail -1)" install bats

# Build the CLI once before e2e tasks run.
RUN moon run cli:build

# Prune extraneous dependencies
RUN moon docker prune

#### TEST STAGE
#### Runs package-owned e2e tests.

FROM build AS test

ENTRYPOINT []
CMD ["moon", "run", ":e2e"]
