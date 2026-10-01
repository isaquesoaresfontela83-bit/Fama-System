# Fama System / Fama Control — pacote de publicação

Este diretório foi preparado para a próxima publicação dos dois ChatGPT Sites quando a cota de Sites/Work estiver disponível novamente.

## Arquitetura oficial

- Frontend/publicação: ChatGPT Sites
- Backend, Auth, dados e permissões: Supabase
- Código e versionamento: GitHub
- AppDeploy: não usar

## URLs atuais

- Fama System: https://fama-system.isaquesoaresfontela8.chatgpt.site/
- Fama Control: https://fama-control.isaquesoaresfontela8.chatgpt.site/

## Domínios desejados

- Fama System: `famasystem.online`
- Fama Control: `control.famasystem.online`

## Fama System — alteração de publicação

O código atual do repositório já usa autenticação nativa do ChatGPT Sites (`/signin-with-chatgpt`). Na próxima publicação, manter este fluxo como único login oficial e remover da revisão publicada qualquer formulário antigo de e-mail/senha que não exista na branch atual.

Não alterar o layout, as cores, os módulos, a estrutura visual ou os dados do usuário ao fazer essa atualização.

## Fama Control — alteração de publicação

A revisão atualmente publicada autentica corretamente no Supabase Auth, porém usa `sessionStorage` como dependência obrigatória antes de executar o `bootstrap`. Em alguns ambientes do ChatGPT Sites/WebView isso interrompe o fluxo depois da autenticação.

Aplicar o conteúdo de `fama-control-auth-session-fix.js` no bloco de autenticação do frontend, substituindo as funções antigas `tok`, `ref` e `setSession` e mantendo o restante do layout e da lógica intactos.

O backend de produção já está preparado para este fluxo:

- `control-auth` v7
- `fama-control` v10
- `fama-control-core` v4
- `fama-control-admin` v3

## Teste mínimo antes de publicar

1. Fama System: clicar em Entrar e confirmar redirecionamento pelo login nativo do ChatGPT.
2. Fama Control: autenticar por e-mail/senha.
3. Confirmar que, após receber o access token, a página chama `fama-control` com `Authorization: Bearer <token>` e `action: bootstrap`.
4. Confirmar abertura do painel.
5. Confirmar que permissões individuais continuam sendo controles clicáveis e não campos de texto.
6. Testar criação/edição de usuário sem alterar dados reais de produção, preferencialmente em uma conta de teste.
7. Publicar no mesmo Site/URL; não criar um novo Site.

## DNS

Não usar registros antigos do AppDeploy. Depois que os Sites forem publicados corretamente, adicionar os domínios personalizados dentro do próprio ChatGPT Sites e copiar exatamente os CNAME/TXT/A exibidos pelo produto para a Hostinger. Não inventar os registros.
