# Assistente Fama IA

A implementação original foi adicionada pelo Codex no VS Code na branch `fama-control-final`, commit `658b77550904f4f139eb2196033e4115c2832cd2`. Esta integração reaproveita a assistente nas versões atuais do Fama System e do Fama Control, sem substituir seus fluxos de autenticação, acesso e mensalidade.

## Uso

- Fama System → **Fama IA**: selecione a empresa; consulte agenda, CRM, orçamentos, ordens, clientes, estoque, financeiro, equipe, garantias e contratos conforme suas permissões.
- Fama Control → **Fama IA**: consulte empresas, usuários, auditoria e solicitações de privacidade carregados no painel.
- Fama Control → **Configurar IA**: habilite a assistente, escolha funções, nome, mensagem inicial, limite de resultados, ações, conflitos e respostas personalizadas.

Exemplos: “resumo da gestão”, “agenda de hoje”, “agenda amanhã”, “agenda em 07/10/2026”, “conflitos na agenda”, “estoque baixo”, “resumo financeiro”, “pagamentos atrasados”, “orçamentos de hoje”, “contratos ativos”, “garantias vencidas”. Selecione o módulo e use `buscar: nome` para filtrar os registros.

## Central de trabalho

A interface inclui indicadores da empresa, navegação por módulo, cartões de consulta, prioridades operacionais e conversa com respostas estruturadas. Valores, estados, detalhes dos registros e ações são apresentados separadamente. As listas mostram até seis resultados inicialmente, com expansão até o limite configurado. A versão para celular usa um seletor de módulo; os temas claro e escuro seguem a identidade do sistema.

Os indicadores e alertas usam exclusivamente os módulos autorizados e os registros carregados: contas vencidas, orçamentos enviados, contratos com término nos próximos 30 dias, estoque no mínimo, visitas sem técnico e ordens em aberto. Não são notificações em segundo plano nem tarefas agendadas.

A consulta reconhece o módulo citado na pergunta e mantém o assunto em continuações como “e amanhã?” ou “somente os pendentes”. As perguntas explícitas podem mudar de módulo sem apagar a conversa. Há atalhos para continuar a análise, copiar respostas e abrir os formulários existentes.

Exemplos adicionais:

- “Prioridades da empresa”, “agenda de hoje sem técnico” e “carga de trabalho da equipe hoje”. A distribuição exige acesso tanto à equipe quanto à agenda e associa os técnicos por nome.
- “Financeiro deste mês”, “contas a pagar” e “financeiro de 01/10/2026 a 15/10/2026”. O período financeiro usa vencimentos, pois o cadastro não informa a data de liquidação.
- “Orçamentos enviados”, “orçamentos vencidos” e “contratos ativos a vencer em 30 dias”. Valores das propostas e mensalidades contratuais não são tratados como dinheiro recebido.
- “Estoque zerado” e `buscar: ORC-123` no módulo de orçamentos.

No Control, o estúdio de configuração possui abas de configuração, respostas e prévia. A prévia usa dados fictícios identificados e não grava nem navega para registros reais. Ações de demonstração exibem uma explicação. O rascunho só entra em vigor depois de salvar; revisões antigas continuam bloqueadas.

## Copiloto operacional

A central agora oferece ferramentas de planejamento, análise e preparação de ações. Os fluxos e limites detalhados estão em [FAMA_IA.md](../apps/fama-system/docs/FAMA_IA.md).

| Recurso | Como usar |
| --- | --- |
| Plano do dia | `Plano de ação da empresa`: pendências reais com checklist de conferência na conversa. |
| Planejamento da equipe | `Planejar agenda da semana`: carga, duração, conflitos e horários estimados. |
| Visão do cliente | `Cliente 360: nome completo`: registros dos módulos autorizados e atalho para o cadastro. |
| Projeção financeira | `Fluxo de caixa`: vencimentos futuros, atrasados e sem data, com gráfico por semana. |
| Comparação de meses | `Comparar financeiro`: lançamentos pagos por mês de vencimento. |
| Funil de vendas | `Diagnóstico do funil do CRM`: estimativas por etapa e contatos sem próxima ação. |
| Acompanhamento | `Mensagem para orçamento: ORC-001`: texto para revisar e copiar, com aviso de validade vencida. |
| Rascunho de cadastro | `Criar despesa; descrição: material; valor: 450,00; vencimento: 10/10/2026`. |
| Visita | `Agendar visita para João amanhã às 14h`: campos preparados para revisão. |

Há formulários assistidos para clientes, leads, visitas, contratos, orçamentos, ordens e lançamentos. Campos são validados e transferidos aos formulários existentes. Os itens/preços de orçamento seguem o catálogo real da empresa e o cálculo validado pelo servidor. O registro só é criado ao salvar. Mensagens não são enviadas pela assistente e o checklist não altera o estado dos registros.

## Comportamento e limites

O modo interno funciona sem chave nem chamadas de modelo. As ferramentas usam os registros carregados da empresa selecionada e obedecem permissões e preferências. A visão do cliente relaciona nomes exatos e recusa homônimos; o financeiro desta consulta não possui vínculo que permita atribuir dívidas individuais aos clientes.

A agenda utiliza durações válidas e assume 60 minutos quando não há duração, com aviso. Sugere horários em dias úteis de 8h–12h e 14h–18h. Não considera viagens, folgas ou disponibilidade externa. O comparativo financeiro usa vencimentos dos registros pagos; projeções, valores contratuais e potencial comercial não são saldo bancário nem recebimentos garantidos.

A conversa generativa está implementada como opção, mas continua **desativada nesta publicação**. Não há chave de provedor configurada; o usuário decidiu continuar sem OpenAI Developers. Os testes de Responses API são simulados e não comprovam ativação ou qualidade de um modelo real. Para uma ativação futura, configure `OPENAI_API_KEY` como segredo de servidor e habilite `FAMA_AI_GENERATIVE_ENABLED=true` somente depois de autorizar o provedor. `FAMA_AI_MODEL` seleciona o modelo preparado. Nada disso fica nas preferências públicas.

`GET /api/assistant` informa o estado somente após autenticação. `POST /api/assistant` valida origem, sessão, escopo, corpo, preferências e limite de requisições. Recebe apenas a pergunta e metadados limitados; recusa registros/contexto fornecidos pelo navegador. O servidor busca o bootstrap autorizado da empresa ou os registros administrativos. O Control não oferece consultas operacionais de empresas; emails de contas, metadados de auditoria e contatos/detalhes de privacidade ficam fora do contexto generativo.

As ferramentas do modelo apenas consultam ou preparam rascunhos. Não executam SQL arbitrário, pagamentos, envios, exclusões ou gravações. A chamada usa `store:false`, limite de tempo, de rodadas e de ferramentas. As ações, IDs e campos exibidos vêm das funções internas validadas. Falhas permitem continuar no modo interno. A rota financeira anterior `/api/fama-ai` delega ao endpoint novo e descarta o contexto do navegador.

Conversas ficam na memória da tela e são descartadas ao sair, trocar empresa/permissões ou atualizar a revisão. No modo interno, nenhuma pergunta ou registro é enviado a um provedor. No modo generativo futuramente ativado, perguntas e resultados das consultas necessárias serão enviados ao provedor configurado. A prévia do Control usa dados fictícios, sem chamadas de modelo. Datas da análise no servidor usam o fuso do dispositivo, com padrão `America/Sao_Paulo`.

## Backend e publicação

Migração compartilhada: `supabase/migrations/20261001210000_fama_ai_settings.sql` (aplicar uma única vez no projeto Supabase compartilhado).

- `public.fama_ai_settings`: uma linha global, com RLS; leitura de preferências pública e nenhuma gravação permitida a `anon` ou `authenticated`.
- `public.fama_save_ai_settings`: execução exclusiva de `service_role`; comparação de revisão, atualização e auditoria em uma transação. Uma revisão antiga recebe conflito, sem sobrescrever outro administrador.
- Control `GET /api/ai-settings`: compartilha somente preferências validadas, com `Cache-Control: no-store`.
- Control `POST /api/ai-settings`: verifica administrador real da plataforma, origem, limite de requisições e configuração antes de chamar a transação.
- System `GET /api/ai-settings`: lê a configuração no Supabase compartilhado com `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` já usados na autenticação. Consulta somente a tabela pública de preferências, sem chave privilegiada, perguntas ou dados operacionais. Essa leitura não depende do domínio do Control.

Publicar primeiro o Control e depois o System. Não há alteração da função Edge legada `fama-control`. Para validar: `npm run typecheck` e `npm test`. Os testes usam dados fictícios e cobrem datas, cálculos, fontes, permissões, isolamento, configuração, concorrência e falhas.

## Publicação inicial

Fama System versão 101 e Fama Control versão 39 publicados em 01/10/2026. TypeScript, builds e 114 testes passaram. A migração foi aplicada no banco compartilhado, com RLS, privilégios e concorrência conferidos. O teste da transação foi revertido; nenhum registro de teste permaneceu. As publicações foram confirmadas pelo serviço de hospedagem. O teste com conta logada no navegador permanece pendente: este ambiente recebeu `ERR_BLOCKED_BY_CLIENT` ao tentar abrir os sites. Os commits e versões estão em `docs/provenance/IA_PUBLICACAO_2026-10-01.json`.


## Atualização da interface e consultas

Fama System versão 102 e Fama Control versão 40 publicados em 01/10/2026. Os builds, TypeScript e 130 testes passaram (80 no System e 50 no Control); os arquivos TypeScript alterados da assistente passaram no ESLint. Os testes cobrem a renderização dos controles acessíveis e a omissão de indicadores restritos, além das novas regras de contexto, períodos, contratos, equipe e limites. Não houve migração adicional, gravação financeira ou alteração das regras de cobrança.

A verificação visual e o fluxo com conta logada no navegador permanecem pendentes: a skill exigida para abrir a prévia supervisionada não está disponível neste ambiente. A publicação foi confirmada pelo serviço de hospedagem. Os commits, versões e resultados estão em `docs/provenance/IA_INTERFACE_2026-10-01.json`.

## Ampliação do copiloto

Fama System versão 103 e Fama Control versão 41 publicados em 01/10/2026. Passaram os builds, TypeScript e 178 testes (104 System e 74 Control). O ESLint dos arquivos TypeScript da assistente passou sem erros; o painel financeiro mantém um aviso anterior de imagem. As verificações cobrem rascunhos, datas reais, duração/intervalos, nomes duplicados, projeções, CRM, mensagens, autenticação, isolamento e ferramentas generativas simuladas. Não houve nova migração, gravação financeira nem ativação de cobranças ou do provedor generativo.

O fluxo visual com conta logada continua pendente pela indisponibilidade da skill exigida para abrir a prévia supervisionada. As publicações foram confirmadas pelo serviço de hospedagem; os metadados estão em [IA_COPILOTO_2026-10-01.json](provenance/IA_COPILOTO_2026-10-01.json).
