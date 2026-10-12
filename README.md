# Fama System

Plataforma SaaS multiempresa para gestão de empresas de piscinas. Reúne CRM, orçamentos e contratos em PDF, agenda, ordens de serviço, garantias, clientes e piscinas, estoque, financeiro, equipe e controle de usuários.

## Arquitetura atual

O repositório usa uma arquitetura híbrida:

- **Supabase Auth** para autenticação por e-mail e senha.
- **Sessão própria assinada** (`fama_session`) para manter a identidade autenticada no Fama System.
- **Cloudflare D1 + Drizzle ORM** para os dados operacionais e multiempresa.
- **Next/Vinext + Vite + Cloudflare** para aplicação e publicação.

A autenticação e o banco operacional têm responsabilidades diferentes. Não remova Supabase ou D1 sem uma migração planejada.

## Multiempresa e segurança

- Cada empresa possui um `organization_id` próprio nos registros operacionais.
- As APIs protegidas devem validar no servidor identidade, empresa, participação do usuário e perfil necessário.
- `lib/tenant.ts` é a fronteira central de autorização multiempresa e deve falhar de forma fechada.
- O cliente pode informar a organização ativa, mas nenhuma API deve confiar nesse identificador sem validar a associação do usuário.
- Alterações de autenticação, sessão, permissões ou tenant exigem testes antes da publicação.

## Perfis de acesso

- `owner`: proprietário da empresa; administra usuários e registros.
- `admin`: administra usuários permitidos e registros.
- `member`: utiliza módulos operacionais autorizados.
- `technician`: utiliza os módulos operacionais como técnico.

## Estrutura principal

- `app/`: interface e rotas de API.
- `components/`: componentes reutilizáveis.
- `hooks/`: hooks compartilhados.
- `lib/`: serviços e utilitários do servidor, incluindo sessão e isolamento multiempresa.
- `db/schema.ts`: modelo do banco D1.
- `drizzle/`: migrações versionadas.
- `tests/`: testes automatizados.
- `scripts/`: scripts de instalação, build e suporte.
- `public/`: recursos estáticos.
- `build/`: **código-fonte auxiliar de build**; atualmente contém `sites-vite-plugin.ts` e não deve ser tratado como artefato descartável.
- `vendor/`: dependências/recursos locais ainda referenciados pela aplicação; revisar antes de remover.
- `sites-release/`: materiais de release/compatibilidade; manter até a cadeia de publicação ser consolidada.
- `.openai/hosting.json`: configuração de hosting/bindings usada pelo projeto.

Artefatos realmente gerados, como `dist/`, `.next/`, `out/`, cobertura e estado local do Wrangler, ficam fora do Git.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Comandos principais:

- `npm run dev`: ambiente local.
- `npm run build`: build verificado de produção.
- `npm run db:generate`: gera migração a partir de `db/schema.ts`.
- `npm run lint`: análise estática.
- `npm test`: build + testes automatizados existentes.

## Configuração

Use `.env.example` como inventário de configuração. Valores reais devem existir somente no ambiente local ou na plataforma de hospedagem.

Configurações relevantes incluem:

- `PLATFORM_OWNER_EMAIL`: administrador da plataforma.
- `FAMA_SESSION_SECRET`: segredo de assinatura da sessão; obrigatório, aleatório e com no mínimo 32 caracteres.
- `SUPABASE_URL`: URL do projeto usado para autenticação.
- `SUPABASE_PUBLISHABLE_KEY`: chave publicável do Supabase Auth.
- variáveis `CLOUDFLARE_*`: overrides locais/de implantação quando necessários.

Nunca versionar senhas, service-role keys, tokens privados ou segredos de produção.

## Banco e migrações

Os dados operacionais usam Cloudflare D1 com Drizzle. Mudanças em `db/schema.ts` devem gerar uma migração versionada em `drizzle/`. As migrações precisam ser aplicadas de forma controlada antes de código que dependa do novo esquema receber tráfego.

## Checklist antes de publicar

1. `npm run lint`
2. `npm test`
3. confirmar variáveis obrigatórias no ambiente
4. revisar migrações D1 pendentes
5. validar login e logout
6. validar isolamento entre duas organizações diferentes
7. validar permissões `owner`, `admin`, `member` e `technician`
8. testar fluxos financeiros críticos quando houver alterações nesse módulo
9. verificar que nenhum segredo foi incluído no diff

## Política de mudanças críticas

Mudanças em autenticação, `lib/tenant.ts`, sessão, financeiro, migrações ou permissões devem passar por branch e pull request. Evite alterações destrutivas diretamente na `main`.

## Licença

O Fama System é software proprietário. Consulte `LICENSE`. A visibilidade do código em um repositório público não concede autorização para copiar, redistribuir, modificar ou comercializar o projeto.
