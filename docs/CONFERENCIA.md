# Conferência da entrega

## Verificações do pacote

- As versões de origem foram consultadas na hospedagem: System 99 e Control 37.
- Os commits locais correspondem aos commits informados nessas versões.
- Os repositórios estavam sem alterações locais.
- Todos os 412 arquivos versionados foram copiados, mantendo seu conteúdo e hashes.
- A estrutura atual do banco foi capturada por consultas aos catálogos PostgreSQL, sem ler dados de empresas ou credenciais.
- Os cinco arquivos SQL gerados tiveram a sintaxe conferida pelo parser PostgreSQL `pglast`. Isso verifica a sintaxe externa dos comandos; não executa o banco nem homologa cada corpo PL/pgSQL.
- O ZIP e os hashes serão conferidos pelo relatório automatizado `docs/provenance/export-verification.json` incluído na entrega.

Nenhuma publicação, alteração de banco ou criação de cobrança foi feita para preparar esta entrega. O snapshot SQL foi preparado para um Supabase novo; não foi aplicado a outro projeto nesta conferência.

## Validação funcional anterior

A versão 37 do Control passou anteriormente por 20 verificações reais de acesso descartável e limpeza: criação de empresa e usuários, login, funções, permissões, persistência, isolamento, suspensão/reativação, ativação explícita do bloqueio por vencimento e retorno à gratuidade. A empresa e os registros desse teste foram removidos. A validação se refere a esse fluxo; não comprova o funcionamento integral de todos os módulos do ERP nem o recebimento de Pix real.

O pacote inclui as suítes de teste originais e seus fixtures, para que possam ser executados no novo ambiente. A preparação do ZIP não repete nem substitui a homologação funcional.

## Referências históricas a revisar na cópia

A captura preserva as funções exatamente como existem. Três funções de backup/recuperação (`private.fama_control_daily_backup`, `private.fama_enrich_backup_payload` e `public.fama_control_restore_backup`) contêm referência dinâmica a `work_order_items`, que não aparece entre as tabelas da captura atual. Essa dependência deve ser conferida por quem configurar essas rotinas, antes de ativar os cron jobs de backup ou usar restauração. A sintaxe SQL válida não resolve uma dependência dinâmica ausente.

As fontes atuais também possuem domínios e uma lista de proprietário fixos, inventariados em `DOMINIOS-E-PROPRIETARIO.md`. Os modelos adicionados e o auxiliar Cloudflare são documentação/ferramentas de transferência; nenhum código original foi modificado para simular uma instalação já transferida.

No ambiente atual existem nomes de configuração de Pluggy e sessão sem referência direta nas fontes conferidas. Eles foram documentados sem afirmar que essas integrações estejam ativas.
