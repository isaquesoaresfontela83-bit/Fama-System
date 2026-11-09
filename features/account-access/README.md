# Acesso por duas contas e colaborador do Control — 15.23.3

Lançamento conjunto `2026-11-09-account-access-01` sobre os Workers 15.23.2. Os módulos publicados originais são preservados e validados por contagem, versão ativa e SHA-256 antes de qualquer publicação. `deploy.mjs` prepara os dois pacotes antes de ativar o primeiro e restaura a versão anterior se a segunda ativação falhar.

No System, a opção de adicionar outra conta abre uma página própria em `/entrar?add_account=1`. Ela usa a API de login existente, confirma MFA quando necessário e só navega para a aplicação depois que `/api/auth/accounts` confirma que a conta original ainda está conectada.

No Control, `/colaboradores-control` permite ao proprietário registrar uma solicitação por e-mail e aprovar ou revogar o acesso. O registro pendente não cria identidade nem concede permissão. A aprovação procura uma identidade existente ou envia convite pelo Supabase Auth, então registra `fama_control_admin` em `app_metadata`, que somente o servidor administrativo pode alterar. A autorização dos módulos do Control reconhece esse campo no usuário verificado pelo Supabase. A revogação remove o campo. A tabela `control_collaborator_requests` é criada no D1 existente do Control; os dados operacionais não são alterados.

O pedido para `grupofamaofc@gmail.com` deve ser inserido como pendente após a publicação. O proprietário precisa clicar em **Aprovar criação**; o convite e a permissão não são emitidos durante a implantação.

Validação local: `node features/account-access/account-access.test.mjs` e `node --check` em cada módulo. Os dois pacotes precisam passar na preparação contra a versão ativa antes da publicação. Verificar após a publicação os dois domínios, os endpoints de saúde, o formulário do System e a página de aprovação do Control. Teste autenticado com duas contas depende das credenciais das próprias contas.
