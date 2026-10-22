# Central de integrações do Fama Control

Em **Integrações**, o proprietário configura Google Drive, Resend, Sentry, OCR.space, IPinfo Lite e GitHub. A central reúne configuração, ativação, testes, documentos, consultas e atividade. As rotas administrativas verificam a sessão do proprietário e a origem das alterações.

As credenciais são criptografadas com AES-GCM no D1 do Control usando `FAMA_DATA_ENCRYPTION_KEY`. Nenhum GET devolve segredos. Campos secretos vazios preservam o valor salvo; a opção de remoção apaga explicitamente o campo. A revisão evita que uma edição sobrescreva outra.

## Uso da central

- **Drive:** salve o identificador e o segredo do aplicativo Google e selecione Conectar Google. O consentimento é concedido na tela oficial do Google, com retorno ao Control. São usados state com uso único, PKCE, vínculo ao administrador e prazo de dez minutos. O escopo `drive.file` permite os documentos autorizados para o aplicativo. Sem pasta indicada, uma pasta Documentos Fama é criada. A central lista, envia e baixa PDFs/imagens dessa pasta. O teste verifica acesso de gravação à pasta.
- **Resend:** configure a chave e o remetente verificado; selecione um arquivo, revise destinatário e mensagem e confirme o envio. O teste de conexão consulta o serviço sem mandar e-mail. Chaves restritas podem exigir validação por um envio escolhido pelo operador. Aceitação e entrega são estados diferentes. O recibo permite consultar a entrega dentro do Control.
- **OCR.space:** selecione um PDF, JPG ou PNG e extraia o texto para revisão. O botão de teste orienta usar um documento e não afirma ter validado a chave sem executar a leitura.
- **Sentry:** cadastre o DSN. O teste envia somente um evento técnico identificado como teste. Token de leitura, organização e número do projeto permitem consultar erros pendentes na própria central. A atividade local não substitui todo o histórico do provedor.
- **IPinfo:** salve o token Lite, ou deixe o campo vazio para a consulta pública. País e rede são consultados no Control.
- **GitHub:** configure o repositório e, se necessário, um token. Commits e versões são consultados no Control; consultar alterações não faz publicação.

Drive e e-mail aceitam arquivos de até 5 MB; OCR, até 1 MB. A central aceita PDF, JPG e PNG, confere a assinatura do arquivo e não envia nada ao selecionar o arquivo. E-mails usam identificação de operação, registro durável e chave de idempotência; timeouts ou resultados incertos não geram repetição automática. O registro da atividade contém provedor, operação, situação, recibo e horário, sem conteúdo dos documentos ou destinatários.

## Integração com Fama System

O System mantém as ações de documento em seus registros. Após a validação de empresa, papel, módulo e documento, usa a rota interna do Control com `FAMA_DATA_BRIDGE_SECRET` e o binding `FAMA_CONTROL` quando presente. Chaves dos provedores ficam apenas no Control. A rota interna não expõe operações administrativas de GitHub/IPinfo, configuração ou leitura de outras empresas.

As conexões anteriores no backend continuam disponíveis até que o cadastro interno esteja completo. Pausar uma integração no Control bloqueia seu uso e nunca retorna à conexão anterior. Durante publicação conjunta, Control deve ser publicado antes do System; um Control antigo que responde 404 na nova rota mantém a compatibilidade com o backend anterior.

A primeira obtenção de credenciais, a verificação do remetente e a autorização de conta continuam sujeitas às exigências de cada provedor. O Control não cria contas externas nem ignora consentimentos. Testes automatizados usam provedores simulados; disponibilidade e permissões reais precisam ser verificadas na central após publicar.
