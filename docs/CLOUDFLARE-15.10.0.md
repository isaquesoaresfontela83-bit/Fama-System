# Cloudflare — gráficos por módulo 15.10.0 — 22/10/2026

Fama System e Fama Control **15.10.0**, lançamento `2026-10-22-module-charts-01`, ativados e conferidos nos dois domínios existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `23bf135c-62ac-4df4-a370-280b582df8e5` | `c472d7c3-25c8-4b6c-b004-3eb61ae5a16c` |
| Control | https://control.famasystem.online/ | `15496083-fb79-4f35-b084-340d49ea6b7e` | `c57452a6-0591-441d-8dc3-e2508b71a79d` |

## Comportamento publicado

- A página inicial acrescenta até seis gráficos visíveis conforme os módulos autorizados: receitas e despesas, evolução das receitas, orçamentos, serviços, agenda e pipeline. A disponibilidade de áreas é apresentada quando este acesso não possui registros operacionais autorizados.
- Todas as abas do System possuem ao menos um indicador correspondente, incluindo as sete divisões do financeiro. Os gráficos locais e a biblioteca usam as mesmas definições. Cadastros sem registros exibem uma mensagem explícita, sem dados demonstrativos em produção.
- A nova aba **Gráficos**, no menu principal, reúne 33 definições no acesso completo. Oferece busca, área, período, datas personalizadas, sete formatos, filtros favoritos, personalização da disposição, tabela de valores e abertura do módulo correspondente.
- A biblioteca respeita plano e permissão da visão geral. Os dados de cada gráfico dependem da permissão de seu módulo. System e Control descrevem essa cobertura na permissão existente, sem criar um novo direito pago ou ampliar acesso.
- Usuários, chamados, privacidade, conversas, notas fiscais, compras e conciliação usam os endpoints existentes. Carregamento, falha e resultado vazio têm estados distintos; as consultas são canceladas ao mudar empresa ou permissões. As abas de ajuda, plano e configuração mostram a disponibilidade real de módulos por área, sem simular utilização.
- O mapa continua removido da visão geral, substituído pelo painel **Seu dia de trabalho** da 15.9.3. Saldo, prioridades e formulário inline para adicionar outra conta foram preservados.

## Validação

- 43 casos do System passaram (42 no conjunto principal e o novo caso de permissão confirmado com os quatro testes de planos); 17 do Control passaram. Incluem cobertura de todas as abas e divisões financeiras, datas de Brasília, cálculos em centavos, permissões, troca de empresa, respostas tardias, erro, tentativa novamente e navegação.
- Ambos os builds Cloudflare e o verificador conjunto concluíram. Os quatro pacotes tiveram checksum SHA-256 conferido antes da ativação. Foram conferidos por tamanho e SHA-256, após leitura de volta, 156 arquivos JS/CSS System e 57 Control, incluindo dependências compartilhadas, imports dinâmicos e arquivos preservados de builds anteriores.
- Interface conferida com componentes reais e dados fictícios em desktop e 390 px: aba Gráficos, filtros por área, mudança de formato, tabela de valores e gráfico de estoque no celular. Não foi feito login com credenciais reais do proprietário.
- Após a ativação, as duas páginas de acesso foram inspecionadas visualmente e não apresentaram erros de aplicação no console. Ambos os `/api/health` retornaram `ok`, versão `15.10.0` e o mesmo release ID, às 23h00 UTC de 22/10/2026.
- Os 41 bindings System e 28 Control foram herdados e a coleção ASSETS mantida. Foram atualizados somente código e arquivos públicos; nenhum dado operacional, segredo, plano ou credencial foi alterado.
- O usuário autorizou expressamente o envio do código atualizado ao GitHub após a inclusão dos gráficos. Ramo de entrega: `release/15.10.0-charts`. O ramo main antigo permanece fora da publicação.

## Pacotes conferidos

- system-server: `d58213f96f72a82fb6e3f51c3618c28f1e43b4a4d27b2314a27275aa85d466ff`
- system-client: `397d663089a8431d47bf1c36bf268e7d0696b054be30e0d6ef1f92d44c41e106`
- control-server: `3aacb61d55e8ec3da7858a78148ebb193039ffa999e5e2cde26fef74c323a1fa`
- control-client: `51188aefb23e0ac8ead846b321d934936355a0dc09e73f80234870c528527751`

Histórico anterior: [15.9.3](CLOUDFLARE-15.9.3.md). Cloudflare continua como destino das aplicações completas, com Supabase, D1 e Baileys originais. Os serviços Render antigos não foram suspensos ou excluídos neste trabalho.
