# @boxfiles/provider-network

Network context provider placeholder for Boxfiles.

This package reserves the `network` plugin capability for future workstation facts about network configuration and connectivity.

Expected future facts may include hostname, active interfaces, VPN or private-network availability, and DNS-related setup hints.

## Status

No actions or context resolvers are implemented yet. The package currently registers an empty `network` plugin so manifests and package boundaries can stabilize before implementation.
