# Rotina de lembretes do Fama

Site: appgprj_6a9a074b50b48191acca49e35aa90dc6.

Use a ferramenta autenticada `dispatch_due_reminders` da integração pessoal deste Site, sem cursor no primeiro lote. Somente a conta proprietária do Site pode chamar a ferramenta. A identidade verificada vem da plataforma e é conferida no servidor. A rotina não precisa ler, copiar ou guardar credenciais. Não use navegador, chamadas HTTP públicas nem altere segredos.

Inspecione a resposta JSON. Se `more:true`, chame novamente com `cursor:nextCursor` até `more:false`, por no máximo 20 lotes por execução. Cada lote processa até dois pares empresa/usuário. Pare se `configured:false`. Em erro de autorização, conexão ausente ou integração indisponível, informe o bloqueio sem tentar contorná-lo. Em falha transitória, uma repetição do mesmo lote é permitida. Informe `failed` persistente; não declare entrega quando `sent` for zero.

O servidor aplica vínculo ativo, plano, acesso aos módulos, preferências e deduplicação. Tokens de aparelhos ficam criptografados; mensagens não incluem nomes, endereços nem valores. Visitas são lembradas nos próximos 90 minutos; outras pendências entre 08h e 20h de São Paulo. Execute de hora em hora. Não crie registros nem altere agendamentos, planos ou cobranças. Não envie por outros canais. Só informe falhas persistentes ou necessidade de ação, sem mensagens de sucesso a cada hora.
