# OpenRouteService no Fama

O frete do plano Pro usa OpenRouteService quando o segredo central `FAMA_OPENROUTESERVICE_API_KEY` está configurado. A chave é cadastrada uma única vez na hospedagem; clientes só configuram CEP de saída e tarifa por km. Não inclua a chave no código, na URL, em campos da empresa ou no navegador.

Endpoint atual: POST `https://api.heigit.org/openrouteservice/v2/directions/driving-car/json`. O host antigo `api.openrouteservice.org` foi descontinuado. Autenticação via cabeçalho Authorization; coordenadas em longitude, latitude. Só coordenadas públicas dos CEPs são enviadas, sem nomes, registros financeiros ou sessão do usuário.

O servidor valida a rota, calcula o frete usando a tarifa salva e retorna duração estimada, sem trânsito em tempo real. Mantém cache de 24 horas sem coordenadas na URL e reúne chamadas iguais. O limite compartilhado conservador é de 35 chamadas por minuto e 1.800 por dia, abaixo da cota Directions Standard consultada. Quota, indisponibilidade ou chave inválida não geram distância fictícia.

Sem chave central, o serviço de rotas anterior continua funcionando; não apresentar OpenRouteService como ativo. Com chave configurada, falhas são exibidas sem substituir silenciosamente a distância por outro provedor.

Ativação: criar ou acessar a conta gratuita central em https://account.heigit.org/, obter uma chave Standard, configurar o segredo pela hospedagem e republicar a versão salva. Verificar uma rota real antes de afirmar ativação. Criação de senha e aceite de termos devem ser concluídos pelo proprietário conforme o fluxo seguro do navegador.
