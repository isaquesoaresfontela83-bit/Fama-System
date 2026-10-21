# Estado da implantação híbrida — 21/10/2026

Lançamento conjunto: **15.7.0 / 2026-10-21-hybrid-01**.

## Publicações de teste

- Fama System: https://fama-system.isaquesoaresfontela8.chatgpt.site — versão Sites 233; fonte `d526ed356a2cdf655c0f8acfd3e679883bbbc68f`.
- Fama Control: https://fama-control.isaquesoaresfontela8.chatgpt.site — versão Sites 85; fonte `b4585365bfcf975c5dc96b2e9bcc3ad52c07548d`.
- Os dois endpoints `/api/health` retornaram HTTP 200, versão 15.7.0 e o mesmo release ID. Os endpoints temporários de transferência estão desativados (401 sem autorização), e as variáveis FAMA_MIGRATION_* foram removidas.
- Os domínios principais `famasystem.online` e `control.famasystem.online` continuam na instalação anterior, que informou 15.4 nas verificações desta sessão. Não houve troca de DNS.

## Render

Workspace confirmado pelo contexto existente e pela descoberta: Fama system (`tea-dbcgqg3rjlhs73be8ojg`).

| Aplicação | Serviço gratuito | Painel | URL reservada |
| --- | --- | --- | --- |
| System | srv-dbchh71kjs5s73ef2ggg | https://dashboard.render.com/web/srv-dbchh71kjs5s73ef2ggg | https://fama-system-api.onrender.com |
| Control | srv-dbchhduktt5c73cukph0 | https://dashboard.render.com/web/srv-dbchhduktt5c73cukph0 | https://fama-control-api.onrender.com |

Branch: `deploy/hybrid-15.7.0`. Commit compilado: `85b8b290e1380f934141c8a1c04b22e599e6befc`. Deploys: System `dep-dbchin7b9u1s73cqbt20`; Control `dep-dbchip8m7kps73a07te0`.

Os dois builds corrigidos compilaram e exportaram suas imagens. As APIs **ainda não estão operacionais**: o início foi interrompido pelo verificador de persistência porque `FAMA_POSTGRES_URL` ainda não está configurada. Nenhuma base vazia foi criada. Auto-deploy está desativado.

O `render.yaml` na raiz define duas APIs e duas interfaces estáticas com proxy das rotas API na mesma origem. Foi validado estruturalmente contra o schema oficial Render 2020-12. Ainda precisa ser aplicado pelo painel ou API de Blueprints; a ferramenta MCP de criação de estáticos não expõe regras de rewrite. Os sites estáticos Render ainda não foram criados. Não declarar proxy/cookies como homologados antes da validação real.

## Verificações

- 4 testes híbridos do System e 4 do Control passaram nesta sessão, incluindo migração em banco de testes, isolamento de esquemas, preservação de valores criptografados, recusa de sobrescrita e transporte de rede sem repetição de mutações.
- 2 testes do WASM comprimido do System passaram.
- A verificação de versão, lançamento, catálogo, integrações e permissões dos dois projetos passou.
- Corrigido o empacotamento de arquivos WASM acima de 25 MiB e a exclusão indevida de `vendor/` pelo contexto Docker.

## Bloqueio e continuação

A revisão automática de aprovação bloqueou a solicitação autenticada de um snapshot privado pelo endpoint de transferência. Motivo informado: falta de autorização explícita do usuário para essa transferência sensível. Não houve captura de banco nesta sessão. Não contornar o bloqueio com outra consulta, endpoint, cópia indireta ou credencial.

Antes de retomar, obter autorização explícita do usuário para copiar os bancos auxiliares atuais para o Supabase, transportar as chaves originais de criptografia e demais credenciais de backend para a Render e concluir a configuração pelo painel da Render quando necessário.

Depois da autorização:

1. Confirmar a fonte real dos bancos atuais dos dois domínios e sua correspondência com as cópias de teste; não presumir que os D1 são iguais.
2. Obter backups atuais e chaves originais por transferência autenticada e criptografada. Criar a conexão PostgreSQL de menor privilégio e validar TLS.
3. Importar em esquemas privados separados, conferir todos os registros e preservar os valores criptografados; nunca usar `--empty-test` em produção.
4. Configurar as variáveis privadas nas duas APIs, os endereços internos e a mesma chave de ponte; preservar as configurações e chaves dos provedores.
5. Aplicar o Blueprint para as interfaces e regras de proxy, configurar FAMA_PUBLIC_URL com os endereços reais e testar login, MFA, alternância, cookies, isolamento de empresa, planos, pagamentos, APIs e backups.
6. Só então trocar os domínios e conferir ambos. Manter retorno compatível e remover qualquer mecanismo temporário de transferência.
