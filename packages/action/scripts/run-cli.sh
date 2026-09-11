#!/usr/bin/env bash
set -euo pipefail

ACTION_PATH="${ACTION_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ "${CLI_SOURCE:-npm}" == "workspace" ]]; then
  exec node "${ACTION_PATH}/packages/cli/dist/bin.js" "$@"
fi

exec npx --yes "@coldtea/pr-lens-cli@${CLI_VERSION}" "$@"
