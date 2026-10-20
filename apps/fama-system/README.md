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
- `db/schema.js`: modelo do banco D1 usado como retorno seguro durante a migração.
- `drizzle/`: migrações versionadas do banco.
- `supabase/schema.sql`: esquema PostgreSQL, segurança multiempresa, função transacional e bucket privado.
- `lib/supabase.js`: acesso HTTP ao Supabase para o Worker, sem conexão TCP.
- `lib/tenant.js`: autorização e isolamento multiempresa.
- `lib/quote-pdf.js` e `lib/contract-pdf.js`: geração dos documentos.
- `.openai/hosting.json`: configuração do projeto no ChatGPT Sites.

## Financeiro operacional

O cadastro inicia sete dias gratuitos no plano escolhido, sem criar cobrança. Após o prazo, o servidor bloqueia os módulos operacionais e mantém planos, suporte e recursos da conta acessíveis para renovação. E-mails com empresa já cadastrada, inclusive suspensa, não podem iniciar outro teste.

O catálogo de orçamentos é salvo por empresa, tanto no ambiente Supabase quanto no ambiente local D1. Categorias, produtos, preços, margens e finalidade dos campos de medida são editados por formulários. O cálculo usa as mesmas regras no navegador e no servidor; a taxa de cartão aumenta o total pelo cálculo inverso para preservar o valor líquido definido na proposta. A taxa deve representar o custo contratado com o processador.

Cada leitura de estoque adiciona ou retira uma unidade no servidor, com atualização condicional no Supabase e operação atômica no D1. Saídas sem saldo são recusadas e as leituras feitas no mesmo navegador são processadas em ordem.

O módulo Financeiro reúne visão geral bancária, contas a pagar/receber, cobranças por WhatsApp, cadastro de fornecedores, compras com criação automática de conta a pagar, contas bancárias manuais, integração Asaas e conciliação de extrato importado em CSV. Ao abrir o Financeiro, o sistema carrega os dados e tenta sincronizar automaticamente as conexões Asaas disponíveis. Na implantação D1, as tabelas auxiliares de compras, fornecedores e bancos são criadas de forma idempotente pela API. Para projetos que usam Supabase, aplique `supabase/finance-operations-migration.sql` ao banco já existente; novas instalações também encontram as tabelas em `supabase/schema.sql`.

A importação aceita CSV com `Data`, `Descrição` e `Valor`, ou `Data`, `Descrição`, `Crédito` e `Débito` (até 500 movimentos por arquivo). O sistema detecta duplicação do mesmo arquivo na mesma conta e só concilia valores exatos; movimentos sem lançamento podem criar um lançamento pago para manter o saldo refletido. A integração Asaas sincroniza saldo e extrato quando `FAMA_DATA_ENCRYPTION_KEY` está configurada e a chave de API da empresa é cadastrada com segurança. Contas manuais e importação CSV continuam disponíveis para outros bancos.

## IA e automações operacionais

A visão geral exibe um resumo diário com prioridade recomendada, alertas de cobrança vencida, lead parado, orçamento vencendo, garantia pendente e estoque baixo. A agenda permite enviar o cronograma semanal por técnico via WhatsApp. Ordens de serviço possuem checklist de conclusão e mensagem pós-visita. A central Fama IA reúne consultas por módulo, planejamento da equipe, visão do cliente, projeção financeira, funil comercial, mensagens para revisão e rascunhos de cadastros. As consultas internas funcionam sem provedor de IA. A conversa livre opcional usa ferramentas de leitura no servidor, registros da empresa autenticada e ativação explícita. Veja `docs/FAMA_IA.md`.

O vínculo oficial do WhatsApp fica em **Configurações da empresa > Fama IA no WhatsApp**, com etapas para cadastrar o número da Meta, confirmar o recebimento e autorizar telefones da equipe. As credenciais são criptografadas no servidor; não retornam à tela depois de salvas. A confirmação é consultada automaticamente enquanto pendente. O usuário conectado é selecionado por padrão e telefones brasileiros aceitam DDD + número; outros países usam +DDI. Depois de ativar a IA, **Abrir conversa de teste** abre uma pergunta para revisão e envio manual. O webhook por empresa é `/api/whatsapp/webhook`; a rota `/api/whatsapp` atende os envios operacionais autenticados.

**Notas fiscais** tem uma aba própria no menu Gestão, com as mesmas permissões do Financeiro. Ela reúne os rascunhos, envio de NFS-e pela Asaas, consulta de status, cancelamento e documentos PDF/XML. A abertura dessa aba carrega os dados fiscais sem disparar sincronizações bancárias. Links antigos `#finance/notas` continuam abrindo as notas fiscais.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Comandos disponíveis:

- `npm run dev`: inicia o ambiente local.
- `npm run build`: gera o Worker e os recursos de produção.
- `npm run db:generate`: gera uma nova migração a partir de `db/schema.js`.
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

A emissão de NFS-e pode ser feita pela Asaas. Selecione `asaas` nas configurações fiscais da empresa, informe sua chave do ambiente escolhido, e-mail, código municipal (ou ID listado pela Asaas) e tributos confirmados pela contabilidade. Habilite previamente as informações fiscais na conta Asaas. A chave da empresa é independente da chave de assinatura da plataforma. O Fama reutiliza o tomador pelo CPF/CNPJ, agenda a nota com referência ao rascunho e só confirma `emitida` após o status `AUTHORIZED`. O envio à prefeitura (`SYNCHRONIZED`) ainda é `processando`.

Na primeira emissão, o servidor configura um webhook fiscal próprio da empresa em `/api/finance/asaas-webhook?organizationId=...`, com segredo derivado por empresa e sem expor o token de assinaturas. Os eventos são confirmados pela consulta autenticada da nota na Asaas; número, código de validação, PDF e XML são atualizados sem conceder planos ou alterar cobranças. O cancelamento automático depende de `supportsCancellation` do município e nunca usa cancelamento apenas interno na Asaas. Esta publicação não comprova emissão real nem substitui a habilitação fiscal da conta. Referências: [agendamento](https://docs.asaas.com/reference/agendar-nota-fiscal), [eventos](https://docs.asaas.com/docs/webhook-para-notas-fiscais).

O portal oficial continua disponível sem API fiscal. Em Financeiro → Notas fiscais, prepare um rascunho, copie os dados, abra o emissor habilitado e emita em produção com o acesso do titular. MEI usa o emissor nacional; outras empresas seguem a habilitação municipal. Produtos exigem o emissor autorizado pela SEFAZ estadual. Depois da emissão, anexe o PDF ou XML e registre número e chave. A NFS-e nacional usa chave de 50 dígitos e a NF-e, de 44. A consulta de autenticidade e da situação atual ocorre no portal oficial; o Fama guarda esse processo como `registrada`, sem afirmar autorização apenas pela importação.

O XML nacional ou da NF-e de produção é conferido com CPF/CNPJ do prestador e do cliente e valor do rascunho. Número e chave são extraídos, persistidos em metadados e conferidos novamente ao registrar. XMLs não são executados nem renderizados pelo navegador; são guardados em bucket privado como bytes para download. O registro exige documento anexado à mesma empresa e nota, confirmação manual da consulta e impede repetição de uma chave já registrada. Cancelamentos são realizados primeiro no emissor, com registro posterior no histórico; documentos fiscais são preservados. Aplique `supabase/fiscal-portal.sql` nas instalações existentes.

A Asaas é a integração de API para emissão automática de NFS-e. Também permanecem disponíveis os emissores oficiais nacional, municipal e estadual. Provedores intermediários e URLs de API fiscal personalizadas não são aceitos; notas e documentos históricos são preservados.

O administrador autenticado pode verificar a configuração de lançamento em `POST /api/admin/launch` com `action: readiness`. A resposta consulta o status das contas Asaas e a configuração do webhook sem retornar chaves ou dados bancários. A ação `configureBillingWebhook` configura somente a confirmação de assinaturas em `https://famasystem.online/api/billing/asaas-webhook`, preserva outros webhooks e confirma o destino antes da alteração. O diagnóstico não comprova recebimento de dinheiro nem autorização fiscal.

Uma manutenção de lançamento pode utilizar `FAMA_LAUNCH_CHECK_TOKEN` (segredo aleatório de 64 caracteres hexadecimais) e `FAMA_LAUNCH_CHECK_EXPIRES_AT` (ISO, no máximo uma hora no futuro). Esse acesso permite somente as duas ações acima, deve ser removido ao concluir a manutenção e recusa tokens vencidos. O acesso normal continua restrito ao administrador autenticado.

## Publicação

O projeto foi preparado para o ChatGPT Sites com fallback D1 e Supabase via HTTPS. Enquanto `DATA_BACKEND` não estiver definido como `supabase`, a versão publicada continua usando D1 normalmente.
# Open Finance

O módulo Bancos oferece sincronização de contas Asaas e importação manual CSV para conciliação. A chave Asaas é validada e criptografada no servidor; a conexão fica isolada por empresa.

## Agenda Google Calendar e pontos de apoio

O mapa dos atendimentos oferece busca sob demanda de postos, estacionamentos, farmácias e lojas de materiais via Overpass/OpenStreetMap. A busca envia apenas categoria, raio (até 5 km) e coordenadas arredondadas; não envia nomes ou endereços dos clientes. Há cache de uma hora, limites por usuário e globais, sem fallback que contorne bloqueios do provedor. Distâncias exibidas são em linha reta; rotas abrem no OpenStreetMap. Dados colaborativos podem estar incompletos.

Na Agenda, a seção Google Calendar permite exportar até 20 atendimentos selecionados para .ics. A conexão direta usa Google Identity Services, tokens temporários apenas em memória e os escopos `calendar.events.owned` e `calendar.freebusy`. Cada pessoa escolhe e autoriza sua própria conta. O envio explícito cria/atualiza eventos na agenda principal com IDs estáveis por empresa e atendimento; não envia convites. Não existe sincronização contínua ou exclusão automática. A consulta de disponibilidade bloqueia apenas o técnico que o usuário associou à conta, por até cinco minutos, na proposta semanal. Eventos já exportados também aparecem como ocupados. Nenhum conteúdo ou título de evento Google é importado; apenas os intervalos ocupados da agenda principal.

Para ativar a conexão direta, habilite Google Calendar API no projeto Google Cloud, configure a tela de consentimento e crie um cliente OAuth do tipo Web. Cadastre as origens JavaScript `https://famasystem.online` e `https://fama-system.isaquesoaresfontela8.chatgpt.site` (e `https://www.famasystem.online` caso usado). Este fluxo popup não requer callback de servidor nem client secret. Configure `FAMA_GOOGLE_CALENDAR_CLIENT_ID` no runtime Sites e publique uma versão para aplicar. Em modo de teste, autorize explicitamente os e-mails de teste; para uso público, cumpra a publicação/verificação exigida pelo Google. Não exponha client secrets nem reutilize as credenciais do Firebase como cliente OAuth. Sem cliente configurado, a interface informa a pendência e mantém o download .ics.

## Planejamento unificado

O menu Operação > Planejamento centraliza mapa/CEP, referência do clima, pontos de apoio, deslocamento/frete, feriados e semana com IA/Google Calendar. No celular, fica em Mais > Planejamento; Agenda e Início têm atalhos. O acesso usa a permissão e o plano da Agenda. O cálculo de frete mantém sua autorização própria (Clientes/Consulta e Pro). O CEP confirmado no mapa preenche o destino do cálculo; o resultado pode ser visto no mesmo mapa. O ponto de referência atual também alimenta a proposta semanal. As sugestões continuam revisáveis; tempos de deslocamento da proposta são informados manualmente. Não há replanejamento ou envio externo automático ao abrir essa aba.

### Mapa interativo do planejamento

O mapa usa Leaflet com zoom, centralização, visão dos pontos conhecidos e ampliação da área. Pinos diferenciam GPS/origem, locais ajustados manualmente e CEPs aproximados. A precisão continua dependendo do aparelho ou do ponto confirmado: o mapa não transforma um CEP em localização exata. São exibidos os locais já confirmados ou localizados nesta sessão; escolher outra visita consulta seu CEP sob demanda, sem geocodificar a carteira inteira. Os nomes ficam apenas na interface, sem serem enviados ao servidor de imagens do mapa. As imagens OSM são carregadas apenas para a área visível, usando cache normal do navegador e atribuição visível. Arrastar ou ampliar não muda o ponto do atendimento. O ajuste manual continua exigindo confirmação.

### Geoapify — mapa operacional
Configure `FAMA_GEOAPIFY_MAPS_PUBLIC_KEY` no ambiente do servidor com uma chave dedicada aos mapas web. Esta chave é entregue ao navegador por `/api/map-config` somente após autenticação e associação à empresa; não use chaves de serviços privados. Restrinja a chave no painel Geoapify aos domínios `famasystem.online`, `www.famasystem.online` e `fama-system.isaquesoaresfontela8.chatgpt.site`. Sem chave válida, ou após três erros nos tiles, o mapa usa OpenStreetMap. Geoapify usa Positron no tema claro e Dark Matter no tema escuro ao abrir o mapa. Os créditos dos provedores permanecem visíveis. A troca de provedor não melhora a precisão do GPS.

Empacotamento de publicação: execute `scripts/compress-runtime-assets.mjs` e `scripts/verify-release-assets.mjs` nos comandos do source helper, antes de gerar o arquivo de implantação. Confira também os tamanhos dos arquivos dentro do tar final (máximo 25 MiB por arquivo). A hidratação de artefatos entre etapas pode restaurar os arquivos WASM originais.

## JavaScript e Python

A interface React, as rotas de API, os componentes e as configurações usam JavaScript/JSX. A inferência da Fama IA é orquestrada pelo serviço Python. O servidor Fama valida identidade, plano, empresa e permissões antes de enviar somente o resumo autorizado.

- `npm run check:js`: valida todos os arquivos JavaScript e JSX.
- `npm run build`: gera o Worker e os arquivos do navegador.
- `npm test`: compila e executa os testes de regressão.
- Serviço Python, configuração e validação: [migração](docs/migracao-javascript-python.md).
