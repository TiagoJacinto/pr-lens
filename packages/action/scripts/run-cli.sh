#!/usr/bin/env bash
set -euo pipefail

ACTION_PATH="${ACTION_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ "${CLI_SOURCE:-npm}" == "workspace" ]]; then
  workspace_root="${ACTION_PATH}"
  if [[ ! -f "${workspace_root}/packages/cli/dist/bin.js" ]]; then
    workspace_root="$(cd "${ACTION_PATH}/../.." && pwd)"
  fi
  exec node "${workspace_root}/packages/cli/dist/bin.js" "$@"
fi

exec npx --yes "@coldtea/pr-lens-cli@${CLI_VERSION}" "$@"
