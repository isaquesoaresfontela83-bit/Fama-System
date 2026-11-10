# Fama Control: integrações administrativas

A Edge Function `fama-control-admin` versão 8 está publicada. O código deste diretório corresponde aos dois arquivos recuperados da publicação, com comparação exata após o deploy.

A ação `integration_status` exige a mesma autenticação e autorização de administrador das demais ações do Control. Ela retorna a configuração de Google Drive, Resend, OCR.space, Sentry, IPinfo Lite e GitHub REST sem incluir valores de credenciais.

## Contrato

POST com `Authorization: Bearer <Supabase user JWT>` e corpo `{"action":"integration_status"}`. O usuário precisa estar habilitado em `fama_control_admins`.

- `google_drive.configured`: CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN e FOLDER_ID presentes.
- `resend.configured`: API_KEY e FROM presentes.
- `ocr_space.configured` e `sentry.configured`: segredo correspondente presente.
- `ipinfo_lite.available`: IPINFO_LITE_TOKEN presente.
- `github_rest`: consulta pública, somente leitura, sem token.
- `ipinfo`: contrato anterior preservado; usa Lite quando configurado e consulta pública caso contrário.

`configured` informa presença das configurações; não certifica validade, consentimento OAuth ou funcionamento do provedor.

As ações `ipinfo_lookup`, `ipinfo_lite_lookup` e `github_rest_get` continuam restritas ao backend administrativo. Drive, e-mail, OCR e Sentry são executados pela função irmã `fama-system-integrations`, com os controles por empresa já existentes.

## Credenciais

Configure os nomes abaixo em Supabase > Edge Functions > Secrets, nunca no navegador:

- IPINFO_LITE_TOKEN
- FAMA_GOOGLE_DRIVE_CLIENT_ID
- FAMA_GOOGLE_DRIVE_CLIENT_SECRET
- FAMA_GOOGLE_DRIVE_REFRESH_TOKEN
- FAMA_GOOGLE_DRIVE_FOLDER_ID
- FAMA_RESEND_API_KEY
- FAMA_RESEND_FROM
- FAMA_OCRSPACE_API_KEY
- FAMA_SENTRY_DSN

## Validação e limites

Os 7 testes de `integration-status.test.js` passaram em V8 isolado usando o código exato do helper e ambientes simulados. Cobrem contrato anterior, configuração parcial, valores em branco, independência dos provedores, remoção de credenciais e ausência de segredos nas respostas.

Para executar em Deno: `deno test supabase/functions/fama-control-admin/integration-status.test.js`.

A publicação foi recuperada e comparada com a fonte: status ACTIVE, versão 8, arquivos idênticos. O código de autorização e as demais ações foram preservados. O fluxo HTTP autenticado não foi exercitado nesta retomada.

As interfaces salvas System 225 e Control 77 continuam pendentes de revisão, conexão aos endpoints e publicação na instalação independente. O executor de build local permaneceu indisponível. Não há certificação de upload, envio de e-mail, OCR ou recebimento no Sentry com os provedores reais.
