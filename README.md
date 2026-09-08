# Fama System

Plataforma SaaS multiempresa para gestão de negócios de piscinas. Reúne CRM, orçamentos e contratos em PDF, agenda, ordens de serviço, garantias, clientes e piscinas, estoque, financeiro, equipe e controle de usuários.

## Multiempresa e segurança

- A autenticação é feita por **Entrar com ChatGPT** na infraestrutura do ChatGPT Sites.
- Cada empresa possui um `organization_id` próprio em todos os registros operacionais.
- Toda API valida no servidor a identidade autenticada, a empresa informada e a participação do usuário.
- Proprietários e administradores podem convidar usuários e excluir registros com confirmação.
- O administrador da plataforma controla apenas situação e quantidade de usuários das empresas; não recebe acesso automático aos dados internos.
- Visitantes não autenticados visualizam somente a página pública de apresentação.

## Perfis de acesso

- `owner`: proprietário da empresa; administra usuários e registros.
- `admin`: administra usuários comuns e registros.
- `member`: utiliza os módulos operacionais.
- `technician`: utiliza os módulos operacionais como técnico.

## Estrutura principal

- `app/`: interface Next/Vinext e rotas de API.
- `db/schema.ts`: modelo completo do banco D1.
- `drizzle/`: migrações versionadas do banco.
- `lib/tenant.ts`: autorização e isolamento multiempresa.
- `lib/quote-pdf.ts` e `lib/contract-pdf.ts`: geração dos documentos.
- `.openai/hosting.json`: configuração do projeto no ChatGPT Sites.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Comandos disponíveis:

- `npm run dev`: inicia o ambiente local.
- `npm run build`: gera o Worker e os recursos de produção.
- `npm run db:generate`: gera uma nova migração a partir de `db/schema.ts`.
- `npm run lint`: verifica a qualidade do código.
- `npm test`: executa a compilação e os testes automatizados existentes.

## Variável de ambiente

Configure `PLATFORM_OWNER_EMAIL` no ambiente de hospedagem com o e-mail autenticado do responsável pela plataforma. O valor não deve ser incluído no repositório.

## Publicação

O projeto foi preparado para o ChatGPT Sites com banco D1. Na publicação, as migrações em `drizzle/` devem ser aplicadas antes da nova versão do Worker começar a receber tráfego.
