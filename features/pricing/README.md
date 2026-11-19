# Planos pagos — 15.23.5

O cadastro de novas empresas exige checkout pago validado pelo mecanismo existente, que verifica plano, e-mail, status e consumo. Não há migração de organizações existentes. As regras e preços administrados no Control são preservados.

A página apresenta os planos antes da demonstração, com seletor mensal/trimestral/semestral/anual, preço mensal equivalente, total do período, descontos existentes e CTA para o checkout no ciclo selecionado. A tela de pagamento abre diretamente o formulário. SSR e cliente recebem as mesmas mudanças.

## Publicação

A extensão é aplicada sobre a produção recuperada, nunca sobre a árvore antiga de apps. `deploy.mjs` valida versões exatas e cada substituição antes de preparar os dois pacotes; herda os 41/29 bindings e ASSETS. Preserva o wrapper SEO e todos os módulos que não recebem as quatro alterações especificadas. Os quatro novos módulos são `pricing-main/core/assets/styles.mjs`. `entry.mjs` é a fonte do core, `client-assets.json` contém os dois bundles cliente ajustados e `patches.json` contém as substituições SSR/backend. O wrapper atualiza as referências de import para evitar mistura de versões React no navegador.

A chamada autenticada recebe `{versions, patches, entry, assets, css}` e `activate=false` para preflight; `activate=true` publica o conjunto. As versões de base estão em `deployment.json`. A correção subsequente do core sincronizou os imports dos bundles cliente; consulte o estado final em `docs/PRICING-15.23.5.md`.

## Verificação

`node --test features/pricing/pricing.test.mjs`, `npm test`, sintaxe dos bundles e verificação conjunta. QA em produção: página hidratada sem teste grátis, seletor anual atualiza valores e links, checkout recebe o ciclo anual e exibe o formulário sem oferta de teste. Nenhuma cobrança foi criada ou paga durante o QA. A criação autenticada de empresa com pagamento real não foi executada.
