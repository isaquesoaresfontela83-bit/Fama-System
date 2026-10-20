# Integrações selecionadas — Fama System 15.2

As seis integrações ficam em **Configurações e ajuda → Configurações da empresa → Integrações**. O menu continua com seis módulos principais; as conexões ficam dentro das configurações.

Cada empresa possui sua configuração. As credenciais são criptografadas com a chave de proteção já configurada no servidor. A interface retorna apenas a presença da credencial. Uma configuração salva não comprova uma chamada bem-sucedida ao provedor.

## Google Drive

1. No Google Cloud, ative a **Google Drive API** e configure a tela de consentimento.
2. Crie um cliente OAuth do tipo **Aplicativo da Web**. Autorize `https://famasystem.online` e `https://www.famasystem.online` como origens JavaScript.
3. Cadastre o ID público desse cliente no painel de integrações. Não é necessário cadastrar o segredo OAuth nesta implementação.
4. Abra um registro com documento anexado, expanda **Ações do documento** e selecione **Copiar para o Drive**.
5. Escolha a conta Google e autorize o escopo `drive.file`. O Fama cria uma cópia na conta escolhida. O token fica apenas na memória da sessão, sem ser gravado no banco, no armazenamento do navegador ou em logs.

Referência: https://developers.google.com/workspace/drive/api/guides/manage-uploads

## Resend

Cadastre uma chave de envio e um e-mail remetente de domínio verificado. Em **Ações do documento → Enviar por e-mail**, informe e confira o destinatário, o assunto e a mensagem antes de confirmar. Somente proprietário e administrador podem enviar documentos.

As tentativas têm identificação de idempotência e registro no servidor. Envios confirmados não são repetidos com a mesma identificação. Se houver timeout, erro de servidor ou confirmação incompleta, confira o painel Resend antes de tentar novamente. A aceitação pelo Resend não é confirmação de entrega ao destinatário.

Referência: https://resend.com/docs/api-reference/emails/send-email

## Sentry

Crie um projeto JavaScript no Sentry e cadastre seu DSN original de ingestão HTTPS. Use **Enviar evento de teste** e confira o evento no projeto. O monitoramento é ativado na sessão da empresa e pode ser desativado pelo mesmo painel.

O relay do Fama envia apenas uma descrição genérica, o tipo da falha, a versão e posições em arquivos JavaScript compilados. Mensagens de erro, documentos, nomes, e-mails, URLs de páginas e parâmetros de consulta são excluídos do evento. O limite local por carregamento é de dez eventos; o servidor aplica controle adicional por usuário e empresa.

## OCR.space

Obtenha uma chave gratuita em https://ocr.space/ocrapi e cadastre-a no painel. Nos arquivos do registro, selecione **Extrair texto**. PDF, JPG e PNG devem ter até **1 MB**; a oferta gratuita processa até **3 páginas**. O resultado aparece para revisão e não altera registros automaticamente. Leituras parciais são sinalizadas.

## IPinfo Lite

Cadastre o token Lite e selecione **Consultar minha conexão**. O endereço consultado é o IP informado pela Cloudflare para a conexão atual, nunca um endereço de encaminhamento fornecido pelo navegador. O painel mostra país e rede/ASN e atribui os dados ao IPinfo. Não há localização por cidade nem GPS nessa oferta.

Referência: https://ipinfo.io/developers/lite-api

## GitHub REST API

O repositório inicial é `isaquesoaresfontela83-bit/Fama-System`. A consulta pública funciona sem token. Opcionalmente, configure outro repositório e uma credencial somente de leitura quando ele for privado. O painel mostra a descrição, cinco alterações recentes e a última release, quando existir. Consultas repetidas utilizam cache de cinco minutos.

Os dados do repositório não são uma confirmação de que um commit já foi publicado no Fama. A consulta não modifica código nem inicia deploys.

Referência: https://docs.github.com/en/rest/repos/repos
