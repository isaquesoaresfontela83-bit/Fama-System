# WhatsApp Baileys do Fama

Serviço para conectar um WhatsApp por empresa, gerar QR code localmente, receber conversas individuais e enviar texto pelo Fama System. É independente da integração Meta existente. Não importa conversas antigas nem envia campanhas automaticamente.

## Instalação ativa na Cloudflare

O Worker `fama-baileys` usa um Durable Object SQLite por empresa. O servidor já está publicado; o Control usa uma conexão interna de serviço e as credenciais cadastradas no backend. Atualize **Chat → WhatsApp**, clique em **Conectar WhatsApp** e escaneie o QR no celular. O pareamento precisa ser feito pelo proprietário do número.

O código está em `worker/`. Execute `node worker/build.mjs` a partir desta pasta depois de instalar as dependências do serviço e da aplicação. O build adapta o transporte WebSocket e carrega o WebAssembly original de criptografia como módulo estático, sem alterar os algoritmos da biblioteca. Mantenha `BAILEYS_API_TOKEN` e `BAILEYS_ENCRYPTION_KEY` nos segredos do Worker. A chave de criptografia deve ser preservada nas próximas publicações.

As sessões são retomadas após reinício. Alarmes mantêm a retomada ativa somente para conexões habilitadas; uma tentativa sem pareamento expira após oito minutos. Mídias aparecem identificadas; esta versão envia texto.

## Alternativa em servidor Node.js

Requer Node.js 22.13+, volume persistente e um endereço HTTPS. O Worker do site encaminha operações autenticadas ao serviço; o navegador nunca recebe o token do servidor. Baileys não é a API oficial da Meta.

1. Execute `npm ci` nesta pasta.
2. Gere **dois valores diferentes** com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`: `BAILEYS_API_TOKEN` e `BAILEYS_ENCRYPTION_KEY`. Forneça-os pelo gerenciador de segredos do servidor. Preserve a chave de criptografia junto ao backup seguro; trocar ou perder a chave torna sessões e mensagens antigas ilegíveis.
3. Execute `npm start` ou construa o Dockerfile, vinculando `/data` a um volume persistente. Configure um proxy HTTPS na frente da porta 3010. Não exponha a porta sem o proxy.
4. Em **Fama Control → Integrações → WhatsApp Baileys**, cadastre a URL HTTPS e o token. A configuração só é salva após o servidor confirmar `/health`.
5. No **Fama System → Chat → WhatsApp**, clique em **Conectar WhatsApp**. No celular, abra **Aparelhos conectados → Conectar aparelho** e escaneie o QR.

As sessões retomam após reinício. Desconectar encerra a sessão e remove as chaves daquele WhatsApp; o histórico de texto permanece. Mensagens e credenciais são criptografadas em SQLite com AES-256-GCM. Cada empresa é isolada por UUID. Uma tentativa de envio sem confirmação não é repetida automaticamente. A interface sinaliza a pendência para conferência no celular.

Esta alternativa usa um processo Node.js com disco persistente. A instalação Cloudflare usa o adaptador em `worker/` e armazena o banco nos Durable Objects. A versão de Baileys está fixada e deve ser atualizada com teste real de pareamento quando o protocolo do WhatsApp mudar.

Verificação: `npm test` usa sockets simulados e não envia mensagens reais. O pareamento e a troca de mensagens reais exigem o QR escaneado pelo proprietário do número.
