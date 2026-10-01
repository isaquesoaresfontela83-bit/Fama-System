# Fama Platform

Repositório unificado do **Fama System** e **Fama Control**, com o banco compartilhado, configurações e documentação de desenvolvimento.

Código completo no [GitHub — Fama-System](https://github.com/isaquesoaresfontela83-bit/Fama-System/tree/chore/fama-platform-monorepo). A organização está na branch `chore/fama-platform-monorepo`; veja [como clonar e contribuir](docs/REPOSITORIO.md).

Esta organização preserva os 412 arquivos originais da entrega: System versão 99 e Control versão 37. O mapeamento de caminhos e os hashes ficam em [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json).

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| [`apps/fama-system/`](apps/fama-system/) | Sistema operacional: frontend, APIs, autenticação, regras de negócio, integrações, assets e testes. |
| [`apps/fama-control/`](apps/fama-control/) | Administração: frontend, APIs, empresas, usuários, funções, permissões, cobrança opcional, auditoria e testes. |
| [`database/supabase/`](database/supabase/) | Estrutura compartilhada: 49 tabelas, 31 funções, 77 triggers, políticas, storage e agendamentos. |
| [`config/env/`](config/env/) | Modelos de configuração dos dois servidores. |
| [`docs/`](docs/) | Instalação, arquitetura, banco, configuração, publicação e APIs. |
| [`scripts/`](scripts/) | Preparação local, comandos dos projetos, verificação, exportação e preparação para Cloudflare. |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Verificação da estrutura, TypeScript, compilação e testes das aplicações no GitHub. |
| [`archive/`](archive/) | Artefatos históricos separados dos códigos ativos. |

Dentro de cada aplicação, a interface fica em `app/`, `components/`, `hooks/` e `public/`; o backend HTTP fica em `app/api/`, `lib/` e `worker/`. As migrações históricas e os lockfiles permanecem junto da aplicação que os utiliza.

## Começar

Requisitos: Linux ou WSL2, Node.js 22.13 ou superior, npm e um Supabase de desenvolvimento. As credenciais são configuradas no próprio ambiente.

```bash
npm run verify
npm run setup
npm run install:apps
```

`setup` copia os modelos locais sem sobrescrever configurações existentes. Preencha os arquivos criados e prepare o banco seguindo [docs/BANCO.md](docs/BANCO.md).

Abra um terminal para cada aplicação:

```bash
npm run dev:system
```

```bash
npm run dev:control
```

As portas padrão são 5173 e 5174. Para configurar os endereços de comunicação entre os sistemas, siga [docs/DOMINIOS-E-PROPRIETARIO.md](docs/DOMINIOS-E-PROPRIETARIO.md).

## Comandos pela raiz

| Comando | Resultado |
| --- | --- |
| `npm run setup` | Cria configurações locais a partir dos modelos. |
| `npm run install:apps` | Instala cada aplicação usando seu lockfile original. |
| `npm run dev:system` | Inicia o Fama System. |
| `npm run dev:control` | Inicia o Fama Control. |
| `npm run typecheck` | Verifica TypeScript nas duas aplicações. |
| `npm run build` | Compila as duas aplicações. |
| `npm test` | Compila e executa os testes existentes de ambas. |
| `npm run lint` | Executa as verificações de código existentes. |
| `npm run test:control:localhost` | Executa o teste HTTP local do Control. |
| `npm run verify` | Confere estrutura, configurações versionadas e links da documentação. |
| `npm run verify:source` | Também compara os 412 arquivos com a entrega de origem. |
| `npm run package` | Exporta os arquivos versionados e o identificador do commit para `artifacts/`. |

Selecione uma aplicação quando necessário:

```bash
npm run build -- --app system
npm test -- --app control
```

As instalações ficam independentes para preservar os scripts e a resolução de dependências originais. A raiz não possui dependências adicionais de execução.

## Documentação

Comece pelo [índice da documentação](docs/INDEX.md). Para contribuir, leia [CONTRIBUTING.md](CONTRIBUTING.md); para usar Git e enviar ao GitHub, veja [docs/REPOSITORIO.md](docs/REPOSITORIO.md).

## Empresas de teste

O Control inclui **Empresas e usuários** para criar empresas com nome, e-mail e senha, cadastrar e editar usuários e suas permissões. Empresas criadas administrativamente começam gratuitas, sem bloqueio por vencimento. A cobrança mensal e o bloqueio dependem da ativação explícita no Control.

## Origem e configuração

| Aplicação | Versão de origem | Commit original |
| --- | --- | --- |
| Fama System | 99 | `34a4c728d8223db9ef8974e97e6125229d611d3f` |
| Fama Control | 37 | `2720a0c2a2930e9b3426324100de2e3d90243623` |

Os arquivos de hospedagem conservam os identificadores dos projetos atuais. A publicação de uma cópia exige recursos próprios e revisão dos domínios e do proprietário, conforme [docs/PUBLICACAO.md](docs/PUBLICACAO.md).

O repositório inclui modelos de configuração. Chaves, senhas, sessões, contas de autenticação e registros reais de produção não fazem parte da entrega. O relatório original e os metadados estão em [docs/provenance/](docs/provenance/).
