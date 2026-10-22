# Cloudflare — contas e visão geral 15.9.3 — 22/10/2026

Fama System e Fama Control **15.9.3**, lançamento `2026-10-22-accounts-overview-01`, ativados e verificados nos dois domínios existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `a322281b-f3fc-4260-ba3e-978b143d595b` | `a9ad4e7b-3460-4ccc-8d7a-8f9042a21dba` |
| Control | https://control.famasystem.online/ | `1441427f-90a9-4dff-9b70-035e4bbafb9e` | `b520b5a7-2cb7-4d77-a237-e75fdb5454d0` |

## Alterações e validação

- A ação Adicionar outra conta abre o formulário dentro do seletor, sem navegar para /entrar nem encerrar a primeira sessão. Inclui cancelamento, mensagens de erro, bloqueio de e-mail já conectado e a etapa MFA existente.
- A visão geral substituiu o mapa Waze pelo painel Seu dia de trabalho: registros pendentes, visitas em rota, serviços em execução, próximos agendamentos e progresso da agenda. Filtros e registros respeitam as permissões dos módulos; os atalhos abrem registros e agenda. O saldo continua no topo.
- Foram preservados o acabamento profissional 15.9.1 e os controles de sessão 15.9.2, incluindo a consulta de metadados sem renovação de tokens a cada abertura, avisos entre abas e descarte de respostas antigas.
- 67 testes do System e 17 do Control passaram. Cobrem autenticação, duas sessões, MFA, edição, execução, seleção de clientes, navegação, prioridades e acesso aos dados. Os testes usam identidades e dados fictícios.
- Ambos os builds Cloudflare e o verificador conjunto concluíram. Os quatro pacotes enviados tiveram SHA-256 conferido antes de qualquer ativação; 118 arquivos JS/CSS System e 48 Control foram conferidos por bytes e SHA-256 na base de arquivos públicos. Alguns arquivos antigos usam MD5 no campo ETag; seus bytes também foram conferidos por SHA-256.
- Prévia com componentes reais conferida em desktop e 390 px: painel sem iframe de mapa, saldo no topo e formulário inline da segunda conta. As páginas de entrada dos dois domínios foram inspecionadas após a ativação; nenhum erro de aplicação no console. Avisos da extensão do navegador não pertencem ao aplicativo.
- Os dois /api/health retornaram status ok, versão 15.9.3 e o mesmo lançamento. O seletor publicado abriu o formulário sem mudar de URL. Não houve login real com a conta do proprietário, alteração de dados operacionais ou envio de mensagens.
- Os 41 bindings System e 28 Control foram herdados; a coleção ASSETS existente foi mantida. Os uploads ocorreram somente na base separada de arquivos públicos. Supabase e os D1 operacionais não foram alterados.
- As autorizações anteriores para publicação conjunta foram mantidas. O novo push GitHub foi rejeitado pela revisão automática por falta de autorização reconhecida para divulgar o novo código no repositório público. A autorização recuperada referia-se a outro commit. O código está nos commits locais `c7ea6fd` e `7426024`, branch `fix/accounts-overview-15.9.3`; não declarar envio ao GitHub.
- Não foi usado AppDeploy nem restaurado encaminhamento ao Render. Serviços antigos Render não foram suspensos ou excluídos neste trabalho.

## Pacotes conferidos

- control-client: `9cd803445bbd5323f0eab594ed00ce41e2cfff70286edd2b839bbc959e26f78a`
- control-server: `ad7abf05a27f04be483790e688917041f1e9431e568b529b640717c9cb979a71`
- system-client: `7232ba95473853cd20a5b7056de1fa13ef91fbfd8a920153272496a5eb3e1351`
- system-server: `7e9b1520df5d5f920aba689050f7dd39c9240c8ddf9f793e770e28819343fe3e`


