# Fama Liquid Glass — 15.22.2

Material translúcido inspirado no Liquid Glass: superfícies azuis e brancas, desfoque, saturação, brilho nas bordas e profundidade. Suporta tema escuro, menor transparência, maior contraste e impressão. Desfoque reduzido no celular, sem animação contínua ou dependência JavaScript no cliente.

Extensão aditiva sobre a produção 15.21.0: `glass-main.mjs` envolve `pedidos-main.mjs`, preservando os 123 módulos System e 56 Control. Não recompilar as fontes antigas de apps/. `entry.mjs` injeta apenas uma folha CSS externa nas respostas HTML e preserva os handlers, cookies e políticas de segurança. A folha usa `:has([data-fama-glass-style])` para não modificar atributos controlados pela hidratação React.

Validação: `node --test features/liquid-glass/glass.test.mjs`, `node --test features/pedidos/pedidos.test.mjs` e `node apps/system/scripts/verify-companion.mjs apps/control`. Os 20 testes e o verificador conjunto passaram. Os dois pacotes passaram pela conferência dos hashes dos módulos e dos bindings em produção antes da tentativa de ativação. As páginas de acesso dos dois domínios foram conferidas no navegador; a área autenticada e o viewport móvel não foram inspecionados.

`deploy.mjs` roda pela conexão Cloudflare autenticada. Recebe `{baseline,entry,css}` e `activate=false` para conferência. Herda todos os bindings, ASSETS e a compatibilidade existente. A ativação verifica a base outra vez e tenta restaurar a versão anterior caso a segunda publicação falhe. Depois de publicar, conferir CSS, páginas de acesso, módulos frontend e ambos os domínios.

Estado em 06/11/2026: publicação conjunta concluída após autorização explícita do proprietário. Os módulos anteriores foram lidos de volta e conferidos por hash; ambos os endpoints de saúde retornam 15.22.2. Detalhes em `../../docs/CLOUDFLARE-STATUS.md`.

## Animação dos botões — 15.22.2

Hover em mouse preciso: elevação de 2 px, brilho de 6% e sombra suave em 180 ms. Ao pressionar: escala de 98% em 140 ms. Botões desabilitados ficam excluídos; preferência por movimento reduzido e impressão desativam a animação. A atualização preserva os ajustes publicados em 15.22.1 para blur móvel e acessibilidade. A base anterior à atualização está em `baseline-15.22.2.json`. O publicador agora substitui apenas os três módulos conhecidos da extensão após verificar a base inteira.

## Barra inferior — 15.22.3

A barra `workspace-mobile-dock` usa o mesmo vidro do tema. Entrada de 650 ms, salto do ícone selecionado de 620 ms, hover elástico com elevação de 6 px e escala de 108%, giro de 90° no botão Novo, resposta de pressão ao toque e indicação de menu aberto. O destaque Novo pulsa três vezes, sem animação contínua permanente. Preferência de movimento reduzido desativa todos esses movimentos. Base anterior: `baseline-15.22.3.json`. A navegação e as permissões originais não são alteradas. A barra exige sessão; sua interação visual não foi conferida com uma conta real.
