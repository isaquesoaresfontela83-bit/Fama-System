# Fama System e Fama Control 15.8.0

Identificador conjunto: `2026-10-22-customers-agenda-01`. Fonte baseada na versão 15.7.2, preservando a execução de serviços, a edição dos cadastros e o frontend original.

## Comportamento

- Orçamentos, agenda, ordens de serviço, garantias e contratos selecionam clientes cadastrados por identificador. O backend confere a empresa e usa o nome oficial. Conversão de orçamento e agendamento de garantia preservam o vínculo; registros antigos continuam acessíveis. Clientes homônimos com vínculo não misturam seus históricos.
- Perfil do cliente com abas Geral, Contato, Piscina e Histórico; busca e resumo do cadastro no seletor. Campos ausentes de endereço/documento recebem os dados do cliente quando apropriado.
- Preferência de envio diário da agenda pelo Baileys, com dias, horário de Brasília e equipe. Inicialmente desativada. Cada execução revalida a empresa, o administrador e os módulos autorizados. Nomes/telefones ambíguos são ignorados. Reservas persistentes evitam envio concorrente duplicado; confirmações incertas não são repetidas automaticamente. As partes da mensagem respeitam o limite do WhatsApp sem perder texto.
- Control consulta o estado administrativo do agendador por ponte autenticada. Tabelas de automação são privadas, com RLS; mensagens persistidas são criptografadas. O token do cron fica somente no servidor/Vault.
- Renovação do QR Baileys fecha a conexão anterior sem apagar suas credenciais e ignora eventos atrasados. O botão só está disponível a administradores. O transporte Node e o Worker recebem a opção de reconexão.
- Resend removido das integrações, formulários e operações dos dois sistemas. As ações antigas de envio são rejeitadas antes de chamar provedores. Dados históricos não são apagados.
- Ajustes de leitura no tema escuro preservam o tema claro e a estrutura visual existente.

## Verificação local em 22/10/2026

Todos os grupos abaixo passaram; há sobreposição dos quatro testes de configuração Baileys do Control entre os grupos de integrações e segurança.

| Grupo | Resultado |
| --- | --- |
| System: clientes, perfis, edição, serviços, agenda, Baileys, autenticação e sessão Node | 58/58 |
| System: integrações e inventário | 20/20 |
| System: histórico, busca e campos de contato | 9/9 |
| Control: integrações, UI, inventário e configuração Baileys | 37/37 |
| Control: agenda administrativa, segurança entre empresas, autenticação e configuração Baileys | 138/138 |
| Migração e armazenamento híbrido System | 5/5 |
| Migração e armazenamento híbrido Control | 5/5 |
| Migração aditiva da agenda em PostgreSQL de teste | 1/1 |
| Parser do Worker: renovação, compatibilidade e rejeição de campos/volume inválidos | 3/3 |

Os dois pacotes estáticos e as duas APIs standalone compilaram. O verificador de JavaScript e o de sincronização dos projetos passaram. A migração aditiva foi aplicada duas vezes em banco de teste e preservou registros, propagou o cliente ao atendimento de garantia e recusou acesso dos papéis públicos às tabelas de automação.

Essas verificações não comprovam acesso aos segredos, conectividade ao banco de produção, cookies do proxy, disparo real do WhatsApp ou publicação nos domínios. O serviço WhatsApp não foi conectado nem enviou mensagens reais nos testes.

## Ativação e pendência

O estado de produção e as verificações da transferência privada estão descritos em [HYBRID-STATUS.md](HYBRID-STATUS.md). A publicação conjunta 15.8.0 foi confirmada nos dois domínios em 22/10/2026.

A migração operacional é aditiva: `deployment/hybrid/customer-agenda.sql`. Depois da migração e validação das duas APIs, configurar `FAMA_AGENDA_CRON_SECRET` no System e os valores correspondentes no Vault; `deployment/hybrid/agenda-cron.sql` só chama a API durante a janela diária e com destinatários ainda sem entrega registrada. O instalador do cron não ativa o envio de nenhuma empresa.

O encaminhamento dos domínios preserva o frontend original e foi validado com cinco testes de rotas, corpo das mutações, cookies, callbacks, privacidade e falhas de upstream. O QR Baileys foi gerado pelo serviço real; a leitura pelo telefone continua sendo uma ação do proprietário. O rodapé do login usa agora a versão compartilhada em vez do texto antigo fixo.
