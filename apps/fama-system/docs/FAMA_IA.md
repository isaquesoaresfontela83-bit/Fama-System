# Fama IA: copiloto de gestão

A central usa os registros autorizados da empresa selecionada. No Control, o escopo é a administração da plataforma. Preferências globais não concedem acesso adicional aos usuários.

## Ferramentas operacionais

| Função | Pergunta de exemplo | Resultado |
| --- | --- | --- |
| Plano do dia | `Plano de ação da empresa` | Pendências reais e passos que podem ser marcados como conferidos nesta conversa. |
| Agenda e equipe | `Planejar agenda da semana` | Carga cadastrada e horários estimados, respeitando durações válidas e conflitos. |
| Cliente 360 | `Cliente 360: nome completo` | Propostas, visitas, ordens, contratos e garantias associados pelo nome exato. |
| Financeiro | `Fluxo de caixa` | Lançamentos futuros, vencidos e sem data; gráfico de entradas e saídas por semana. |
| Comparação | `Comparar financeiro` | Mês atual e anterior, por vencimento dos registros marcados como pagos. |
| CRM | `Diagnóstico do funil do CRM` | Estimativas comerciais por etapa e contatos sem próxima ação. |
| Mensagens | `Mensagem para orçamento: ORC-001` | Texto para copiar e revisar; propostas expiradas exigem atualização. |
| Cronograma | `Cronograma da agenda: nome do técnico` | Texto com atendimentos pendentes de hoje em ordem de horário. |
| Cadastros | `Criar despesa; descrição: material; valor: 450,00; vencimento: 10/10/2026` | Campos editáveis que seguem para o formulário existente. |
| Agendamento | `Agendar visita para João amanhã às 14h` | Rascunho de visita com os dados informados. |

Rascunhos disponíveis: clientes, leads, agendamentos, orçamentos, contratos, ordens de serviço e lançamentos financeiros. Os preços e itens de orçamento continuam no catálogo real da empresa. O cadastro só é criado ao salvar o formulário. Respostas podem abrir registros existentes após verificar novamente as permissões e o cadastro carregado.

A agenda sugere visitas de 60 minutos entre 8h–12h e 14h–18h, de segunda a sexta. Durações ausentes usam 60 minutos e são identificadas como estimativas. Não calcula deslocamento, folgas ou disponibilidade externa. Homônimos em clientes ou equipe impedem associações/sugestões ambíguas.

A projeção financeira não representa saldo bancário. Valores contratuais, propostas e potencial de vendas não são recebimentos. O cadastro financeiro desta consulta não possui vínculo suficiente para atribuir dívidas individuais aos clientes. O comparativo usa vencimentos, pois não há data de liquidação nesses registros.

## Conversa generativa opcional

As ferramentas internas não exigem chave nem fazem chamadas de modelo. A conexão generativa fica desativada até existir `OPENAI_API_KEY` como segredo do servidor e `FAMA_AI_GENERATIVE_ENABLED=true`. `FAMA_AI_MODEL` pode selecionar o modelo; o padrão preparado é `gpt-5-mini`. A ativação requer a autorização e conexão do provedor. Nunca coloque chaves no frontend, nas preferências públicas, em variáveis `NEXT_PUBLIC_*` ou no Git.

A interface consulta o estado autenticado de `GET /api/assistant`. Quando conectado, o usuário pode escolher conversa livre. `POST /api/assistant` aceita somente pergunta, módulo, até quatro perguntas anteriores, nome do cliente em foco e fuso. Dados enviados pelo navegador como contexto são recusados.

O servidor valida sessão, empresa/plano ou administrador da plataforma, origem, tamanho, limite de requisições, preferências e permissões. Os dados vêm do bootstrap autenticado ou das consultas administrativas existentes. No Control, emails de contas, metadados de auditoria e contatos/detalhes de privacidade não entram no contexto de modelo.

O provedor usa a Responses API com `store:false`, ferramentas de consulta e preparação de rascunho, schemas estritos, prazo de 35 segundos, até seis chamadas de ferramenta e quatro rodadas. As ferramentas não executam SQL arbitrário, pagamentos, exclusões, envios ou gravações. Botões, campos e IDs de registros vêm das funções internas validadas. O modelo só produz o texto da análise. Falhas permitem continuar no modo interno.

`/api/fama-ai` mantém compatibilidade com o painel financeiro anterior, delegando ao novo endpoint. O contexto enviado pelo navegador nessa rota é descartado. Conversas ficam na memória da tela e são descartadas ao sair, trocar empresa/permissões ou atualizar a configuração. A prévia do Control usa somente dados fictícios e nunca chama um modelo.

## Verificação

Execute `npm run typecheck` e `npm test`. Os testes usam fixtures para agenda, valores, datas, homônimos, permissões, rascunhos, isolamento, autenticação e chamadas de modelo. Simulações de API não comprovam ativação ou qualidade de respostas de um provedor real. O fluxo visual com conta logada deve ser conferido no navegador.
