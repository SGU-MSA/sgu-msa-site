#!/usr/bin/env bash
# Prefer this project's owner login when present; never copy global credentials.
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"
if [[ -f "$repo_root/.agents/local/github/hosts.yml" ]]; then
  export GH_CONFIG_DIR="$repo_root/.agents/local/github"
fi
exec gh "$@"
