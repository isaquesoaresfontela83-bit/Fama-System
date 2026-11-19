# Apresentação comercial 15.23.8

A página comercial usa a identidade do painel Fama, demonstração interativa, temas claro/escuro, quatro períodos de contratação e comparação dos recursos. A preferência usa a chave existente `fama-system-theme-v2` e é aplicada antes da folha de estilos.

Na produção, `entry.mjs` transforma somente as respostas comerciais reconhecidas do Worker existente. Sessões, consentimento legal, cadastro pago, checkout e APIs continuam sendo resolvidos pela aplicação atual. Os preços, limites, nomes e recursos vêm do catálogo público da aplicação, que já utiliza a conexão existente com o Control. O normalizador aceita o contrato público do Control e o contrato normalizado do System. A herança só ocorre quando o catálogo a declara. Se o catálogo não responder ou estiver inválido, o Worker devolve a página comercial anterior.

A fonte estática usa o retrato do catálogo conferido em 19/11/2026 para revisão visual. O build de produção embute os recursos sob um caminho próprio e reutiliza a marca original. O Control recebe somente o identificador conjunto de versão.

## Publicação

A versão 15.23.8 foi publicada em 19/11/2026 pela conexão autenticada da Cloudflare, usando `deploy-connected.mjs`. Os identificadores, hashes e verificações estão em `deployment.json`. A página está em https://famasystem.online/ e https://famasystem.online/planos.

O publicador conectado recebe os recursos preparados por `build.mjs`, o código de `entry.mjs` com o import renomeado para `presentation-catalog.mjs`, o normalizador e um retrato atualizado das versões, hashes e contagens dos dois Workers. Primeiro executar sem ativação, depois com `activate=true`. O código roda com APIs Web, sem exportar credenciais da conexão. Quando o ambiente da conexão restringir o acesso HTTP aos domínios, `verifyPublic=false` deixa a verificação pública pendente; ela precisa ser concluída por HTTP e navegador antes de registrar a publicação como verificada.

O fluxo manual `Publicar apresentação Fama System` é uma alternativa com sintaxe, verificação conjunta e testes. Ele requer os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` do repositório. As credenciais ficam no ambiente do job e são usadas apenas nas solicitações à API oficial da Cloudflare. Commits de documentação não disparam nova publicação.

`deploy.mjs` recupera os módulos e a configuração dos dois Workers, confere as versões ativas e mantém todos os arquivos anteriores, incluindo módulos binários. Os bindings são herdados com validação estrita e os assets são conservados. Os dois pacotes são preparados antes da ativação. Mudança concorrente da fonte interrompe a publicação. Uma falha na segunda aplicação restaura a primeira quando a fonte publicada ainda corresponde à atualização feita pelo fluxo.

A conferência posterior verifica hashes de todos os módulos, bindings, saúde dos dois serviços, HTML público e os quatro recursos do cliente. O publicador substitui apenas os quatro módulos conhecidos `presentation-*` quando a extensão já estiver instalada. Módulos desconhecidos, versões ainda não publicadas ou mudança concorrente da produção interrompem o processo.

Estado atual: publicado e verificado nos dois domínios. 59 testes passaram, além da sintaxe e da verificação conjunta. HTTP confirmou 11 páginas/recursos, incluindo os quatro arquivos exatos do cliente, ambos os endpoints de saúde e o início da contratação. No navegador, foram conferidos os temas claro/escuro, persistência após recarregar, demonstração, preços e links anuais, além da tela de acesso do Control. Operações autenticadas e pagamento não foram reexecutados.
