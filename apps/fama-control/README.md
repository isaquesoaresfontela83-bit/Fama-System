# Fama Control

Plataforma SaaS multiempresa para gestão de negócios de piscinas. Reúne CRM, orçamentos e contratos em PDF, agenda, ordens de serviço, garantias, clientes e piscinas, estoque, financeiro, equipe, arquivos e controle de usuários, com temas claro e escuro persistidos por usuário.

## Multiempresa e segurança

- A autenticação usa **e-mail e senha**, com sessões verificadas pelo Supabase Auth.
- Cada empresa possui um `organization_id` próprio em todos os registros operacionais.
- Toda API valida no servidor a identidade autenticada, a empresa informada e a participação do usuário.
- Proprietários e administradores podem convidar usuários e excluir registros com confirmação.
- O administrador da plataforma cadastra empresas e contas, controla o acesso gratuito, bloqueios e permissões dos usuários; não recebe acesso automático aos dados operacionais internos.
- Visitantes não autenticados visualizam somente a página pública de apresentação.

## Perfis de acesso

- `owner`: proprietário da empresa; administra usuários e registros.
- `admin`: administra usuários comuns e registros.
- `member`: utiliza os módulos operacionais.
- `technician`: utiliza os módulos operacionais como técnico.

## Estrutura principal

- `app/`: interface Next/Vinext e rotas de API.
- `db/schema.ts`: modelo do banco D1 usado como retorno seguro durante a migração.
- `drizzle/`: migrações versionadas do banco.
- `supabase/schema.sql`: esquema PostgreSQL, segurança multiempresa, função transacional e bucket privado.
- `lib/supabase.ts`: acesso HTTP ao Supabase para o Worker, sem conexão TCP.
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

## Testes internos em localhost

Execute `npm run test:localhost` para validar as permissões do serviço privado de dados, a persistência dos planos e as respostas do suporte pelas rotas HTTP reais em `127.0.0.1`. A porta é temporária e fecha ao final do teste. Usuários, banco de dados e serviços externos são simulados; não configure segredos de produção para essa validação.

`npm test` compila e executa a suíte completa com conexões externas bloqueadas.

## Variáveis de ambiente

Configure `PLATFORM_OWNER_EMAIL` no ambiente de hospedagem com o e-mail autenticado do responsável pela plataforma. O valor não deve ser incluído no repositório.

Para usar Supabase, configure também:

- `DATA_BACKEND`: mantenha `d1` até importar e conferir os dados; altere para `supabase` na troca final.
- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_SECRET_KEY`: chave secreta exclusiva do backend; nunca exponha no navegador ou no GitHub.
- `SUPABASE_STORAGE_BUCKET`: use `fama-documents`, salvo se o SQL for adaptado para outro nome.

O arquivo `.env.example` contém apenas exemplos seguros. Valores reais devem ficar no gerenciador de segredos da hospedagem.

## Implantação do Supabase

1. Crie um projeto vazio no Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Importe as empresas e os vínculos antes dos registros operacionais.
4. Compare as quantidades por tabela entre D1 e PostgreSQL.
5. Configure URL e chave secreta na hospedagem mantendo `DATA_BACKEND=d1`.
6. Faça uma verificação final e mude apenas `DATA_BACKEND` para `supabase`.

O bucket `fama-documents` é privado. PDFs e imagens são enviados pelo backend, organizados por empresa e registro, e entregues por links temporários. O navegador nunca recebe a chave secreta.

## Publicação

O projeto foi preparado para o ChatGPT Sites com fallback D1 e Supabase via HTTPS. Enquanto `DATA_BACKEND` não estiver definido como `supabase`, a versão publicada continua usando D1 normalmente.

O Control atende o serviço privado de dados em `/api/internal/data`, protegido por `FAMA_DATA_BRIDGE_SECRET`, compartilhado somente entre os servidores. O navegador nunca recebe esse segredo nem a chave Supabase. O suporte e a resposta do administrador usam a tabela `support_tickets` do Supabase; chamados antigos do D1 são preservados.

## Empresas, usuários e mensalidade

No Fama Control, abra **Empresas e usuários → Nova empresa** e informe nome da empresa, e-mail e senha (mínimo de 8 caracteres). O nome do responsável é opcional. A conta é criada no Supabase Auth e vinculada como proprietária. A função transacional `fama_admin_create_company` grava empresa, proprietário e auditoria juntos. Empresas criadas pelo Control começam com `billing_enabled=false`, `block_on_expiry=false` e sem vencimento; escolher um plano define os recursos, sem ativar cobrança.

O responsável entra em `https://famasystem.online/entrar` com o nome da empresa, e-mail e senha definidos. Em **Usuários**, cadastre pessoas, escolha função, modelo de acesso e módulos. **Editar** permite alterar nome, e-mail, senha, função, situação e permissões; a senha em branco mantém a atual. O proprietário não pode ser rebaixado, desativado ou perder módulos. A conta principal da plataforma é protegida. Alterações de e-mail são confirmadas no Supabase Auth; contas compartilhadas entre empresas exigem o fluxo da própria conta.

Em **Empresa e mensalidade**, altere nome/plano e habilite a mensalidade somente quando desejar. Para habilitar, defina ciclo e vencimento. O bloqueio por vencimento ou pendência tem um controle separado. Ao habilitar uma empresa gratuita, o plano passa a aguardar pagamento; com bloqueio automático desligado, o acesso operacional continua permitido. **Bloquear** suspende manualmente a empresa inteira; **Reativar** não remove uma pendência de assinatura. Desativar mensalidade não cancela cobranças que já tenham sido emitidas pelo provedor.

Empresas isentas não entram no MRR, nas pendências ou alertas de vencimento. O Fama System publicado respeita ambos os controles no navegador e no servidor, mostra a isenção e impede checkout enquanto a mensalidade estiver desativada. Senhas seguem apenas para o serviço de autenticação e não são gravadas nas tabelas de empresas, membros ou auditoria.

O SQL aditivo correspondente está em `supabase/company-access.sql`. A suíte local verifica criação, edição, proteção do proprietário, origem das requisições, confirmação da persistência e ativação explícita de cobrança.
