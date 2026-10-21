#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

echo "Running bounded vinext build..."
SITES_VITE_BUILD_CACHE="$(mktemp -d "${SITES_PROJECT_ROOT}/.sites-runtime/vite-build.XXXXXXXX")"
export SITES_VITE_BUILD_CACHE
node "${SITES_PROJECT_ROOT}/scripts/prepare-local-ai.mjs"
node "${SITES_PROJECT_ROOT}/scripts/prepare-barcode-runtime.mjs"
node "${SITES_PROJECT_ROOT}/scripts/prepare-fcm-worker.mjs"
node "${SITES_PROJECT_ROOT}/scripts/preserve-client-assets.mjs" capture
node "${SITES_PROJECT_ROOT}/scripts/prepare-clean-build.mjs"
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build
node "${SITES_PROJECT_ROOT}/scripts/finalize-local-ai.mjs"
node "${SITES_PROJECT_ROOT}/scripts/preserve-client-assets.mjs" restore
node "${SITES_PROJECT_ROOT}/scripts/compress-runtime-assets.mjs"
node "${SITES_PROJECT_ROOT}/scripts/verify-plan-build.mjs"

node "${SITES_PROJECT_ROOT}/scripts/verify-release-assets.mjs"
