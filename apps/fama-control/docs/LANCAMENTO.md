# Fama System e Fama Control — versão final v15.0

Versão final v15.0 de 3 de outubro de 2026, com estabilidade, IA local, WhatsApp e blocos por pessoa e empresa. Domínios: https://famasystem.online e https://control.famasystem.online. As conferências de serviços externos abaixo mantêm as datas em que foram realizadas. A bateria atual está registrada em [TESTES_2026-10-03.md](TESTES_2026-10-03.md): 209 testes no System, 169 no Control, 18 verificações históricas do WhatsApp e 15 verificações das regras de blocos no banco real, todos aprovados. A conexão a um número WhatsApp real depende da preparação na Meta.

## Evidências no ambiente real

- Os dois sistemas estão ativos e públicos, com autenticação própria por e-mail e senha.
- Supabase está ativo e saudável. Todas as tabelas públicas têm RLS habilitado. As tabelas usadas exclusivamente pelo servidor permanecem sem acesso direto do navegador.
- Cadastro público habilitado, com e-mail e confirmação automática. Essa consulta não comprova a entrega de e-mails de recuperação pelo serviço de envio.
- Validação real registrada em 1 de outubro, às 16:25:55 UTC: 20 verificações aprovadas de criação de empresa isenta e usuários, login, edição de funções e módulos, gravação e leitura, isolamento entre empresas, desativação e reativação de usuário, bloqueio e liberação da empresa, mensalidade e limpeza das contas temporárias. O resultado foi consultado novamente no banco nesta revisão; esses 20 passos não foram repetidos com novas contas.
- Conferência da Asaas em 2 de outubro, às 21:27:46 UTC: conta de produção `APPROVED`; webhook configurado, habilitado, sem interrupção e com todos os eventos exigidos. O receptor respondeu a uma sondagem autenticada sem movimentação financeira. `billing.ready = true`.
- Duas conexões Asaas cadastradas responderam com aprovação em produção. As duas credenciais armazenadas estão criptografadas.
- Configuração fiscal atual: emissão pelo portal nacional oficial, sem chave de API fiscal, sem campos obrigatórios ausentes na conferência. A emissão oficial e a anexação do documento continuam sendo etapas realizadas pelo responsável; o sistema não apresenta um rascunho como nota emitida.

## Correções desta revisão

- Autenticação com prazo de 10 segundos por chamada; acesso ao banco com prazo de 25 segundos por chamada. Uma interrupção permite nova tentativa, sem espera ilimitada pelo provedor.
- Chamadas de autenticação e dados recusam redirecionamentos inesperados, para não encaminhar credenciais a outro destino.
- Resposta de autenticação inválida não é interpretada como sucesso. Login distingue falha temporária, credenciais inválidas e limite de tentativas.
- Logout aceita apenas destinos internos válidos e impede endereços externos com barras invertidas ou caracteres de controle e ciclos de logout.
- Recuperação de senha e verificação MFA liberam o formulário para nova tentativa quando há falha de conexão.
- Persistência da IA local corrigida: reconhece os modelos e o runtime salvos ao reabrir, mantém a preferência de uso e carrega os arquivos quando necessário. Sair da central encerra os workers sem apagar downloads. Reutiliza o cache anterior, verifica arquivos antes de indicar instalação salva e informa downloads incompletos ou falta de armazenamento. Uma pergunta comum não inicia automaticamente outro download quando os arquivos forem removidos.
- A IA Fama e a navegação otimizada anteriores foram preservadas. O núcleo Fama usa dados autorizados; texto e transcrição dos modelos locais são processados no aparelho. A primeira ativação desses modelos requer baixar arquivos públicos. Não existe dependência de API externa de inferência.
- Preparação automática ao abrir ou retomar o aplicativo: verifica os arquivos salvos e baixa apenas os ausentes em segundo plano, sem carregar o modelo de inferência durante a navegação. Downloads interrompidos reaproveitam o que já foi salvo; aparelhos sem WebGPU mantêm o núcleo Fama e a preparação de voz por CPU.
- Cadastro solicita autorização opcional para salvar os modelos e preparar automaticamente, separada do aceite obrigatório dos Termos. A recusa impede a preparação automática e não bloqueia a conta. O navegador decide se concede armazenamento persistente. O resumo e as configurações locais permitem pausar ou ativar novamente.
- Resumo geral no topo dos dois aplicativos, com indicadores e prioridades dos dados autorizados. Não depende do download da IA. Troca de empresa oculta dados anteriores durante o carregamento.
- Atualizações preservam a inicialização do worker em abas antigas: hashes removidos recebem o bundle atual, com os cabeçalhos de segurança mantidos.

- Carregamentos com prazos máximos, cancelamento e consultas simultâneas agrupadas. Falhas transitórias mantêm a configuração validada; negações de acesso e configurações inválidas a removem.
- Resposta do núcleo Fama disponível antes da sugestão local, com a próxima pergunta liberada. Cancelamento de voz permite nova tentativa; modelos ociosos liberam memória sem apagar arquivos e respeitam a espera por autorização do microfone.
- Gravações principais protegidas contra cliques repetidos e respostas após troca de empresa. Uma falha de conexão informa que é necessário conferir os registros antes de repetir a ação. Não há repetição automática de gravações.
- Bootstrap e snapshot offline validados; falha de carregamento não aparece como empresa vazia. O Control mantém módulos carregados durante falhas temporárias de outros módulos e oferece nova tentativa nos módulos indisponíveis.
- HTML sem cache e arquivos estáticos das duas versões anteriores conservados, com descarte limitado nas compilações seguintes, para reduzir falhas de navegação em abas abertas durante atualizações.
- Modo leve para celulares e tablets, mesmo com WebGPU ou uma preferência antiga de ativação: o núcleo Fama continua disponível, sem carregar o modelo grande. Computadores com memória informada abaixo de 8 GB também usam esse modo; a voz local exige ao menos 4 GB quando essa informação está disponível. Esses limites são uma política conservadora do produto, não uma garantia de capacidade do aparelho.
- Downloads do runtime consumidos uma única vez antes da leitura do cache; inspeções encerram fluxos de arquivos que não serão lidos. Preparação e inferência de modelos distintos não ocupam memória simultaneamente. Falhas liberam o worker, e a voz no celular libera seus recursos após a transcrição, mantendo os arquivos salvos.

## Verificação do software

As verificações de tipos e as compilações de produção passaram nos dois projetos. A suíte completa passou com 209 testes no System e 169 no Control: 378 aprovados, sem falhas ou testes ignorados. Testes novos cobrem falhas de conexão e resposta, recusa de redirecionamento, códigos de erro do login, destinos maliciosos de logout e nova tentativa nos formulários de recuperação e MFA. A regressão da IA cobre fechamento/reabertura sem downloads, retomada, preferência ligada/desligada, cache antigo, runtime, pesos externos e armazenamento negado ou sem espaço, com a biblioteca real de carregamento de arquivos e fixtures de cache/worker/React. A abertura automática também foi conferida com montagem React, o instalador e carregador reais de arquivos, retomada de cache removido e recusa de preparação. O bundle compilado inicia e instala os arquivos de voz em um ambiente de navegador sem WebGPU, com downloads simulados; o Worker de produção recupera hashes de versões anteriores. Não houve ensaio em um aparelho físico.

Regressões de estabilidade verificam corpo JSON sem resposta, cancelamento, requisição de gravação sem repetição, configuração transitória ou acesso negado, isolamento entre empresas, resposta interna antes da geração local, descarte de narrativa atrasada, reuso da voz após cancelamento, liberação de memória, proteção durante permissão do microfone e retenção limitada de arquivos de versões anteriores. O Worker compilado foi conferido com HTML `no-store`. As falhas de módulo do Control são simuladas com seu carregador real.

Os testes desta revisão também verificam o bloqueio do modelo grande antes de qualquer download ou inferência no celular, a recusa de comandos de abas antigas pelo worker compilado, a retomada de voz sem worker retido, o encerramento de um download concorrente, a recuperação após falha e o runtime sem duplicação por `Response.clone()`. Prompts e entradas de áudio são validados antes de alocar os modelos.

## Limites da comprovação

- Não foi realizado um pagamento, transferência ou emissão fiscal real nesta revisão.
- Voz, microfone, WebGPU, aparência e navegação não foram testados em um celular físico. Os testes de software não substituem essa conferência.
- A entrega de recuperação de senha por e-mail precisa de uma conferência de ponta a ponta com o serviço de envio; nenhuma mensagem foi enviada nesta revisão.
- O advisor do Supabase retornou um aviso: a proteção de senhas vazadas está desativada. Não há ferramenta disponível nesta conexão para alterar essa configuração de Auth. Orientação do provedor: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

As verificações acima identificadas como pendentes ainda precisam ser concluídas para comprovar todos os cenários de lançamento.

## Blocos do Fama System

Nova área no Control para adicionar, remover ou herdar 13 blocos, com regras gerais e exceções por empresa e pessoa, inclusive proprietários. Gravação com revisão e auditoria; controle no servidor, na navegação, na IA e no WhatsApp. Testes completos: 209 no System e 169 no Control, sem falhas. Mais 15 verificações de regras e isolamento no banco, com rollback e limpeza confirmada. Nenhuma regra real foi alterada durante a publicação.

## Fechamento da versão final

Identificação v15.0 nos dois sistemas e manuais atualizados em 03/10/2026. Os guias cobrem os 13 blocos, a prioridade das regras por pessoa e empresa, a preparação persistente da voz local, o modo leve no celular e os passos para conectar o WhatsApp.

A revisão dos registros de produção encontrou uma falha de validação de credencial na leitura das preferências públicas da IA pelo Control. Essa leitura agora usa a chave pública já configurada, como no System, sem depender da chave administrativa nem encaminhar a sessão do usuário. Os dois leitores recusam redirecionamentos, têm prazo de 10 segundos e validam a resposta antes de aplicá-la. A gravação continua exclusiva do administrador, com revisão e auditoria. A regressão cobre a chave usada na leitura e na escrita, redirecionamentos e a rejeição de respostas inválidas ou indisponíveis.

Foram repetidas as verificações de tipos, as compilações de produção e as suítes completas nesta entrega: 209 testes no System e 169 no Control, todos aprovados. As limitações de comprovação descritas acima permanecem registradas; a publicação não equivale a uma conversa real no WhatsApp nem a um ensaio em aparelho físico.
