# Layout do Water Control

O Control usa a mesma folha `professional-layout.css` do Water System. Os ajustes específicos ficam em `apps/control/app/control-system-layout.css`, preservando as telas, navegação, autenticação e permissões existentes. A tela de entrada passa a usar uma composição com cartão e a alternância de tema fica acessível também no computador.

A barra inferior reproduz o estilo do System e oferece Início, Empresas, Novo, Financeiro e Mais. Os atalhos chamam a navegação existente; Novo abre o cadastro de empresa já presente e Mais abre o menu do Control. A barra só aparece enquanto o painel autenticado está montado, sem ampliar permissões. A assistente flutuante fica acima dela.

A versão em produção adiciona as duas folhas concatenadas como `control-system-layout-15.23.31.css` e o cliente `control-dock-15.23.31.mjs` apenas no Control, pelo adaptador `features/water-brand/entry.mjs`. O identificador de lançamento é compartilhado pelos dois serviços. Os recursos da gestão de verificação em duas etapas da versão anterior são preservados.

`deploy-connected.mjs` trabalha sobre as versões ativas recuperadas da Cloudflare. A fase `prepare` calcula os hashes e verifica os recursos existentes; `stage` envia as duas versões com todos os módulos e bindings herdados; `activate` verifica concorrência e ativa as duas. A ativação confere novamente hashes, módulos e nomes/tipos dos bindings. Se algo falhar, tenta restaurar apenas as versões que esta operação ativou. Não compilar ou publicar a árvore histórica sobre a produção.

Validação: execute `npm test`, `npm run check:syntax`, `npm run check:companion` e a verificação de sintaxe do publicador. Confira visualmente a entrada e, com uma sessão autorizada, o painel em tamanhos de celular e computador, nos dois temas. Não use contas, dados ou operações reais para teste automatizado.
