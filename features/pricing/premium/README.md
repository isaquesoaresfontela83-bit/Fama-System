# Apresentação comercial 15.23.8

A página comercial usa a identidade do painel Fama, demonstração interativa, temas claro/escuro, quatro períodos de contratação e comparação dos recursos. A preferência usa a chave existente `fama-system-theme-v2` e é aplicada antes da folha de estilos.

Na produção, `entry.mjs` transforma somente as respostas comerciais reconhecidas do Worker existente. Sessões, consentimento legal, cadastro pago, checkout e APIs continuam sendo resolvidos pela aplicação atual. Os preços, limites, nomes e recursos vêm do catálogo público do Control em cada resposta. A herança só ocorre quando o catálogo a declara. Se o catálogo não responder ou estiver inválido, o Worker devolve a página comercial anterior.

A fonte estática usa o retrato do catálogo conferido em 19/11/2026 para revisão visual. O build de produção embute os recursos sob um caminho próprio e reutiliza a marca original. O Control recebe somente o identificador conjunto de versão.

## Publicação

O fluxo `Publicar apresentação Fama System` executa sintaxe, verificação conjunta e testes antes de publicar. Ele requer os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` do repositório. As credenciais ficam no ambiente do job e são usadas apenas nas solicitações à API oficial da Cloudflare.

`deploy.mjs` recupera os módulos e a configuração dos dois Workers, confere as versões ativas e mantém todos os arquivos anteriores, incluindo módulos binários. Os bindings são herdados com validação estrita e os assets são conservados. Os dois pacotes são preparados antes da ativação. Mudança concorrente da fonte interrompe a publicação. Uma falha na segunda aplicação restaura a primeira quando a fonte publicada ainda corresponde à atualização feita pelo fluxo.

A conferência posterior verifica hashes de todos os módulos, bindings, saúde dos dois serviços, HTML público e os quatro recursos do cliente. O resultado é registrado como artefato do job. O fluxo recusa bases com versões ainda não publicadas ou com uma entrada diferente da produção 15.23.7 conhecida.

Estado atual: candidato testado e pronto para ativação. A publicação no domínio depende das credenciais da Cloudflare no repositório.
