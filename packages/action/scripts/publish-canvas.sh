#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CANVAS_API:-}" ] || [ -z "${CANVAS_PUBLISH_TOKEN:-}" ]; then
  echo "canvas-url=" >> "${GITHUB_OUTPUT}"
  exit 0
fi

api="${CANVAS_API%/}"
minted="$(curl --fail --silent --show-error \
  -X POST "${api}/api/canvas/pr" \
  -H "authorization: Bearer ${CANVAS_PUBLISH_TOKEN}" \
  -H 'content-type: application/json' \
  --data "$(printf '{\"repository\":%s,\"pullRequest\":%s}' "$(node -p 'JSON.stringify(process.env.GITHUB_REPOSITORY)')" "${PR_NUMBER}")")"

readarray -t canvas < <(printf '%s' "${minted}" | node -e '
let body = "";
process.stdin.on("data", (chunk) => { body += chunk; });
process.stdin.on("end", () => {
  const value = JSON.parse(body);
  process.stdout.write(`${value.id}\n${value.writeToken}\n${value.rev}\n${value.viewUrl}\n`);
});
')

curl --fail --silent --show-error \
  -X PUT "${api}/api/canvas/${canvas[0]}" \
  -H "authorization: Bearer ${canvas[1]}" \
  -H "if-match: ${canvas[2]}" \
  -H 'content-type: application/json' \
  --data-binary "@${GRAPH}"

echo "canvas-url=${canvas[3]}" >> "${GITHUB_OUTPUT}"
