# Fama System + Fama Control — entrega completa

Este pacote entrega o código editável dos dois sistemas, exatamente nas versões publicadas conferidas em 01/10/2026, e a estrutura atual do banco compartilhado.

| Projeto | Versão | Commit | Arquivos originais |
| --- | --- | --- | --- |
| Fama System | 99 | `34a4c728d8223db9ef8974e97e6125229d611d3f` | 236 |
| Fama Control | 37 | `2720a0c2a2930e9b3426324100de2e3d90243623` | 176 |

Os 412 arquivos versionados foram copiados integralmente, sem alteração dos códigos. O manifesto contém o SHA-256 de cada um e os identificadores de origem. `SHA256SUMS.txt` também permite conferir os arquivos adicionais desta entrega.

## Conteúdo

| Pasta ou arquivo | O que contém |
| --- | --- |
| `fama-system/` | Frontend, APIs, regras de negócio, autenticação, módulos operacionais, PDFs, integrações, assets, testes e dependências declaradas. |
| `fama-control/` | Frontend administrativo, APIs, gestão de empresas e usuários, funções e permissões, cobrança opcional, bloqueios, auditoria, backups e validação de acesso. |
| `banco-de-dados/` | Snapshot da estrutura em uso: 49 tabelas, 31 funções, 77 triggers, 125 políticas RLS de aplicação, índices, constraints e permissões. Inclui dois buckets, quatro políticas de storage e quatro agendamentos. |
| `configuracao/` | Modelos de variáveis locais, inventário de nomes de configuração e auxiliar de publicação fora do Sites. |
| `documentacao/` | Instalação, banco, configuração, publicação, APIs, domínios e relatório de conferência. |
| `MANIFESTO.json` | Proveniência das versões e hashes dos códigos originais. |
| `SHA256SUMS.txt` | Integridade dos arquivos desta entrega. |

## Onde estão frontend e backend

Cada projeto usa React 19, TypeScript, Next/Vinext e Vite. O frontend fica em `app/`, `components/`, `hooks/` e `public/`. O backend HTTP fica em `app/api/`; regras e integrações ficam em `lib/`; `worker/index.ts` é a entrada do Cloudflare Worker. A lógica que roda no PostgreSQL está nos arquivos SQL, inclusive no snapshot atual.

Frontend e backend pertencem ao mesmo projeto. Não existe um servidor Express separado nem um executável `backend.exe`. O ambiente de produção usa Cloudflare Workers e Supabase por HTTPS. `db/` e `drizzle/` preservam a estrutura auxiliar/legada D1.

As migrações históricas, os scripts de build, os lockfiles e os arquivos de fornecedor em `vendor/` estão incluídos. A instalação das dependências é reproduzida a partir de `package-lock.json`; a pasta `node_modules` não faz parte da entrega.

## Começar

1. Leia `documentacao/INSTALACAO.md` e prepare Linux ou WSL2 com Node.js 22.13 ou superior.
2. Prepare um projeto Supabase de desenvolvimento seguindo `documentacao/BANCO.md`.
3. Preencha os modelos em `configuracao/`, com as suas próprias credenciais.
4. Confira os domínios e o proprietário em `documentacao/DOMINIOS-E-PROPRIETARIO.md`.
5. Execute cada projeto e, para publicar uma cópia, siga `documentacao/PUBLICACAO.md`.

## Empresas de teste sem mensalidade

No Fama Control, a área **Empresas e usuários** permite criar uma empresa com nome, e-mail e senha, cadastrar e editar os usuários, atribuir `owner`, `admin`, `member` ou `technician`, selecionar permissões dos módulos e ativar/desativar acessos.

Empresas criadas por essa área começam com cobrança desativada e sem bloqueio por vencimento. A cobrança mensal e o bloqueio por vencimento dependem da ativação explícita das opções no Control. O bloqueio manual da empresa é um controle independente. O cadastro público do Fama System possui fluxo de teste próprio; não confunda esse fluxo com a criação administrativa gratuita por tempo indeterminado.

O Control também inclui **Validar acesso gratuito**, que cria registros descartáveis para conferir o acesso real, permissões, gratuidade e bloqueios, e oferece limpeza dos registros criados. Ao montar uma cópia independente, ajuste primeiro o domínio alvo desse diagnóstico.

## Configuração e dados externos

O pacote contém os códigos, a estrutura do banco e os modelos necessários para configuração. Senhas, tokens, chaves reais, sessões de login e segredos do Vault não são exportados. O inventário mostra os nomes das variáveis e omite seus valores sensíveis.

Os registros reais das empresas, contas do Supabase Auth e arquivos enviados ao Storage são dados de produção e não estão neste pacote de código. Uma mudança que preserve esses registros exige um backup separado e as chaves de criptografia originais, obtidas pelos responsáveis pelas contas. O ZIP também não transfere a titularidade do domínio, da hospedagem, do Supabase ou das contas Asaas/Meta/OpenAI.

Para uma instalação de teste nova, crie contas e dados novos; nenhum backup de clientes é necessário. O recebimento de Pix real e a emissão fiscal real dependem dos provedores e não foram comprovados pela conferência deste pacote.

## Conferência

Consulte `documentacao/CONFERENCIA.md`. A entrega verifica correspondência de código, hashes, integridade do ZIP e sintaxe SQL. Ela preserva a implementação atual; não representa uma nova homologação completa de todos os módulos ou de integrações externas.

O arquivo `.site-deploy.tar.gz`, presente no repositório original do System, foi preservado por fazer parte dos arquivos versionados. Ele é um artefato histórico e não substitui um novo build das fontes entregues.
