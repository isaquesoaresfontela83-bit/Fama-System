# Migração para JavaScript e Python

Escopo: Fama System e Fama Control. Foram convertidos 334 arquivos no System e 202 no Control. O código atual publicado foi usado como base, preservando os módulos operacionais, login e controles de acesso.

| Parte | Linguagem e execução |
| --- | --- |
| Telas e componentes React | JavaScript/JSX no navegador e Vinext |
| APIs, sessão, autorização e acesso aos dados | JavaScript no Worker |
| Integração generativa da Fama IA | Python no Worker `fama-ai-python` |
| Consultas determinísticas, formulários e modelos opcionais no dispositivo | JavaScript, junto ao sistema |

## Limite entre os serviços

As APIs existentes continuam verificando sessão, empresa, plano, módulos e limites de consultas. Os registros completos e as ações permanecem no servidor Fama. O adaptador `lib/fama-ai-cloudflare.js` envia somente a pergunta, até quatro perguntas anteriores e o resumo autorizado, para `/v1/generate` do serviço Python.

O Python monta o prompt, limita a saída e o tempo de execução, chama o modelo pelo binding Workers AI e rejeita números sem evidência, alegações de execução e respostas que repetem credenciais. O adaptador JavaScript faz uma segunda validação antes de apresentar a sugestão. Falhas, cancelamento e tempo esgotado preservam a resposta interna. O serviço não grava dados nem executa operações comerciais.

`GET /v1/status` verifica a configuração sem inferência. `POST /v1/connection-test` usa uma pergunta sintética, sem registros reais. Todos os endpoints exigem o segredo de serviço; não há credencial da IA no navegador.

## Configuração

Nos dois servidores JavaScript:

- `FAMA_AI_PYTHON_URL`: origem HTTPS do serviço, sem caminho, usuário, senha ou parâmetros.
- `FAMA_AI_PYTHON_TOKEN`: segredo de serviço com pelo menos 32 caracteres.
- `FAMA_AI_GENERATIVE_ENABLED=true`: habilita as sugestões generativas.
- `FAMA_AI_MODEL`, `FAMA_AI_MAX_TOKENS`, `FAMA_AI_TIMEOUT_MS`: configuração pública de estado e limites do adaptador.

No serviço Python, `FAMA_AI_SERVICE_TOKEN` recebe o mesmo segredo. Nunca coloque os valores reais no Git. A configuração `ai/wrangler.jsonc` declara o binding `AI`, o modelo e os limites. O SDK embutido é selecionado explicitamente por `disable_python_external_sdk`, permitindo a publicação direta dos módulos Python sem empacotar dependências externas. A configuração usa Python Workers com a data de compatibilidade 2026-10-16.

O modelo atual é Cloudflare Workers AI. Não é necessário usar uma conta ou API do ChatGPT para executar o modelo. Esta migração de linguagens preserva os serviços existentes de autenticação, dados e hospedagem; ela não representa uma troca desses provedores.

## Executar e verificar

```sh
npm ci
npm run check:js
npm test
python3 -m unittest discover -s ai -p 'test_*.py' -v
```

Para publicar o Python com a CLI oficial, use a configuração em `ai/` e um ambiente Cloudflare autenticado:

```sh
cd ai
uv sync --group cloudflare --locked
uv run pywrangler secret put FAMA_AI_SERVICE_TOKEN
uv run pywrangler deploy
```

Para um servidor próprio com Python, `ai/asgi.py` expõe o mesmo contrato ASGI. Instale o grupo `vps`, configure o segredo de serviço, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN` e `FAMA_AI_GENERATIVE_ENABLED=true`. Execute `uv run --group vps uvicorn asgi:app --app-dir ai --host 127.0.0.1 --port 8000` atrás do proxy HTTPS. Os pedidos ao provedor seguem um endereço fixo e recusam redirecionamentos.

Os lockfiles JavaScript e Python devem permanecer versionados. Os bancos e suas migrações não foram recriados durante a conversão. A variante Control usa seu próprio checkout e testes; as duas interfaces consultam o mesmo serviço Python.

## Análise estática

O lint valida JavaScript e JSX. Os diagnósticos do compilador React sobre efeitos e refs que já existiam nas telas convertidas permanecem visíveis como avisos, restritos aos arquivos legados. Esta conversão não inclui uma reformulação do ciclo de efeitos React.
