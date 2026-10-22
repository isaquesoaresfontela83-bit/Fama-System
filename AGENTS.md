# Instruções permanentes

Atualize Fama System e Fama Control juntos, com a mesma versão e identificador. Leia os AGENTS.md das duas aplicações antes de editar.

Destino aprovado: interfaces estáticas, APIs Render gratuitas e persistência Supabase. Preserve dados e chaves originais. Não use SQLite ou sessões Baileys no disco efêmero. Não altere os domínios antes da importação e validação conjunta. Nunca usar AppDeploy, inclusive para prévias.

Em 22/10/2026, as duas confirmações para publicar o lançamento conjunto 15.8.0 foram recebidas: “Autorizo” e “Sim autorizo”. O repositório de destino foi verificado: isaquesoaresfontela83-bit/Fama-System. A revisão automática bloqueou a transferência produção→pasta local temporária de bancos e segredos originais; não repetir nem contornar esse bloqueio sem autorização específica ou comprovação aceita da autorização. A autorização de 21/10 para copiar os bancos ao Supabase e configurar as chaves originais no Render permanece registrada, mas não permitiu concluir aquela transferência local. Concluir todo trabalho independente desse bloqueio.

Em 22/10/2026, após a pergunta específica sobre transferência dos bancos e segredos originais para pasta temporária privada e exclusão ao concluir, o proprietário respondeu “Sim autorizo”. O bloqueio de autorização foi resolvido; a exportação criptografada foi recebida e as variáveis temporárias removidas dos dois Workers. Não pedir novamente essa autorização. As 44 tabelas auxiliares foram comparadas e 57 registros confirmados no Supabase, preservando os existentes.
