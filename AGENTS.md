# Atualização de 21/11/2026 — botão da IA 15.23.32

Versão conjunta `15.23.32` / `2026-11-21-control-ai-dock-clearance-01`, publicada nos dois Workers. A posição da assistente no Control tem prioridade sobre a regra antiga para não cobrir a barra. A folha compartilhada é `control-system-layout-15.23.32.css` e o cliente da barra permanece `control-dock-15.23.31.mjs`. Preserve ambos e os recursos da verificação em duas etapas. A posição final ainda requer conferência visual autenticada. Consulte `docs/CLOUDFLARE-STATUS.md`.

# Atualização de 21/11/2026 — barra do Control 15.23.31

Versão conjunta `15.23.31` / `2026-11-21-control-bottom-dock-01`, publicada nos dois Workers. A barra do Control está em `apps/control/app/control-dock.mjs` e seus estilos em `control-system-layout.css`; a publicação incremental fica em `features/control-layout/`. Ela usa a navegação existente e não amplia permissões. Preserve os recursos de verificação em duas etapas e a barra ao fazer novas publicações. Consulte `docs/CLOUDFLARE-STATUS.md`. A barra ainda não foi conferida em sessão autenticada real.

# Atualização de 21/11/2026 — layout conjunto 15.23.30

Versão conjunta `15.23.30` / `2026-11-21-control-system-layout-02`, publicada e verificada nos dois Workers. O Control usa a folha de layout compartilhada com o System, acrescida de `apps/control/app/control-system-layout.css`. A extensão de produção fica em `features/control-layout/`; preserve os recursos de verificação em duas etapas da versão 15.23.28. Consulte `docs/CLOUDFLARE-STATUS.md`. A tela autenticada e a apresentação em celular ainda não tiveram conferência visual nesta atualização. As regras permanentes abaixo continuam válidas.

# Atualização de 19/11/2026 — apresentação 15.23.8

Versão conjunta vigente `15.23.8` / `2026-11-19-premium-public-themes-01`, publicada e verificada nos dois Workers. A apresentação pública e os temas estão em `features/pricing/premium/`. Consulte seu README, `deployment.json` e `docs/CLOUDFLARE-STATUS.md`. Recupere sempre a produção atual; preserve os 140/73 módulos anteriores e substitua somente os quatro módulos conhecidos da apresentação quando necessário. As autorizações e regras de preservação abaixo permanecem válidas.

# Atualização de 09/11/2026 — contas 15.23.3

Versão conjunta `15.23.3` / `2026-11-09-account-access-01`. A extensão em `features/account-access/` corrige a conexão de segunda conta e exige aprovação do proprietário antes da criação do colaborador do Control. A solicitação de `grupofamaofc@gmail.com` está pendente e sem acesso. Consulte `docs/CLOUDFLARE-STATUS.md`.

# Instruções permanentes

## Atualização de 06/11/2026 — Liquid Glass 15.23.1

A versão conjunta é `15.23.1` / `2026-11-06-all-module-shortcuts-01`. A extensão visual fica em `features/liquid-glass/` e envolve a entrada Pedidos sem recompilar as fontes antigas. Leia `docs/OPERACAO.md` e `docs/CLOUDFLARE-STATUS.md` para o fluxo vigente. As versões mencionadas abaixo são históricas.

## Autorização de publicação e GitHub — 30/10/2026

O proprietário autorizou expressamente nesta conversa: “Apartar de agora você vai subir pro git hub sem precisar pedir, pode publicar”. Para as alterações solicitadas no Water System e no Water Control, enviar o código ao repositório GitHub existente e publicar os dois sistemas sem pedir nova confirmação conversacional. Esta preferência permanece válida para os próximos trabalhos nesses projetos. Preservar o escopo solicitado, os dados, os segredos, os planos e o público atual; validar o conjunto antes de publicar.

## Atualização de 30/10/2026 — Pedidos 15.21.0

A produção recuperada é 15.20.0 (`2026-10-26-company-branches-01`), mais recente que as fontes antigas em `apps/`. O módulo Pedidos é aditivo e está em `features/pedidos/`; leia seu README antes de publicar. Os 173 módulos originais dos dois Workers são preservados e verificados pelo manifesto, com três módulos adicionais em cada aplicação. Nunca compilar a árvore antiga sobre essa produção. O lançamento novo usa 15.21.0 / `2026-10-30-pedidos-vendas-entregas-01` nos dois sistemas. As demais instruções de preservação, autorização e destino abaixo continuam válidas; as referências históricas de versão não indicam a fonte vigente.

Atualize Water System e Water Control juntos, com a mesma versão e identificador. Leia os AGENTS.md das duas aplicações antes de editar. Preserve o frontend original. Nunca usar AppDeploy, inclusive para prévias.

Destino vigente em 22/10/2026: aplicação completa nos Workers Cloudflare `fama-system-app` e `fama-control-app`, com Supabase e D1 existentes. O proprietário pediu a retirada do Render porque a suspensão por inatividade atrapalha a operação. Baileys continua no Durable Object persistente original. A configuração híbrida anterior foi substituída por essa instrução.

Em 22/10/2026 foram recebidas duas confirmações para publicar (“Autorizo” e “Sim autorizo”) e uma confirmação específica para a transferência criptografada de bancos/segredos a pasta temporária privada, migração Render/Supabase e exclusão dessas cópias ao concluir. Não pedir novamente essas autorizações nem recriar o bloqueio já resolvido.

Preserve os dados, as chaves originais e os planos. Nunca substituir bases existentes por uma base vazia. Não publicar main, que está antigo. Não restaurar encaminhamento para `onrender.com` nem a versão antiga 15.4. Ver `docs/CLOUDFLARE-STATUS.md` para a implantação e as verificações atuais. A versão vigente é 15.10.0 / `2026-10-22-module-charts-01`.

Antes de ativar versões, conferir também todos os arquivos de interface e suas dependências: saúde HTTP 200 não comprova que o frontend carrega. Só declarar publicação conjunta após conferir os dois domínios. Serviços Render antigos ainda exigem autenticação no painel para suspensão; não afirmar que foram suspensos ou excluídos sem verificar.
