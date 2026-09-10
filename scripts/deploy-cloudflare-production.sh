#!/usr/bin/env bash
set -euo pipefail

WORKER_NAME="fama-system"
DB_NAME="fama-system-prod"
RUNTIME_DIR=".sites-runtime/cloudflare-production"
BOOT_CONFIG="${RUNTIME_DIR}/wrangler-bootstrap.jsonc"

mkdir -p "${RUNTIME_DIR}"

say(){ printf '\n==> %s\n' "$*"; }
fail(){ printf '\nERRO: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || fail "Node.js não encontrado."
command -v npm >/dev/null || fail "npm não encontrado."
command -v python3 >/dev/null || fail "python3 não encontrado."

say "Atualizando Wrangler"
npx --yes wrangler@latest --version

WHOAMI_OUTPUT="$(npx --yes wrangler@latest whoami 2>&1 || true)"
if printf '%s' "${WHOAMI_OUTPUT}" | grep -qiE 'not authenticated|please run.*wrangler login'; then
  say "Entre na sua conta Cloudflare. O terminal mostrará um link/código para autorizar."
  npx --yes wrangler@latest login --device
  WHOAMI_OUTPUT="$(npx --yes wrangler@latest whoami 2>&1 || true)"
fi

if printf '%s' "${WHOAMI_OUTPUT}" | grep -qiE 'not authenticated|please run.*wrangler login'; then
  printf '%s\n' "${WHOAMI_OUTPUT}" >&2
  fail "A autenticação Cloudflare ainda não foi concluída."
fi

say "Conta Cloudflare conectada"
printf '%s\n' "${WHOAMI_OUTPUT}"

cat > "${BOOT_CONFIG}" <<EOF
{
  "name": "${WORKER_NAME}",
  "compatibility_date": "2026-09-10",
  "observability": { "enabled": true }
}
EOF

get_db_id(){
  npx --yes wrangler@latest d1 list --json --config "${BOOT_CONFIG}" 2>/dev/null | \
  python3 -c 'import json,sys
name=sys.argv[1]
try:
    data=json.load(sys.stdin)
except Exception:
    sys.exit(0)
if isinstance(data,dict):
    data=data.get("result") or data.get("databases") or data.get("data") or []
if not isinstance(data,list):
    data=[]
for row in data:
    if isinstance(row,dict) and row.get("name")==name:
        print(row.get("uuid") or row.get("id") or row.get("database_id") or "")
        break' "${DB_NAME}"
}

DB_ID="$(get_db_id || true)"
if [[ -z "${DB_ID}" ]]; then
  say "Criando banco D1 de produção: ${DB_NAME}"
  npx --yes wrangler@latest d1 create "${DB_NAME}" --config "${BOOT_CONFIG}"
  sleep 2
  DB_ID="$(get_db_id || true)"
fi

[[ -n "${DB_ID}" ]] || fail "Não consegui localizar o ID do banco D1 após a criação."

say "Banco D1 pronto: ${DB_NAME}"

export CLOUDFLARE_WORKER_NAME="${WORKER_NAME}"
export CLOUDFLARE_D1_DATABASE_ID="${DB_ID}"
export CLOUDFLARE_D1_DATABASE_NAME="${DB_NAME}"

say "Instalando dependências"
npm install

say "Gerando build de produção"
npm run build

GENERATED_CONFIG=""
if [[ -f "dist/${WORKER_NAME}/wrangler.json" ]]; then
  GENERATED_CONFIG="dist/${WORKER_NAME}/wrangler.json"
elif [[ -f "dist/server/wrangler.json" ]]; then
  GENERATED_CONFIG="dist/server/wrangler.json"
else
  GENERATED_CONFIG="$(find dist -maxdepth 3 -type f -name wrangler.json -print | head -n 1 || true)"
fi

[[ -n "${GENERATED_CONFIG}" && -f "${GENERATED_CONFIG}" ]] || fail "Build concluído, mas o wrangler.json gerado não foi localizado."

say "Configuração gerada: ${GENERATED_CONFIG}"

has_table(){
  local table="$1"
  npx --yes wrangler@latest d1 execute DB \
    --remote \
    --config "${GENERATED_CONFIG}" \
    --command="SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';" \
    --json 2>/dev/null | grep -q "${table}"
}

if ! has_table "leads"; then
  say "Aplicando migração 0000"
  npx --yes wrangler@latest d1 execute DB --remote --config "${GENERATED_CONFIG}" --file="./drizzle/0000_crazy_nitro.sql" --yes
fi

if ! has_table "contracts"; then
  say "Aplicando migração 0001"
  npx --yes wrangler@latest d1 execute DB --remote --config "${GENERATED_CONFIG}" --file="./drizzle/0001_fresh_sugar_man.sql" --yes
fi

if ! has_table "organization_members"; then
  say "Aplicando migração 0002"
  npx --yes wrangler@latest d1 execute DB --remote --config "${GENERATED_CONFIG}" --file="./drizzle/0002_foamy_roland_deschain.sql" --yes
fi

say "Banco remoto validado"
npx --yes wrangler@latest d1 execute DB \
  --remote \
  --config "${GENERATED_CONFIG}" \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('organizations','organization_members') ORDER BY name;"

say "Publicando Worker"
npx --yes wrangler@latest deploy --config "${GENERATED_CONFIG}"

SESSION_SECRET=""
if [[ -f .env.local ]]; then
  SESSION_SECRET="$(sed -n 's/^FAMA_SESSION_SECRET=//p' .env.local | tail -n 1)"
fi

if [[ -z "${SESSION_SECRET}" ]]; then
  SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  printf '\nFAMA_SESSION_SECRET=%s\n' "${SESSION_SECRET}" >> .env.local
  chmod 600 .env.local 2>/dev/null || true
fi

say "Enviando FAMA_SESSION_SECRET de forma segura para o Cloudflare"
printf '%s' "${SESSION_SECRET}" | npx --yes wrangler@latest secret put FAMA_SESSION_SECRET --config "${GENERATED_CONFIG}"
unset SESSION_SECRET

say "Publicação concluída"
printf '\nFama System foi enviado ao Cloudflare Workers.\n'
printf 'Procure acima a URL terminada em .workers.dev e abra-a para testar o login.\n'
printf 'O banco usado é %s e o Worker é %s.\n' "${DB_NAME}" "${WORKER_NAME}"
