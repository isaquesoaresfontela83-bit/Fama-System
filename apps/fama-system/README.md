# Fama System

Plataforma SaaS multiempresa para gestão de negócios de piscinas. Reúne CRM, orçamentos e contratos em PDF, agenda, ordens de serviço, garantias, clientes e piscinas, estoque, financeiro, equipe, arquivos e controle de usuários, com temas claro e escuro persistidos por usuário.

## Multiempresa e segurança

- A autenticação usa **e-mail e senha**, com sessões verificadas pelo Supabase Auth.
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
- `db/schema.ts`: modelo do banco D1 usado como retorno seguro durante a migração.
- `drizzle/`: migrações versionadas do banco.
- `supabase/schema.sql`: esquema PostgreSQL, segurança multiempresa, função transacional e bucket privado.
- `lib/supabase.ts`: acesso HTTP ao Supabase para o Worker, sem conexão TCP.
- `lib/tenant.ts`: autorização e isolamento multiempresa.
- `lib/quote-pdf.ts` e `lib/contract-pdf.ts`: geração dos documentos.
- `.openai/hosting.json`: configuração do projeto no ChatGPT Sites.

## Financeiro operacional

O cadastro inicia sete dias gratuitos no plano escolhido, sem criar cobrança. Após o prazo, o servidor bloqueia os módulos operacionais e mantém planos, suporte e recursos da conta acessíveis para renovação. E-mails com empresa já cadastrada, inclusive suspensa, não podem iniciar outro teste.

O catálogo de orçamentos é salvo por empresa, tanto no ambiente Supabase quanto no ambiente local D1. Categorias, produtos, preços, margens e finalidade dos campos de medida são editados por formulários. O cálculo usa as mesmas regras no navegador e no servidor; a taxa de cartão aumenta o total pelo cálculo inverso para preservar o valor líquido definido na proposta. A taxa deve representar o custo contratado com o processador.

Cada leitura de estoque adiciona ou retira uma unidade no servidor, com atualização condicional no Supabase e operação atômica no D1. Saídas sem saldo são recusadas e as leituras feitas no mesmo navegador são processadas em ordem.

O módulo Financeiro reúne visão geral bancária, contas a pagar/receber, cobranças por WhatsApp, cadastro de fornecedores, compras com criação automática de conta a pagar, contas bancárias manuais, integração Asaas e conciliação de extrato importado em CSV. Ao abrir o Financeiro, o sistema carrega os dados e tenta sincronizar automaticamente as conexões Asaas disponíveis. Na implantação D1, as tabelas auxiliares de compras, fornecedores e bancos são criadas de forma idempotente pela API. Para projetos que usam Supabase, aplique `supabase/finance-operations-migration.sql` ao banco já existente; novas instalações também encontram as tabelas em `supabase/schema.sql`.

A importação aceita CSV com `Data`, `Descrição` e `Valor`, ou `Data`, `Descrição`, `Crédito` e `Débito` (até 500 movimentos por arquivo). O sistema detecta duplicação do mesmo arquivo na mesma conta e só concilia valores exatos; movimentos sem lançamento podem criar um lançamento pago para manter o saldo refletido. A integração Asaas sincroniza saldo e extrato quando `FAMA_DATA_ENCRYPTION_KEY` está configurada e a chave de API da empresa é cadastrada com segurança. Mercado Pago e PagBank podem ser registrados como provedores financeiros principais ou complementares; a sincronização nativa desses provedores fica preparada para evolução posterior.

## IA e automações operacionais

A visão geral exibe um resumo diário com prioridade recomendada, alertas de cobrança vencida, lead parado, orçamento vencendo, garantia pendente e estoque baixo. A agenda permite enviar o cronograma semanal por técnico via WhatsApp. Ordens de serviço possuem checklist de conclusão e mensagem pós-visita. A IA financeira usa apenas contexto resumido e seguro, sem expor chaves, senhas, CPF/CNPJ completos ou dados bancários sensíveis.

O WhatsApp possui dois modos: os botões `wa.me` já abrem mensagens pré-preenchidas para revisão manual; a API oficial Cloud da Meta está disponível em `/api/whatsapp` para envio de texto/template e recebimento de webhook. Ela permanece desativada até o administrador configurar `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` e `META_WHATSAPP_VERIFY_TOKEN` como segredos do ambiente. Nenhum token é armazenado no código ou enviado ao navegador.

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

## Variáveis de ambiente

Configure `PLATFORM_OWNER_EMAIL` no ambiente de hospedagem com o e-mail autenticado do responsável pela plataforma. O valor não deve ser incluído no repositório.

Para usar Supabase, configure também:

- `DATA_BACKEND`: mantenha `d1` até importar e conferir os dados; altere para `supabase` na troca final.
- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_SECRET_KEY`: chave secreta exclusiva do backend; nunca exponha no navegador ou no GitHub.
- `FAMA_DATA_BRIDGE_SECRET`: segredo compartilhado exclusivamente pelos servidores System e Control. Permite ao System usar o serviço privado de dados do Control quando não há uma chave Supabase direta no System.
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

Em instalações existentes, aplique `supabase/company-billing-migration.sql` e `supabase/support-tickets-migration.sql`. As mudanças preservam empresas e usuários existentes. O suporte usa a mesma tabela nos dois sistemas.

O caminho fiscal padrão usa o portal oficial, sem API fiscal. Em Financeiro → Notas fiscais, prepare um rascunho, copie os dados, abra o emissor habilitado e emita em produção com o acesso do titular. MEI usa o emissor nacional; outras empresas seguem a habilitação municipal. Produtos exigem o emissor autorizado pela SEFAZ estadual. Depois da emissão, anexe o PDF ou XML e registre número e chave. A NFS-e nacional usa chave de 50 dígitos e a NF-e, de 44. A consulta de autenticidade e da situação atual ocorre no portal oficial; o Fama guarda esse processo como `registrada`, sem afirmar autorização apenas pela importação.

O XML nacional ou da NF-e de produção é conferido com CPF/CNPJ do prestador e do cliente e valor do rascunho. Número e chave são extraídos, persistidos em metadados e conferidos novamente ao registrar. XMLs não são executados nem renderizados pelo navegador; são guardados em bucket privado como bytes para download. O registro exige documento anexado à mesma empresa e nota, confirmação manual da consulta e impede repetição de uma chave já registrada. Cancelamentos são realizados primeiro no emissor, com registro posterior no histórico; documentos fiscais são preservados. Aplique `supabase/fiscal-portal.sql` nas instalações existentes.

A Notaas continua opcional para empresas com integração configurada. Cadastre chave, ambiente e dados fiscais do emitente e ISS; certificado e habilitação são administrados na Notaas. Homologação exige chave de teste. O status `emitida` só é retornado quando o provedor confirma a emissão. Cobranças e notas reais dependem da validação das contas externas.

O administrador autenticado pode verificar a configuração de lançamento em `POST /api/admin/launch` com `action: readiness`. A resposta consulta o status das contas Asaas e a configuração do webhook sem retornar chaves ou dados bancários. A ação `configureBillingWebhook` configura somente a confirmação de assinaturas em `https://famasystem.online/api/billing/asaas-webhook`, preserva outros webhooks e confirma o destino antes da alteração. O diagnóstico não comprova recebimento de dinheiro nem autorização fiscal.

Uma manutenção de lançamento pode utilizar `FAMA_LAUNCH_CHECK_TOKEN` (segredo aleatório de 64 caracteres hexadecimais) e `FAMA_LAUNCH_CHECK_EXPIRES_AT` (ISO, no máximo uma hora no futuro). Esse acesso permite somente as duas ações acima, deve ser removido ao concluir a manutenção e recusa tokens vencidos. O acesso normal continua restrito ao administrador autenticado.

## Publicação

O projeto foi preparado para o ChatGPT Sites com fallback D1 e Supabase via HTTPS. Enquanto `DATA_BACKEND` não estiver definido como `supabase`, a versão publicada continua usando D1 normalmente.
# Open Finance

O módulo Bancos oferece conexão por Pluggy Connect e importação manual CSV. A conexão bancária só é habilitada quando `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `FAMA_DATA_ENCRYPTION_KEY` estão configurados como segredos no runtime. Nunca inclua essas chaves no código, no navegador ou em mensagens. O consentimento é concedido pelo titular na instituição financeira; o sistema importa contas e movimentações para conciliação e sincroniza até 90 dias por vez. A sincronização é manual nesta versão.
