#!/usr/bin/env bash
set -euo pipefail

WORKER_NAME="fama-control"

say(){ printf '\n==> %s\n' "$*"; }
fail(){ printf '\nERRO: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || fail "Node.js não encontrado."
command -v npm >/dev/null || fail "npm não encontrado."
command -v python3 >/dev/null || fail "python3 não encontrado."

say "Atualizando Wrangler"
npx --yes wrangler@latest --version

if ! npx --yes wrangler@latest whoami >/dev/null 2>&1; then
  say "Entre na sua conta Cloudflare. O terminal mostrará um link/código para autorizar."
  npx --yes wrangler@latest login --device
fi

say "Conta Cloudflare conectada"
npx --yes wrangler@latest whoami

export CLOUDFLARE_WORKER_NAME="${WORKER_NAME}"

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

# Wrangler 4.131+ removeu suporte ao campo legacy_env.
# O build do Vinext ainda pode gerar esse campo, então removemos apenas
# essa chave obsoleta antes do deploy, sem alterar as demais bindings.
python3 - "${GENERATED_CONFIG}" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    config = json.load(fh)

config.pop("legacy_env", None)

with open(path, "w", encoding="utf-8") as fh:
    json.dump(config, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
PY

SESSION_SECRET=""
if [[ -f .env.local ]]; then
  SESSION_SECRET="$(sed -n 's/^FAMA_SESSION_SECRET=//p' .env.local | tail -n 1)"
fi

if [[ -z "${SESSION_SECRET}" ]]; then
  SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  printf '\nFAMA_SESSION_SECRET=%s\n' "${SESSION_SECRET}" >> .env.local
  chmod 600 .env.local 2>/dev/null || true
fi

say "Publicando Worker"
npx --yes wrangler@latest deploy --config "${GENERATED_CONFIG}"

say "Enviando segredo de sessão de forma segura"
printf '%s' "${SESSION_SECRET}" | npx --yes wrangler@latest secret put FAMA_SESSION_SECRET --config "${GENERATED_CONFIG}"
unset SESSION_SECRET

say "Publicação concluída"
printf '\nFama Control foi enviado ao Cloudflare Workers.\n'
printf 'Procure acima a URL terminada em .workers.dev e abra-a para testar o login.\n'
printf 'Worker: %s\n' "${WORKER_NAME}"
