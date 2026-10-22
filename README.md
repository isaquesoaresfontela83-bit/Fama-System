# Fama System e Fama Control

Versão conjunta **15.8.0**, lançamento `2026-10-22-customers-agenda-01`.

As aplicações completas executam na Cloudflare, nos domínios https://famasystem.online e https://control.famasystem.online. O Render deixou de receber tráfego de produção em 22/10/2026. O frontend original e os dados existentes foram preservados.

As fontes ficam em `apps/system` e `apps/control`. Use `npm run build:cloudflare` em cada aplicação, valide as duas antes da publicação e preserve os bindings e segredos existentes. Não publicar o `main` antigo nem usar AppDeploy.

Consulte `docs/CLOUDFLARE-STATUS.md` para o estado verificado e `deployment/cloudflare/README.md` para preparar o pacote. A configuração antiga do Render foi arquivada em `deployment/hybrid/render.retired.yaml` e não representa o destino atual.
