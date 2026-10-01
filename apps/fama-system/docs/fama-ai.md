# Assistente Fama IA

A implementação original foi adicionada pelo Codex no VS Code na branch `fama-control-final`, commit `658b77550904f4f139eb2196033e4115c2832cd2`. Esta integração reaproveita a assistente nas versões atuais do Fama System e do Fama Control, sem substituir seus fluxos de autenticação, acesso e mensalidade.

## Uso

- Fama System → **Fama IA**: selecione a empresa; consulte agenda, CRM, orçamentos, ordens, clientes, estoque, financeiro, equipe, garantias e contratos conforme suas permissões.
- Fama Control → **Fama IA**: consulte empresas, usuários, auditoria e solicitações de privacidade carregados no painel.
- Fama Control → **Configurar IA**: habilite a assistente, escolha funções, nome, mensagem inicial, limite de resultados, ações, conflitos e respostas personalizadas.

Exemplos: “resumo da gestão”, “agenda de hoje”, “agenda amanhã”, “agenda em 07/10/2026”, “conflitos na agenda”, “estoque baixo”, “resumo financeiro”, “pagamentos atrasados”, “orçamentos de hoje”, “contratos ativos”, “garantias vencidas”. Selecione o módulo e use `buscar: nome` para filtrar os registros.

## Comportamento e limites

A assistente usa regras locais. Não usa um modelo generativo ou uma API externa de IA; não há custo de tokens ou chave adicional para essas consultas. Interpreta as consultas programadas e respostas personalizadas por correspondência exata. Não produz uma conversa livre, conteúdo jurídico novo ou análise livre de documentos.

As consultas usam os registros já carregados da empresa selecionada. O servidor mantém as verificações de empresa, sessão, mensalidade e permissões. Coleções negadas são omitidas do resumo. As preferências globais só podem reduzir as funções; não concedem acesso a módulos. Não existe consulta cruzada de registros operacionais de empresas diferentes.

As ações abrem os módulos e formulários existentes. A pessoa revisa e salva; a assistente não paga contas, altera saldos, exclui registros ou efetua gravações por conta própria. Valores financeiros vêm dos lançamentos cadastrados, não da conferência de contas bancárias. A agenda detecta o mesmo técnico no mesmo instante; sem duração cadastrada, não conclui sobreposição entre horários diferentes. Datas seguem o fuso do dispositivo.

Conversas ficam apenas na memória da tela e são descartadas ao sair, trocar empresa, mudar permissões ou atualizar a revisão da configuração. Perguntas e registros não são enviados a um provedor de IA. O navegador consulta apenas as preferências globais a cada minuto e ao retornar à tela. O assistente fica indisponível se não puder validar a configuração.

## Backend e publicação

Migração compartilhada: `supabase/migrations/20261001210000_fama_ai_settings.sql` (aplicar uma única vez no projeto Supabase compartilhado).

- `public.fama_ai_settings`: uma linha global, com RLS; leitura de preferências pública e nenhuma gravação permitida a `anon` ou `authenticated`.
- `public.fama_save_ai_settings`: execução exclusiva de `service_role`; comparação de revisão, atualização e auditoria em uma transação. Uma revisão antiga recebe conflito, sem sobrescrever outro administrador.
- Control `GET /api/ai-settings`: compartilha somente preferências validadas, com `Cache-Control: no-store`.
- Control `POST /api/ai-settings`: verifica administrador real da plataforma, origem, limite de requisições e configuração antes de chamar a transação.
- System `GET /api/ai-settings`: lê a configuração no Supabase compartilhado com `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` já usados na autenticação. Consulta somente a tabela pública de preferências, sem chave privilegiada, perguntas ou dados operacionais. Essa leitura não depende do domínio do Control.

Publicar primeiro o Control e depois o System. Não há alteração da função Edge legada `fama-control`. Para validar: `npm run typecheck` e `npm test`. Os testes usam dados fictícios e cobrem datas, cálculos, fontes, permissões, isolamento, configuração, concorrência e falhas.
