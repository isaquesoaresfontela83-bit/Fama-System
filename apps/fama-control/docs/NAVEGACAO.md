# Navegação dos módulos

A navegação usa IDs de telas no fragmento da URL, por exemplo `#agenda` e `#finance/bancos`. O histórico guarda até 32 telas, por usuário, empresa e conjunto de permissões. Históricos restaurados são validados novamente; mudanças de empresa ou permissão não restauram a tela do escopo anterior. Erros de sessionStorage não bloqueiam a navegação. Registros, buscas e credenciais não entram no histórico nem na URL.

O botão Voltar usa o histórico do navegador para mudanças realizadas nesta sessão. Para um histórico restaurado sem a entrada correspondente no navegador, retorna pela memória local sem sair para a página de login. Popstate de telas Fama no mesmo caminho é tratado em captura: Vinext 0.0.50 normalmente solicita novamente a árvore RSC até para mudanças apenas no fragmento. Navegações reais de página continuam com o framework.

Buscas do System são separadas por módulo e escopo durante a sessão. A posição de rolagem é restaurada depois que a tela foi montada, incluindo telas carregadas sob Suspense. No celular, o menu fecha ao escolher uma tela; o Control usa o drawer acessível do componente Sheet.

IA, financeiro, membros, manual e painéis de configuração do System são imports dinâmicos. O Control carrega IA, configuração da IA, gestão de contas e validação sob demanda. Passar o ponteiro ou focar a opção prepara somente o código daquela tela; não baixa modelos de IA, nem consulta dados. Downloads dos modelos continuam dependendo da ação explícita do usuário.

O Control monta apenas a área selecionada. A visão geral mantém os indicadores e alertas. O catálogo de orçamento, depois de aberto uma vez, fica montado e oculto nas outras áreas para preservar edições não salvas. Seus componentes não renderizam novamente ao mudar outra área. Configuração da IA deixa de consultar e atualizar em segundo plano ao sair das telas da IA. Planos e suporte carregam em paralelo com os demais dados do Control.

Verificação: `npm run typecheck`, `npm run build` e a suíte `tests/workspace-navigation.test.mjs`. A suíte usa o hook React com histórico de navegador simulado, incluindo captura de eventos antes do router; não é uma prova de tempo de resposta em aparelho real. Compare JavaScript inicial percorrendo somente `imports` do manifest de `app/cloriva-app.jsx` (System) ou `app/control-app.jsx` (Control), sem `dynamicImports`. Tamanho de código não mede sozinho o tempo total da página.
