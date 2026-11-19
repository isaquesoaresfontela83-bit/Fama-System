# Página comercial 15.23.6

Apresentação compacta em branco e azul-marinho: cabeçalho simples, introdução em duas colunas, planos resumidos, seleção de período, comparação completa expansível e contato comercial.

`view.mjs` é a fonte compartilhada pelos adaptadores SSR e navegador. `build.mjs` gera o bundle SSR e o mapa de recursos; os preços, limites e recursos continuam vindo do catálogo administrado no Control. A comparação herda os recursos dos planos anteriores somente quando o catálogo declara “Tudo do Basic/Plus”. Nenhum valor nem condição de acesso foi alterado.

`deploy.mjs` recupera os Workers atuais e valida a versão ativa e a proteção de cadastro pago. Substitui quatro módulos no System e um no Control, preserva todos os demais por SHA-256 e os 41/29 bindings. A leitura de volta confirmou os hashes dos 133/69 módulos preservados. Identificadores finais em `deployment.json`.

Verificação: sintaxe dos módulos, renderização React SSR com limites dinâmicos e estado de carregamento, cálculo de mensal/trimestral/anual. Navegador em produção: hidratação, seletor anual e link, expansão de 7 para 20 recursos, checkout anual sem oferta de teste. Não houve geração de cobrança ou transação. Regras de responsividade foram implementadas; não houve teste em aparelho físico.
