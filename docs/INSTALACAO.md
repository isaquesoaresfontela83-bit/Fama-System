# Instalação e desenvolvimento

## Requisitos

- Linux ou WSL2. Os scripts originais usam Bash e utilitários Linux, como `timeout`, `flock`, `curl` e `sha256sum`.
- Node.js 22.13 ou superior e npm.
- Acesso à rede para baixar as dependências.
- Um projeto Supabase separado para desenvolvimento, com Auth habilitado.

Mantenha `package-lock.json`, `vendor/` e os scripts originais. O lockfile registra as versões exatas usadas; não é necessário atualizá-las para iniciar.

## Preparar o banco e as credenciais

Siga `BANCO.md` antes de testar operações. Copie os modelos para dentro de cada projeto:

```bash
cp config/env/fama-system.dev.vars.example apps/fama-system/.dev.vars
cp config/env/fama-control.dev.vars.example apps/fama-control/.dev.vars
```

Edite os dois arquivos com os valores do seu ambiente. Eles são arquivos de configuração; não execute `source` neles. O `.gitignore` da raiz já exclui `.dev.vars*` e os arquivos de ambiente locais, mantendo os modelos `.example`. Os `.env.example` originais também estão preservados, mas os modelos em `config/` abrangem mais variáveis do ambiente atual.

Use `DATA_BACKEND="supabase"` para o conjunto atual de recursos de criação administrativa de empresas. O fallback D1 foi preservado, mas não substitui Supabase Auth nem todas as funções administrativas do PostgreSQL.

## Fama Control

Em um terminal:

```bash
cd apps/fama-control
npm ci
npm run typecheck
npm run dev -- --host 127.0.0.1 --port 5174
```

## Fama System

Em outro terminal, a partir da pasta principal:

```bash
cd apps/fama-system
npm ci
npm run typecheck
npm run dev -- --host 127.0.0.1 --port 5173
```

Use o endereço informado pelo Vite no terminal. Mantenha o domínio de desenvolvimento estável. A autenticação usa cookies `HttpOnly`, `Secure` e nomes com prefixo `__Host-`; se o seu navegador ou host de desenvolvimento recusar esses cookies, utilize HTTPS local ou um ambiente de homologação com HTTPS. Não remova esses controles da versão de produção para contornar a configuração local.

O fluxo atual utiliza chamadas fixas entre os domínios publicados. Para a cópia se comunicar exclusivamente com os seus ambientes, ajuste os pontos listados em `DOMINIOS-E-PROPRIETARIO.md`. A comunicação entre os servidores deve usar a mesma `FAMA_DATA_BRIDGE_SECRET`.

## Compilar e testar

Execute dentro de cada projeto:

```bash
npm run build
npm run typecheck
npm test
```

`npm test` já executa o build; não é necessário rodar os dois comandos consecutivamente quando a intenção é apenas executar a suíte completa. O build produz `dist/server/` e `dist/client/` e exige `timeout`. O script `npm run install:ci` é uma alternativa para instalação controlada em Linux; seus requisitos estão no próprio script.

O Control também possui:

```bash
npm run test:localhost
```

Os testes usam fixtures e serviços simulados. Mantenha credenciais de produção fora do ambiente de testes. Alguns testes verificam endereços específicos da versão entregue; atualize suas expectativas ao alterar esses endereços.

`npm run start` executa o ambiente Vinext preparado após a compilação. Para publicar, use `PUBLICACAO.md`; a aplicação requer recursos do runtime Cloudflare, incluindo o módulo `cloudflare:workers` e bindings.

## Primeiro acesso

Crie no Supabase Auth o usuário que administrará a cópia ou use a opção de criar acesso do Control quando a confirmação de e-mail estiver corretamente configurada. Configure o e-mail em `PLATFORM_OWNER_EMAIL` e o UUID do usuário em `PLATFORM_OWNER_USER_ID`. Confirme o e-mail do usuário conforme a política do seu ambiente e registre o administrador SQL conforme `BANCO.md`.

Entre no Control e crie uma empresa descartável em **Empresas e usuários**. Entre no System com o e-mail e a senha definidos para o responsável. Não ative as opções de cobrança e bloqueio por vencimento para uma empresa que deve continuar gratuita.
