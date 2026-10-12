# Fama System

ERP multiempresa para negócios de piscinas, com CRM, clientes, orçamentos e contratos em PDF, agenda, ordens de serviço, garantias, estoque, financeiro e equipe.

Este guia descreve a base presente neste repositório. Uma versão publicada pode usar outra revisão; confira a origem do código antes de implantar. O frontend independente do Fama Control não está completo nesta `main`: aqui existem funções de backend e materiais históricos relacionados a ele.

## Começar

Requer Node.js 22.13 ou superior. As dependências são registradas em `package-lock.json`.

```sh
npm ci
npm run dev
```

Use [.env.example](.env.example) para identificar as configurações e forneça os valores reais no ambiente de execução.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Ambiente local com Vite |
| `npm run build` | Compilação verificada, com limite de tempo |
| `npm test` | Compilação e testes existentes |
| `npm run lint` | Análise estática |
| `npm run db:generate` | Geração de migrações Drizzle |
| `npm run install:ci` | Instalador auxiliar do ambiente Sites |

## Arquitetura desta base

| Parte | Implementação |
| --- | --- |
| Interface e APIs | React, Next/Vinext e Vite |
| Login | Supabase Auth por e-mail e senha |
| Sessão da aplicação | Cookie `fama_session` com assinatura em [lib/fama-session.ts](lib/fama-session.ts) |
| Dados operacionais | Cloudflare D1 com esquema Drizzle |
| Isolamento entre empresas | Associação e perfil verificados em [lib/tenant.ts](lib/tenant.ts) |
| Hospedagem | Worker Cloudflare e configuração Sites |

Os dados operacionais e a autenticação usam serviços diferentes. Preserve ambos ao organizar o projeto.

O nome de [app/chatgpt-auth.ts](app/chatgpt-auth.ts) foi mantido por compatibilidade: a implementação desta revisão lê a sessão própria `fama_session`. Ele não representa um requisito de conta ChatGPT para o usuário.

Nesta `main`, o endpoint de login ainda contém a URL e a chave publicável do Supabase. A proposta que transfere esses valores para variáveis de ambiente está em revisão separada e exige configurar o ambiente antes de integrar.

## Mapa do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `app/` | Telas e rotas de API |
| `components/` e `hooks/` | Componentes e comportamento reutilizáveis |
| `lib/` | Sessão, autorização, banco e documentos PDF |
| `db/` e `drizzle/` | Esquema e migrações D1 |
| `worker/` | Entrada do Worker |
| `scripts/` | Instalação, compilação e ferramentas de publicação |
| `tests/` | Testes existentes |
| `public/` | Imagens e ícones |
| `build/` | Código-fonte do plugin de compilação; deve continuar no Git |
| `vendor/` | CSS de terceiros e sua licença; importado pela aplicação |
| `supabase/functions/` | Funções de backend relacionadas ao Fama Control |
| `sites-release/` | Material histórico de publicação e compatibilidade |
| `docs/` | Guia de manutenção do repositório |

`dist/`, caches, cobertura, logs e configurações locais são ignorados. Os lockfiles, migrações, plugins de compilação e licenças de terceiros são preservados.

## Manutenção

Leia [CONTRIBUTING.md](CONTRIBUTING.md) para o fluxo de alterações, [docs/REPOSITORY.md](docs/REPOSITORY.md) para detalhes da estrutura e [SECURITY.md](SECURITY.md) para relatos privados de segurança.

As instruções em [sites-release/README.md](sites-release/README.md) são históricas. Não use seu fluxo antigo de login como instrução da revisão atual.

## Direitos

Projeto proprietário de Isaque Soares Fontela. Consulte [LICENSE](LICENSE). Dependências de terceiros mantêm suas próprias licenças.
