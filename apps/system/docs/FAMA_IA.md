# Fama IA: núcleo próprio e modelos locais

A central consulta os registros autorizados da empresa selecionada. No Control, consulta apenas a administração da plataforma. O núcleo de consultas, cálculos, permissões e preparação de ações é do Fama. A conversa local e o reconhecimento de voz usam modelos abertos executados no dispositivo. Opcionalmente, o Cloudflare Workers AI acrescenta sugestões pelo servidor; o núcleo continua responsável pelos dados, cálculos, permissões e ações.

## Conversa e movimento

A central usa as cores do tema do sistema, com a conversa no centro e o campo de pergunta sempre abaixo dela. A lateral reúne nova conversa, consultas recentes, módulos autorizados, atalhos e resumo. No celular, o botão de ferramentas abre essa lateral; o seletor de foco continua junto da conversa. Retomar uma consulta executa a pergunta novamente com as permissões e os dados atuais.

O símbolo tem um brilho suave em repouso, pulsa ao preparar uma resposta e mostra ondas durante o ditado ou a leitura. Os estados também aparecem por escrito. Novas mensagens entram com uma transição curta; a opção de reduzir movimento do dispositivo desliga as animações. Os botões de cancelar consulta, concluir gravação e parar fala continuam disponíveis durante suas respectivas tarefas.

## Usar voz e conversa local

Ao abrir o aplicativo autenticado, a preparação automática confere os arquivos e baixa somente os que faltarem, em segundo plano. Também confere novamente ao voltar à página ou recuperar a conexão. Os recursos são preparados separadamente:

| Recurso | Modelo aberto | Execução | Download aproximado |
| --- | --- | --- | --- |
| Ditado de comandos | Whisper Tiny multilíngue, exportação ONNX | CPU/WASM do dispositivo | 70 MB no primeiro uso, incluindo o runtime |
| Explicações e sugestões | Qwen3 0,6B, exportação ONNX quantizada | WebGPU com shader-f16 | 600 MB |
| Leitura de respostas | Voz local de português do sistema operacional | Dispositivo | Depende da voz instalada |

Os arquivos dos modelos são baixados do Hugging Face com revisões fixas. O runtime de execução é servido pelo próprio Fama. Downloads não contêm perguntas, áudio ou registros; o worker só permite GET/HEAD para esses arquivos, sem credenciais nem referrer. Nenhum token de provedor é necessário. Os arquivos são salvos no CacheStorage do navegador, com as revisões fixas dos modelos e do runtime. Um manifesto só é considerado completo quando os arquivos correspondentes continuam presentes. Downloads anteriores no cache da biblioteca são reutilizados sem duplicar os modelos. O navegador ainda pode remover dados em navegação privada, por limpeza manual ou por suas regras de armazenamento. Falta de memória, suporte de GPU ou conexão do download não impede as consultas do núcleo.

Ao fechar ou sair da central, os workers liberam memória, mas não apagam os arquivos. Ao reabrir, a tela mostra **Salvo neste aparelho** e recupera a escolha de usar o modelo local. A instalação transmite os arquivos diretamente para o cache sem criar o modelo de inferência: a voz é aberta ao tocar **Ditar**; o modelo de conversa é aberto na próxima pergunta, quando ativado. Reaberturas com arquivos completos não repetem os downloads. Arquivos removidos ou incompletos são recuperados na abertura ou retomada, quando a preparação automática estiver ativada. Falta de espaço mostra um aviso e não é apresentada como instalação salva. A conversa local só é baixada em aparelhos com WebGPU e shader-f16; os demais continuam com o núcleo Fama. Os caches são separados por navegador e endereço do site.

No cadastro, a autorização opcional para armazenar a IA neste aparelho vem separada dos Termos de Uso e começa desmarcada. Aceitar solicita armazenamento persistente ao navegador e ativa a preparação após entrar, inclusive na criação da empresa. Recusar permite criar a conta normalmente e impede o download automático neste navegador. O navegador pode aceitar ou negar a persistência sem mostrar um diálogo do sistema operacional. Não há acesso às fotos ou documentos do usuário. **Preparar automaticamente ao abrir**, nas configurações locais, permite mudar a escolha; **Pausar**, no resumo, interrompe e desativa a preparação até nova autorização.

**Resumo geral** aparece no topo da área de trabalho, mesmo quando a navegação abre outro módulo. Mostra até quatro indicadores e três prioridades de registros autorizados, sem esperar a preparação dos modelos. Ao trocar empresa ou durante o carregamento, valores anteriores ficam ocultos. As preferências administrativas continuam restringindo fontes e ações. Após atualizações, um pedido por um worker antigo recebe o bundle atual compatível, evitando a falha por hash removido.

Depois de preparar a voz, use **Ditar**. A gravação termina ao concluir ou após 20 segundos. A transcrição aparece no campo: revise e envie. O áudio não é enviado ao servidor Fama nem a terceiros, não é persistido e é descartado após a tarefa. O microfone só é solicitado nessa ação e é liberado ao terminar, cancelar, ocultar a página ou sair da central. Uma permissão concedida depois do cancelamento também encerra o fluxo.

**Ouvir resposta** usa exclusivamente uma voz marcada como local pelo navegador. Se não houver português local, instale a voz nas configurações do dispositivo; não há substituição por síntese remota.

O texto do modelo aparece em **Sugestão do modelo local**, separado dos resultados dos registros. As sugestões podem estar erradas: são recusadas quando contêm números sem apoio nos resultados ou alegações de ações executadas. Os cartões, IDs e formulários vêm do núcleo, nunca do modelo. O modelo não altera cadastros nem dispara pagamentos, exclusões ou mensagens.

## Recuperação e estabilidade

Celulares e tablets usam o modo leve do núcleo Fama: mesmo com WebGPU ou uma preferência anterior ligada, não instalam nem abrem Qwen. Um computador que informa menos de 8 GB de memória também usa esse modo; computadores sem essa informação ainda precisam de WebGPU com shader-f16. Os arquivos anteriormente salvos são preservados. A transcrição local permanece disponível quando o aparelho não informa menos de 4 GB de memória, e a leitura usa a voz local do sistema operacional. No celular, o worker de voz é encerrado assim que a transcrição termina. Nenhum áudio é enviado a uma API externa.

O runtime é gravado usando o fluxo de rede uma única vez, sem clonar uma resposta cujo corpo poderia ficar inteiro acumulado em memória. A leitura seguinte vem do cache. Inspeções de arquivos fecham os fluxos de corpo que usam apenas para conferir metadados. Um carregamento de inferência cancela o download de outro modelo; preparação em segundo plano não começa enquanto há outra tarefa local ativa. Erros liberam workers que podem ter alocado parte do modelo. Entradas inválidas são recusadas antes de criar o pipeline, e a sugestão local recebe um trecho limitado dos resultados, com até 128 tokens novos.

O resultado do núcleo aparece assim que a consulta termina; a sugestão local é acrescentada depois, sem bloquear a próxima pergunta. Uma nova conversa cancela a geração anterior e ignora respostas atrasadas. A preparação automática salva os arquivos, mas a geração com o modelo local continua sendo uma escolha explícita; escolhas existentes são mantidas. Workers de inferência ociosos são liberados após 30 segundos, sem apagar arquivos. Uma gravação ou autorização de microfone em andamento impede essa liberação. Cancelar o carregamento de voz libera o bloqueio para uma nova tentativa.

As consultas de configuração, acesso, registros e conexão da assistente têm prazo máximo e cancelamento. Consultas simultâneas de configuração e acesso são agrupadas. Uma falha temporária de configuração mantém a última configuração validada; acesso negado ou resposta inválida remove essa configuração. Falha no primeiro carregamento mostra a recuperação e não é apresentada como empresa sem registros. Um snapshot offline é validado e limitado à empresa, pessoa e permissões atuais antes de ser exibido. Falhas de autorização não recorrem ao snapshot.

O Control carrega os módulos independentemente: um módulo indisponível não descarta os demais. Módulos sem uma leitura bem-sucedida exibem uma opção de tentar novamente; módulos já carregados mantêm o último resultado em falhas temporárias, com aviso. As principais gravações não são repetidas automaticamente e bloqueiam cliques duplicados enquanto estiverem pendentes. Respostas de uma gravação não cruzam trocas de empresa; uma falha de conexão pede que os registros sejam atualizados antes de repetir a ação.

Cada atualização conserva os arquivos estáticos das duas versões anteriores, incluindo dependências de telas carregadas sob demanda. A próxima compilação descarta versões mais antigas para limitar o crescimento. Documentos HTML usam `Cache-Control: no-store`; o fallback do worker local continua disponível para um hash antigo ausente. Essa proteção reduz falhas de navegação em abas abertas durante uma atualização.

## Ferramentas operacionais

| Função | Pergunta de exemplo | Resultado |
| --- | --- | --- |
| Prioridades | `Por onde começar?` | Plano de ação com pendências cadastradas. |
| Consulta entre módulos | `Agenda de hoje e contas a receber` | Blocos separados para os módulos autorizados. |
| Agenda e equipe | `Planejar agenda da semana` | Carga cadastrada e horários estimados. |
| Períodos | `Agenda da próxima semana` | Semana civil seguinte; também ontem, hoje, amanhã e intervalos. |
| Cliente 360 | `Cliente 360: nome completo` | Propostas, visitas, ordens, contratos e garantias associados pelo nome exato. |
| Financeiro | `Fluxo de caixa` | Vencimentos e entradas/saídas previstas; não é saldo bancário. |
| Comparação | `Comparar financeiro` | Mês atual e anterior, por vencimento dos registros marcados como pagos. |
| CRM | `Diagnóstico do funil do CRM` | Estimativas comerciais por etapa. |
| Mensagens | `Mensagem para orçamento: ORC-001` | Texto para revisar e copiar. |
| Cronograma | `Cronograma da agenda: nome do técnico` | Compromissos pendentes de hoje em ordem de horário. |
| Comando natural | `Criar despesa com compra de cloro no valor de 450 reais amanhã` | Descrição, valor e vencimento preparados para revisão. |
| Agendamento | `Agendar visita para João Silva amanhã às 14h com técnico Marcos Lima` | Rascunho com os dados informados e nomes disponíveis. |
| Cálculo | `Calcule 450 * 1,10` | Resultado calculado por parser aritmético, sem eval e sem alterar registros. |
| Orientação | `Como montar um orçamento?` | Etapas de uso do módulo. |

Rascunhos disponíveis: clientes, leads, agendamentos, orçamentos, contratos, ordens de serviço e lançamentos. Itens e preços de orçamento são selecionados no catálogo real da empresa. O registro só é criado ao salvar o formulário. Respostas personalizadas do Control continuam com correspondência exata e não executam código.

A agenda sugere visitas de 60 minutos entre 8h–12h e 14h–18h, de segunda a sexta. Durações ausentes usam 60 minutos e são identificadas como estimativas. Não calcula deslocamento, folgas nem disponibilidade externa. Homônimos impedem associações ambíguas.

Valores contratuais, propostas e potencial de vendas não são recebimentos. O cadastro financeiro desta consulta não possui vínculo suficiente para atribuir dívidas individuais aos clientes. O comparativo usa vencimentos, pois não há data de liquidação nesses registros.

## Acesso e privacidade

`GET /api/assistant` verifica a sessão e informa o núcleo interno. `POST /api/assistant` aceita somente pergunta, módulo, até quatro perguntas anteriores, cliente em foco e fuso. Não aceita um contexto de registros vindo do navegador. O servidor verifica empresa/plano ou administrador, origem, limites, preferências e permissões, e consulta os dados pelos endpoints autenticados existentes. No Control, emails de contas, metadados de auditoria e contatos/detalhes de privacidade não entram na resposta.

O navegador envia perguntas ao próprio Fama para consultar os registros. Apenas a resposta autorizada e um histórico curto de perguntas são usados pelo modelo no dispositivo. Conversas ficam na memória da tela e são descartadas ao sair, trocar empresa ou atualizar a revisão da configuração. A prévia do Control usa registros fictícios. `/api/fama-ai` mantém compatibilidade com o painel financeiro anterior.

## Modelos e reprodução

- Biblioteca: `@huggingface/transformers` 3.8.1 (Apache 2.0).
- Qwen3: `onnx-community/Qwen3-0.6B-ONNX`, revisão `da1453100cf3ff33ef56d17983fc7a8648706db6`, `q4f16`; base Qwen3 sob Apache 2.0.
- Voz: `onnx-community/whisper-tiny`, revisão `ff4177021cc41f7db950912b73ea4fdf7d01d8e7`, `q8`; base publicada `openai/whisper-tiny` sob Apache 2.0.
- O build copia os binários WASM e módulos do ONNX Runtime para os assets do Fama. Não carrega scripts de CDN externos.

Referências dos modelos: https://huggingface.co/Qwen/Qwen3-0.6B e https://huggingface.co/openai/whisper-tiny. Modelos pré-treinados de terceiros não são apresentados como treinamento próprio do Fama.

## Verificação

Execute `npm run typecheck` e `npm test`. Os testes cobrem consultas, períodos, cálculos, comandos, isolamento, autenticação, permissões, limites de download, processamento local com fixtures e cancelamentos, incluindo permissão tardia do microfone. A regressão de persistência usa a biblioteca real de carregamento dos arquivos, CacheStorage simulado compartilhado entre instâncias de workers e ciclos reais de montagem/desmontagem do hook React; cobre abertura automática sequencial, reabertura sem downloads, retomada com arquivo removido, recusa de armazenamento, runtime, pesos externos, migração do cache antigo, preferências, interrupção, cota e armazenamento negado. O bundle real é inicializado em um ambiente de worker de navegador sem WebGPU e instala os arquivos de voz com downloads simulados, sem inferência; testes HTTP do Worker de produção verificam a recuperação do hash antigo. O resumo renderizado é conferido sem valores de módulos restritos ou da empresa anterior. Não persiste perguntas, áudio nem registros. A qualidade real de transcrição e geração e o suporte do hardware precisam ser conferidos no dispositivo com os modelos baixados; fixtures não comprovam esse desempenho.
# Fama IA no WhatsApp

O uso interno da equipe está disponível em Configurações → Fama IA no WhatsApp. Cadastre o ID do número oficial, o token de acesso e a chave secreta do aplicativo Meta. O servidor verifica o número, criptografa os segredos e mantém a IA pausada. Os tokens de acesso e a chave secreta não retornam ao navegador depois de salvos.

Configure o endereço de recebimento e o token de verificação mostrados na tela na Meta, assine o campo de mensagens e atualize a confirmação. Depois selecione o usuário da empresa, confira seu telefone pessoal com DDI e DDD e autorize o recebimento. Ative a IA quando houver confirmação do callback e ao menos um telefone autorizado.

As perguntas por escrito usam o mesmo núcleo Fama e os registros da própria empresa. A identidade, o plano e as permissões são verificados em cada consulta e novamente antes do envio. Números desconhecidos, usuários inativos, contas suspensas e eventos sem assinatura válida não recebem dados. Duplicatas não repetem respostas; uma falha sem confirmação após enviar não provoca outro envio automático. O histórico recente é criptografado e muda junto com o acesso do usuário. O WhatsApp não carrega modelos pesados nem os arquivos de voz do navegador.

Os cronogramas enviados manualmente usam a conexão da empresa e o horário de São Paulo, respeitando os módulos liberados. A Meta controla a janela de atendimento e o uso de modelos aprovados para mensagens iniciadas pela empresa. Não houve envio real nesta revisão. A bateria e os limites estão em [TESTES_2026-10-03.md](TESTES_2026-10-03.md).

## Controle central de blocos

O Fama Control aplica regras gerais, por empresa e por pessoa em **Blocos do sistema**. A regra mais específica prevalece. A IA recebe somente os dados dos blocos efetivamente liberados, inclusive quando o usuário é proprietário. Remover Fama IA impede abrir a central, preparar modelos automaticamente ou consultar a API, e interrompe a assistente dessa pessoa no WhatsApp. Uma mudança de acesso descarta o contexto e histórico anteriores; os arquivos dos modelos continuam salvos.


## Conectar Cloudflare Workers AI

A integração em System e Control usa a REST API do Cloudflare Workers AI pelo servidor. Configure em cada Site e publique para aplicar:

| Variável | Valor ou função |
| --- | --- |
| `FAMA_AI_PROVIDER` | `cloudflare` |
| `FAMA_AI_GENERATIVE_ENABLED` | `true` para ativar; `false` para pausar |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare do proprietário do token, com 32 caracteres hexadecimais |
| `CLOUDFLARE_AI_TOKEN` | Token de API Cloudflare com permissões de Workers AI, armazenado como **segredo** |
| `FAMA_AI_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` por padrão |
| `FAMA_AI_MAX_TOKENS` | `1024` por padrão, limitado a 128–2048 tokens de saída |
| `FAMA_AI_TIMEOUT_MS` | `20000` por padrão, limitado a 1000–30000 ms |

A chave já cadastrada sob o nome antigo `ANTHROPIC_API_KEY` é reutilizada como token Cloudflare quando não há `CLOUDFLARE_AI_TOKEN` ou `CLOUDFLARE_API_TOKEN`. Essa compatibilidade evita recadastro; o token só é enviado a `api.cloudflare.com`. Novas configurações usam `CLOUDFLARE_AI_TOKEN`. Nunca use `NEXT_PUBLIC_` ou `VITE_` e nunca coloque segredos no Git ou no chat.

A consulta de disponibilidade informa a configuração sem gerar inferência. Quando habilitado, o servidor envia ao Cloudflare somente a pergunta, até quatro perguntas anteriores limitadas e um trecho de até 12.000 caracteres da resposta interna autorizada. O bootstrap completo, sessões, tokens, anexos e áudio ficam fora da requisição.

**Sugestão do Workers AI** aparece separada dos registros. Cálculos, cartões, IDs, ações e formulários permanecem determinados pelo núcleo Fama. Números sem apoio nos dados e alegações de ações executadas são recusados. O modelo não recebe ferramentas para alterar registros. Uma sugestão em nuvem válida dispensa a geração local naquela resposta.

Sem token ou conta, com a conexão pausada ou diante de erro, limite, timeout ou resposta inválida, as consultas internas continuam funcionando. Não há repetição automática de inferências. Cancelar interrompe a requisição; uma chamada já recebida pelo provedor pode ter sido contabilizada.

`POST /api/assistant/connection-test` é um diagnóstico de serviço desativado por padrão. Ele exige `FAMA_AI_CONNECTION_TEST_ENABLED=true` e `FAMA_AI_CONNECTION_TEST_SECRET`, com credencial aleatória de 32 bytes em hexadecimal no cabeçalho `x-fama-ai-test-token`. Recusa origem externa e limita repetições no mesmo processo. Usa somente uma frase sintética e até 64 tokens de saída, sem consultar dados de empresas. Após a validação, defina `FAMA_AI_CONNECTION_TEST_ENABLED=false`, remova o segredo temporário e republique. Desativado, o endpoint recusa todas as chamadas, mesmo com uma credencial antiga.

Referências: https://developers.cloudflare.com/workers-ai/get-started/rest-api/ e https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/

### Verificação em produção — 13/10/2026

System e Control confirmaram uma inferência real do modelo configurado com HTTP 200 e a resposta sintética “Conexão com Workers AI confirmada.”. Isso valida o token, a conta, o modelo e a comunicação a partir dos dois servidores; não substitui a conferência das sugestões com os registros da empresa.

A leitura das preferências retornava 503 porque a migração de bloqueio de acesso direto havia revogado o `SELECT` de `fama_ai_settings`. A migração `20261013161922_restore_public_assistant_preferences_read.sql` restaura somente a leitura das preferências globais com RLS. Consultas aos registros continuam autenticadas e as gravações de configuração continuam restritas ao Control. Ambas as rotas `/api/ai-settings` voltaram a responder 200 sem alterar a configuração salva.
