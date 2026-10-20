# Planejamento semanal assistido — primeira versão

A Agenda contém “Planejar semana com IA”, separado da aba Fama IA. A proposta trabalha de segunda a sexta no fuso de Brasília. Apenas os atendimentos escolhidos podem mudar; os demais são bloqueios fixos. A API lê todos os atendimentos autorizados da empresa no servidor, mesmo que a lista visível esteja filtrada.

Parâmetros da proposta: jornada, almoço, margem, duração e deslocamento estimados dos compromissos fixos. Por atendimento selecionado: duração, deslocamento anterior, janela diária do cliente, prioridade e ambiente interno ou externo. O técnico deve estar ativo. Até 25 atendimentos por proposta, sem sobreposição e sem horários passados.

A rota automática OpenRouteService permanece adiada: nesta versão os deslocamentos são estimativas informadas pelo usuário. Durações não são medidas históricas. O retorno à base, folgas individuais e restrições por dia da semana ainda exigem conferência manual.

A previsão vem da integração climática existente, apenas quando disponível e configurada. É uma referência da empresa, não uma previsão verificada em cada endereço. Intervalos cobertos com trovoada, chuva >=60% ou vento >=40km/h são evitados para trabalhos externos. Sem cobertura suficiente, o risco é desconhecido, nunca presumido favorável. Não ativa o endpoint Open-Meteo não comercial para a operação comercial.

O mecanismo determinístico confere disponibilidade e conflitos. A IA Cloudflare, quando habilitada na configuração e no plano, recebe apenas totais e limitações da proposta para explicar o resultado; não recebe nomes, endereços ou autoridade para executar mudanças. Ausência de IA não impede sugestões por regras e é informada na tela.

A versão inicial não grava nem aplica mudanças em lote: cada sugestão permite abrir o atendimento e revisar/reagendar no fluxo existente. Próximas etapas: jornada individual, duração histórica, roteamento por sequência, clima por local e aplicação revisada com validação transacional de conflitos.
