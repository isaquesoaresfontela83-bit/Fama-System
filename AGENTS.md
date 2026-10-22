# Instruções permanentes

Atualize Fama System e Fama Control juntos, com a mesma versão e identificador. Leia os AGENTS.md das duas aplicações antes de editar. Preserve o frontend original. Nunca usar AppDeploy, inclusive para prévias.

Destino vigente em 22/10/2026: aplicação completa nos Workers Cloudflare `fama-system-app` e `fama-control-app`, com Supabase e D1 existentes. O proprietário pediu a retirada do Render porque a suspensão por inatividade atrapalha a operação. Baileys continua no Durable Object persistente original. A configuração híbrida anterior foi substituída por essa instrução.

Em 22/10/2026 foram recebidas duas confirmações para publicar (“Autorizo” e “Sim autorizo”) e uma confirmação específica para a transferência criptografada de bancos/segredos a pasta temporária privada, migração Render/Supabase e exclusão dessas cópias ao concluir. Não pedir novamente essas autorizações nem recriar o bloqueio já resolvido.

Preserve os dados, as chaves originais e os planos. Nunca substituir bases existentes por uma base vazia. Não publicar main, que está antigo. Não restaurar encaminhamento para `onrender.com` nem a versão antiga 15.4. Ver `docs/CLOUDFLARE-STATUS.md` para a implantação e as verificações atuais. A versão vigente é 15.10.0 / `2026-10-22-module-charts-01`.

Antes de ativar versões, conferir também todos os arquivos de interface e suas dependências: saúde HTTP 200 não comprova que o frontend carrega. Só declarar publicação conjunta após conferir os dois domínios. Serviços Render antigos ainda exigem autenticação no painel para suspensão; não afirmar que foram suspensos ou excluídos sem verificar.
