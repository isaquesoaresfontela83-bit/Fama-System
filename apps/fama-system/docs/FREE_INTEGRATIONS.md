# Integrações gratuitas do Fama

## BrasilAPI

O catálogo `lib/brasil-api-catalog.json` foi extraído da especificação OpenAPI publicada em https://brasilapi.com.br/docs em 14/10/2026. São 88 operações GET, com caminhos e parâmetros previamente autorizados. A tela Consulta → Mais consultas gratuitas permite pesquisar por assunto, preencher filtros e visualizar resultados paginados. As consultas não alteram dados operacionais automaticamente.

O servidor fixa o domínio BrasilAPI, limita entradas e respostas, impede redirecionamentos, aplica autenticação, limites por usuário, cache e coalescência. Não deve realizar varreduras de bases ou consultas em massa. Alguns serviços dependem de terceiros e podem falhar independentemente do Fama. Resultados financeiros são referência, não confirmam pagamentos. Conteúdo público médico é apenas consulta de catálogo, não orientação clínica.

Os feriados nacionais são integrados à central de operação para planejamento; nenhuma visita é reagendada automaticamente. Municípios e feriados locais precisam de conferência.

## Firebase Cloud Messaging

A integração usa exclusivamente Cloud Messaging; não habilita Firestore, Functions, Analytics ou produtos pagos. A configuração é única para o Fama, não por empresa.

Variáveis de execução necessárias:

- `FIREBASE_WEB_CONFIG`: JSON do aplicativo Web, com `apiKey`, `projectId`, `appId`, `messagingSenderId`. É configuração pública do SDK.
- `FIREBASE_VAPID_KEY`: chave pública Web Push do projeto, gerada em Configurações → Cloud Messaging → Certificados Web Push.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço com permissão para enviar mensagens FCM no mesmo projeto. **Segredo exclusivo do servidor.** Nunca inserir no frontend, Git ou mensagens.
- `FAMA_DATA_ENCRYPTION_KEY`: configuração de criptografia já utilizada pelo Fama.

Crie um projeto gratuito no Firebase e um aplicativo Web, habilite a API FCM e configure as credenciais no ambiente de execução. Não é necessário habilitar faturamento nem contratar outros produtos para este recurso. Verifique a tabela vigente do Firebase antes de ativar serviços adicionais.

O usuário abre o sino → Notificações neste aparelho → Ativar notificações, aceita a permissão e escolhe categorias. Há teste, preferências e desativação. Cada navegador usa uma inscrição; a inscrição é associada à empresa e ao usuário ativos. Sair da conta remove a inscrição deste navegador. Tokens são criptografados no banco.

O service worker é empacotado localmente em `public/firebase-messaging-sw.js`; não carrega JavaScript por CDN. Ele exibe mensagens em segundo plano, evita conteúdo pessoal na tela bloqueada e abre somente a origem do Fama. O aplicativo recebe mensagens em primeiro plano e consulta suas pendências a cada cinco minutos enquanto aberto. Novos registros operacionais enfileiram uma notificação para os aparelhos do próprio usuário; o Worker entrega em `waitUntil`, sem atrasar o salvamento com chamadas ao Firebase. Preferências e permissões são aplicadas à sincronização de alertas. Não são usados tópicos públicos para dados multiempresa.

**Lembretes de servidor:** o endpoint autenticado `/api/internal/push-reminders` processa visitas nos próximos 90 minutos e pendências de OS, estoque, cobranças, orçamentos e garantias. Respeita permissões e plano atual em cada execução, sem consultar nomes ou endereços. A execução automática depende da rotina horária documentada em `docs/FAMA_PUSH_SCHEDULE.md` e da ativação do Firebase. Não afirmar que houve entrega antes de um teste real.

**Ativação pendente em 14/10/2026:** não foram encontradas variáveis do Firebase. A integração permanece sem enviar push até configuração e teste real. A central de alertas interna continua funcionando.
