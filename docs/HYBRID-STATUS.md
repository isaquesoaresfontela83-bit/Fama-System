# Implantação híbrida publicada — 22/10/2026

**Fama System e Fama Control 15.8.0 / 2026-10-22-customers-agenda-01.** Ambos os domínios confirmaram HTTP 200 com a mesma versão e identificador após a troca do encaminhamento. O frontend original foi preservado. AppDeploy não foi usado.

| Aplicação | Endereço público | API Render | Origem de arquivos estáticos |
| --- | --- | --- | --- |
| System | https://famasystem.online | https://fama-system-api.onrender.com | https://fama-system-web.onrender.com |
| Control | https://control.famasystem.online | https://fama-control-api.onrender.com | https://fama-control-web.onrender.com |

## Arquitetura

As APIs Node/Docker e os estáticos estão nos quatro serviços Render existentes, workspace Fama system (`tea-dbcgqg3rjlhs73be8ojg`). Auto-deploy continua desativado. As branches de implantação existentes são `deploy/hybrid-15.7.0` e `release/15.7.2`; os nomes históricos não indicam a versão dos arquivos. A fonte preparada fica em `release/15.8.0-prepared`. Não implantar main, que está antigo.

A Render não tinha aplicado os rewrites das origens estáticas. Os Workers `fama-system-app` e `fama-control-app` agora fazem somente o encaminhamento leve de `deployment/hybrid/`: navegação para o índice estático, arquivos para a origem estática e APIs/páginas especiais para Node. As URLs estáticas onrender são origens de arquivos; usar os domínios principais para o aplicativo. DNS, certificados, público e identidade visual foram preservados. Os assets e bindings anteriores foram retidos para recuperação; a aplicação completa antiga não é executada pelo encaminhamento.

O proxy encaminha cookies somente à API fixa, preserva múltiplos Set-Cookie e callbacks e mantém as solicitações na mesma origem. Remove credenciais dos pedidos de arquivos estáticos, não segue redirecionamentos e desativa cache de páginas e respostas de API. Cinco testes específicos passaram.

## Dados e configuração

Projeto Supabase existente: `mupnsdqahoybhmkpufmx`, região sa-east-1. As 44 tabelas auxiliares foram comparadas com cópias atuais dos dois Workers: 57 registros confirmados. Uma entrega de notificação nova foi adicionada; nenhum registro anterior foi substituído. Os dados operacionais públicos não foram substituídos. A migração aditiva dos vínculos de clientes e automação da agenda foi aplicada.

As chaves originais e a configuração dos provedores foram preservadas e copiadas para as APIs. Os papéis PostgreSQL restritos existentes são proprietários de seus esquemas separados, sem criação de papéis/bancos nem bypass global de RLS. O pooler de sessão é `aws-0-sa-east-1.pooler.supabase.com:5432`; TLS permanece validado com a CA oficial Supabase Root 2021. Os dois backends confirmaram armazenamento persistente, sem criar banco local.

O bucket novo `fama-runtime-backups` é privado e exclusivo para arquivos de backup. O teste de gravação/leitura passou e o acesso público foi negado; seu único objeto de teste foi removido. O Control usa esse bucket, sem armazenamento efêmero local.

## Agenda e WhatsApp

O cron Supabase `fama-daily-agenda` está instalado a cada cinco minutos. O endpoint e o token ficam no Vault/backend. O SQL só chama o backend dentro da janela configurada e com destinatários ainda sem entrega registrada; não mantém APIs acordadas sem trabalho. O processamento autenticado passou com zero empresas habilitadas e zero mensagens enviadas. Nenhuma preferência de empresa foi ativada pela implantação.

O Baileys foi atualizado e continua no namespace persistente original `4c43d4dc450842248515cc69d98e9530`, com suas chaves originais. A Render usa uma credencial de serviço separada, sem substituir o token anterior nem a chave de criptografia das sessões. O transporte real confirmou HTTP 200 e gerou um QR válido. A vinculação ao telefone depende de o proprietário escanear o QR dentro do System; nenhuma mensagem real foi enviada na validação. Após vincular, o administrador escolhe os dias, horário e equipe em Agenda → Envio automático.

## Verificação pública

- `/api/health`: HTTP 200, versão 15.8.0 e o mesmo release ID nos dois domínios.
- `/api/auth/session`: 401 sem sessão, sem página HTML ou loop de redirecionamento.
- Login: validação 400 para campos vazios e rejeição 403 de origem externa, sem usar a senha do proprietário ou enviar e-mail de teste.
- Planos públicos, telas de login e manual: HTTP 200 nos dois domínios. Telas inspecionadas no navegador; contraste e layout original preservados.
- System e Control: testes de autorização, empresas, MFA, integrações, clientes, edição e agenda passaram localmente. As quatro compilações passaram antes de implantar. A inspeção pública não substitui uma sessão autenticada com o MFA do proprietário.
- Ponte Control → Baileys: configuração e status confirmados. Agendador protegido: saúde e execução sem destinatários confirmadas.

A Render gratuita pode suspender após inatividade; o aviso da interface orienta aguardar o despertar. Não há pings de manutenção. As cotas gratuitas compartilhadas já foram aceitas pelo proprietário.

## Recuperação

Versões Cloudflare anteriores ao encaminhamento: System `0dad9824-dccc-4b8f-a0a3-1413a96a5c14`; Control `844a643a-f4e9-40b6-b7f6-a87a43f4315a`. Versão Baileys anterior à atualização: `f979e458-0424-4e31-ab7d-065d8d8678e6`. Qualquer retorno precisa considerar os registros novos no Supabase e pausar a automação antes de restaurar um fluxo antigo; nunca apagar o banco atual.

As variáveis temporárias `FAMA_MIGRATION_*` foram removidas dos dois Workers após a exportação. As cópias locais sensíveis são removidas ao concluir esta implantação, conforme a autorização do proprietário. Não incluir bancos, senhas, tokens, chaves, envelopes ou arquivos privados no Git ou em relatórios.
