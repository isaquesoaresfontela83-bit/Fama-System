# Fama Control — login nativo com ChatGPT

Branch de publicação: `fama-control-chatgpt-auth`

Projeto ChatGPT Sites alvo: `appgprj_6aa0a5eb3a8c81918279118311b7b970`

URL existente: `https://fama-control.isaquesoaresfontela8.chatgpt.site/`

## Fluxo definitivo

1. A página usa `/signin-with-chatgpt` para autenticar o usuário no ChatGPT Sites.
2. O servidor lê `oai-authenticated-user-id` e `oai-authenticated-user-email` por `app/chatgpt-auth.ts`.
3. `/api/fama-control/chatgpt-session` valida o e-mail diretamente em `fama_control_admins` e, como fallback, em um vínculo `owner` ativo.
4. Só depois dessa autorização o servidor cria uma sessão Supabase temporária para o mesmo e-mail, sem pedir a senha do Supabase e sem enviar magic link por e-mail.
5. O frontend usa essa sessão temporária para as Edge Functions já existentes do Fama Control.
6. Em caso de 401, a sessão é recriada pelo servidor desde que a sessão do ChatGPT continue válida.

## Segredo obrigatório no ambiente do ChatGPT Site

O Site precisa manter **um** destes nomes configurado no ambiente do servidor:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nunca colocar essa chave em `NEXT_PUBLIC_*`, no JavaScript do navegador ou no GitHub.

O URL do Supabase e a chave publishable já possuem fallback seguro no código.

## O que foi removido do fluxo

- Login por e-mail e senha na tela do Fama Control.
- Dependência de `sessionStorage` para autenticar inicialmente.
- Necessidade de o usuário conhecer/usar a senha Supabase para entrar no Control.

## O que permanece

- Supabase como backend/Auth interno.
- Edge Functions `fama-control`, `fama-control-core` e `fama-control-admin`.
- Autorização do proprietário no servidor.
- Empresas, usuários, permissões individuais clicáveis, auditoria, backups, lixeira, segurança e LGPD.
- Mesmo domínio e mesmo projeto do Fama Control.
- AppDeploy não é utilizado.
