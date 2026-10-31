# Instruções permanentes

## Autorização de publicação e GitHub — 30/10/2026

O proprietário autorizou expressamente nesta conversa: “Apartar de agora você vai subir pro git hub sem precisar pedir, pode publicar”. Para as alterações solicitadas no Fama System e no Fama Control, enviar o código ao repositório GitHub existente e publicar os dois sistemas sem pedir nova confirmação conversacional. Esta preferência permanece válida para os próximos trabalhos nesses projetos. Preservar o escopo solicitado, os dados, os segredos, os planos e o público atual; validar o conjunto antes de publicar.

## Atualização de 30/10/2026 — Pedidos 15.21.0

A produção recuperada é 15.20.0 (`2026-10-26-company-branches-01`), mais recente que as fontes antigas em `apps/`. O módulo Pedidos é aditivo e está em `features/pedidos/`; leia seu README antes de publicar. Os 173 módulos originais dos dois Workers são preservados e verificados pelo manifesto, com três módulos adicionais em cada aplicação. Nunca compilar a árvore antiga sobre essa produção. O lançamento novo usa 15.21.0 / `2026-10-30-pedidos-vendas-entregas-01` nos dois sistemas. As demais instruções de preservação, autorização e destino abaixo continuam válidas; as referências históricas de versão não indicam a fonte vigente.

Atualize Fama System e Fama Control juntos, com a mesma versão e identificador. Leia os AGENTS.md das duas aplicações antes de editar. Preserve o frontend original. Nunca usar AppDeploy, inclusive para prévias.

Destino vigente em 22/10/2026: aplicação completa nos Workers Cloudflare `fama-system-app` e `fama-control-app`, com Supabase e D1 existentes. O proprietário pediu a retirada do Render porque a suspensão por inatividade atrapalha a operação. Baileys continua no Durable Object persistente original. A configuração híbrida anterior foi substituída por essa instrução.

Em 22/10/2026 foram recebidas duas confirmações para publicar (“Autorizo” e “Sim autorizo”) e uma confirmação específica para a transferência criptografada de bancos/segredos a pasta temporária privada, migração Render/Supabase e exclusão dessas cópias ao concluir. Não pedir novamente essas autorizações nem recriar o bloqueio já resolvido.

Preserve os dados, as chaves originais e os planos. Nunca substituir bases existentes por uma base vazia. Não publicar main, que está antigo. Não restaurar encaminhamento para `onrender.com` nem a versão antiga 15.4. Ver `docs/CLOUDFLARE-STATUS.md` para a implantação e as verificações atuais. A versão vigente é 15.10.0 / `2026-10-22-module-charts-01`.

Antes de ativar versões, conferir também todos os arquivos de interface e suas dependências: saúde HTTP 200 não comprova que o frontend carrega. Só declarar publicação conjunta após conferir os dois domínios. Serviços Render antigos ainda exigem autenticação no painel para suspensão; não afirmar que foram suspensos ou excluídos sem verificar.
