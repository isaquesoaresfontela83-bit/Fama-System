# Fama System: integrações no backend

Edge Function: `fama-system-integrations`. A função foi publicada separadamente da interface.

## Estado da entrega

- Backend publicado com Google Drive, Resend, OCR.space e envio de eventos ao Sentry.
- As credenciais dos quatro provedores ainda precisam ser cadastradas; endpoints retornam HTTP 424 quando não configurados.
- A interface preparada nas versões 225 do System e 77 do Control ainda precisa ser revisada, conectada aos endpoints e publicada na instalação independente da Cloudflare.
- GitHub REST e IPinfo permanecem no backend administrativo `fama-control-admin`. IPinfo tem modo público; Lite requer token.
- Os testes de provedor neste diretório usam rede simulada. Não certificam envio de e-mails, upload real, OCR real ou recebimento de eventos no Sentry.

## Autorização

POST com `Authorization: Bearer <Supabase user JWT>`, `Content-Type: application/json` e `organization_id` no corpo (ou `x-organization-id`). Exige conta válida, associação ativa à empresa como owner/admin, empresa ativa e plano liberado. Credenciais de provedor nunca são aceitas do cliente ou devolvidas na resposta.

## Ações

| action | Dados adicionais | Resultado |
|---|---|---|
| integration_status | nenhum | Flags de configuração, sem credenciais |
| drive_upload | file | ID, nome e link do arquivo |
| resend_send | to, subject, text, request_id (UUID), file opcional | ID do e-mail; chave de idempotência por empresa |
| ocr_extract | file, language opcional: auto/por/eng/spa | Texto reconhecido |
| sentry_capture | message opcional | ID do evento enviado |

`file` contém `name`, `mime_type` e `base64` puro, sem prefixo data URI. Google Drive/e-mail: até 5 MiB por arquivo; OCR: até 1 MiB. As chamadas têm prazo e tamanho máximos, endpoints fixos e limites por usuário/empresa.

## Segredos necessários

Cadastre somente em Supabase > Edge Functions > Secrets:

- FAMA_GOOGLE_DRIVE_CLIENT_ID
- FAMA_GOOGLE_DRIVE_CLIENT_SECRET
- FAMA_GOOGLE_DRIVE_REFRESH_TOKEN
- FAMA_GOOGLE_DRIVE_FOLDER_ID
- FAMA_RESEND_API_KEY
- FAMA_RESEND_FROM (remetente/domínio validado no Resend)
- FAMA_OCRSPACE_API_KEY
- FAMA_SENTRY_DSN

O Drive requer consentimento OAuth da conta proprietária e refresh token com acesso à pasta configurada. Esses valores não são chaves fictícias e não são obtidos automaticamente pela aplicação.

Não inclua chaves em código, logs, .env versionado ou armazenamento do navegador.

## Testes

`deno test supabase/functions/fama-system-integrations/handler.test.js`

Os 28 cenários verificam autenticação, isolamento por empresa, bloqueio de plano, limites, ausência de credenciais, validação de arquivos, idempotência, OAuth, OCR e envelopes Sentry usando fetch simulado.

## Publicação

`supabase functions deploy fama-system-integrations --no-verify-jwt`

A validação do usuário ocorre dentro da função, por Supabase Auth, antes de ler o corpo ou chamar qualquer provedor. Não remova essas verificações.
