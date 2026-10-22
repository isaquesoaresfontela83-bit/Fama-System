# Instruções permanentes

Atualize Fama System e Fama Control juntos, com a mesma versão e identificador. Leia os AGENTS.md das duas aplicações antes de editar. Preserve o frontend original. Nunca usar AppDeploy, inclusive para prévias.

Destino aprovado e publicado: interfaces estáticas Render, APIs Node/Docker Render gratuitas e persistência Supabase. Os domínios atuais usam um encaminhamento leve Cloudflare para as origens estáticas e as APIs; a aplicação completa não roda nos Workers. Baileys continua em Durable Objects persistentes. Não usar SQLite nem sessões no disco efêmero Render.

Em 22/10/2026 foram recebidas duas confirmações para publicar (“Autorizo” e “Sim autorizo”) e uma confirmação específica para a transferência criptografada de bancos/segredos a pasta temporária privada, migração Render/Supabase e exclusão dessas cópias ao concluir. Não pedir novamente essas autorizações nem recriar o bloqueio já resolvido.

Preserve os dados, as chaves originais e os planos. Nunca substituir bases existentes por uma base vazia. Não publicar main, que está antigo. Ver docs/HYBRID-STATUS.md para a implantação e as verificações atuais. Só declarar publicação conjunta depois de conferir os dois domínios.
