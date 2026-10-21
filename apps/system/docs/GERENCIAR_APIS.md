# Gerenciar APIs

O Fama Control possui uma aba `Gerenciar APIs` (`#apis`) com o inventário compartilhado de 41 integrações e serviços. A lista cobre infraestrutura, documentos, comunicação, segurança, administração, agenda, financeiro, consultas, clima, mapas, rotas, IA e digitalização local. As consultas da BrasilAPI estão agrupadas pelo provedor; os pontos de integração de cada serviço aparecem nos detalhes.

Cada entrada informa onde é usada, em quais sistemas existe e o status de cada instância. Busca, área e status podem ser combinados. Os botões de gerenciamento navegam para as telas internas de integrações, empresas, IA, financeiro, segurança ou saúde.

- **Conexão verificada:** uma consulta foi confirmada na data exibida; não significa disponibilidade contínua nem valida todas as operações do provedor.
- **Configurada:** o cadastro está presente; o provedor não foi consultado nesta conferência.
- **Sem chave:** integração pública implementada, ainda sem teste de resposta nesta conferência.
- **Não configurada / pausada:** falta um cadastro completo ou a integração foi explicitamente pausada.
- **Não conferida / sem resposta:** faltou evidência de configuração ou o diagnóstico não foi confirmado. Nunca implica uma conexão fictícia.
- **Por empresa / por dispositivo / em reserva:** a verificação depende da conexão da empresa, do computador ou da escolha de um provedor alternativo.

`GET /api/admin/apis` exige o proprietário com a validação administrativa existente, não retorna credenciais e consulta o inventário do System por `/api/internal/api-status`, autenticado pelo segredo do canal interno. Os cadastros das empresas são apresentados somente como totais agregados, sem nomes, identificadores ou tokens. Consultas limitadas não afirmam ausência de conexões fora da amostra.

`POST /api/admin/apis` aceita apenas um identificador e um sistema do catálogo, exige origem confiável e aplica limite de requisições. Somente os diagnósticos de leitura explicitamente permitidos são executados. Não há envio de e-mail, mensagem, push, evento Sentry, geração de IA, processamento OCR ou criação de cobrança por essa tela. Testes que precisam de uma operação real permanecem nas telas correspondentes.

Os resultados dos testes manuais ficam na conferência aberta. Atualizar o inventário refaz a leitura da configuração. A data da consulta e a data do diagnóstico do provedor são separadas. Uma versão antiga do System mantém todas as APIs visíveis como não conferidas, sem simular disponibilidade. A sincronização exige a identificação do mesmo lançamento na saúde e no inventário autenticado do System.

O catálogo, os estados, a leitura da configuração de runtime e os diagnósticos públicos são compartilhados e verificados por `scripts/verify-companion.mjs`. Endereços de terceiros ou credenciais fornecidos no corpo de uma solicitação de diagnóstico são rejeitados.
