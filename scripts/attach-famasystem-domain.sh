#!/usr/bin/env bash
set -euo pipefail

WORKER_NAME="fama-system"
DB_NAME="fama-system-prod"
DOMAIN_ROOT="famasystem.online"
DOMAIN_WWW="www.famasystem.online"
RUNTIME_DIR=".sites-runtime/cloudflare-domain"
BOOT_CONFIG="${RUNTIME_DIR}/wrangler-bootstrap.jsonc"
mkdir -p "${RUNTIME_DIR}"

say(){ printf '\n==> %s\n' "$*"; }
fail(){ printf '\nERRO: %s\n' "$*" >&2; exit 1; }

WHOAMI="$(npx --yes wrangler@latest whoami 2>&1 || true)"
if printf '%s' "$WHOAMI" | grep -qiE 'not authenticated|please run.*wrangler login'; then
  fail "Wrangler não está autenticado. Rode: npx --yes wrangler@latest login --device"
fi

cat > "${BOOT_CONFIG}" <<EOF
{
  "name": "${WORKER_NAME}",
  "compatibility_date": "2026-09-10"
}
EOF

DB_ID="$(npx --yes wrangler@latest d1 list --json --config "${BOOT_CONFIG}" 2>/dev/null | python3 -c 'import json,sys
name=sys.argv[1]
try:data=json.load(sys.stdin)
except Exception: data=[]
if isinstance(data,dict): data=data.get("result") or data.get("databases") or data.get("data") or []
for row in data if isinstance(data,list) else []:
    if isinstance(row,dict) and row.get("name")==name:
        print(row.get("uuid") or row.get("id") or row.get("database_id") or "")
        break' "${DB_NAME}")"
[[ -n "$DB_ID" ]] || fail "Banco ${DB_NAME} não localizado na conta Cloudflare."

export CLOUDFLARE_WORKER_NAME="${WORKER_NAME}"
export CLOUDFLARE_D1_DATABASE_ID="${DB_ID}"
export CLOUDFLARE_D1_DATABASE_NAME="${DB_NAME}"

say "Gerando build atual"
npm install
npm run build

GENERATED_CONFIG=""
if [[ -f "dist/${WORKER_NAME}/wrangler.json" ]]; then
  GENERATED_CONFIG="dist/${WORKER_NAME}/wrangler.json"
elif [[ -f "dist/server/wrangler.json" ]]; then
  GENERATED_CONFIG="dist/server/wrangler.json"
else
  GENERATED_CONFIG="$(find dist -maxdepth 3 -type f -name wrangler.json -print | head -n 1 || true)"
fi
[[ -n "$GENERATED_CONFIG" && -f "$GENERATED_CONFIG" ]] || fail "wrangler.json gerado não encontrado."

python3 - "$GENERATED_CONFIG" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1]); d=json.loads(p.read_text()); d.pop("legacy_env",None); p.write_text(json.dumps(d,indent=2)+"\n")
PY

say "Associando domínios ao Worker"
npx --yes wrangler@latest deploy \
  --config "$GENERATED_CONFIG" \
  --domain "$DOMAIN_ROOT" \
  --domain "$DOMAIN_WWW"

say "Domínios solicitados"
printf '%s\n%s\n' "https://${DOMAIN_ROOT}" "https://${DOMAIN_WWW}"
printf '\nSe o comando falhar dizendo que a zona não está ativa ou que existe CNAME conflitante, ative primeiro a zona no Cloudflare e remova apenas o registro conflitante desses hostnames.\n'
