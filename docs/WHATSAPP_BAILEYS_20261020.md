# WhatsApp Baileys — servidor ativo

O servidor `fama-baileys` foi publicado na Cloudflare e configurado no Fama Control. O serviço gerou QR real em dois testes; as sessões de teste foram encerradas. Nenhum número foi pareado e nenhuma mensagem real foi enviada.

A versão publicada dos painéis continua em **15.4**, lançamento `2026-10-20-baileys-01`. Essa versão já usa a configuração do servidor por variáveis do Control. A atualização conjunta **15.4.1**, `2026-10-20-baileys-02`, acrescenta a conexão privada por service binding e está salva nas fontes dos dois projetos. A publicação final ficou pendente em 21/10/2026 porque a ferramenta de Cloudflare retorna erro interno, inclusive em consultas simples. Não foi alterado o público dos sites.

## Conectar o telefone

No Fama System, abra **Chat → WhatsApp → Atualizar → Conectar WhatsApp**. No celular, abra **Aparelhos conectados → Conectar aparelho** e escaneie o QR exibido. Aguarde o estado **Conectado**. O QR temporário é renovado automaticamente. Administradores podem consultar a configuração em **Fama Control → Integrações → WhatsApp Baileys**.

## Serviço

A implementação fica em `apps/fama-system/services/baileys`. O adaptador `worker/` executa Baileys na Cloudflare, com conexão WebSocket e o WASM original compilado como módulo estático. Cada empresa tem um Durable Object e armazenamento SQLite isolado. Autenticação e textos são criptografados, e os tokens ficam apenas no backend. Não é necessário provisionar uma VPS para esta instalação.

A configuração de produção preserva os segredos existentes. Ao publicar a versão 15.4.1, preserve todas as credenciais do System, Control e serviço Baileys e acrescente o binding `BAILEYS_SERVICE` apontando para `fama-baileys` no Control. Não regenere a chave de criptografia do serviço.

O atendimento inicial suporta conversas individuais e texto. Mídias recebidas aparecem identificadas, sem download; histórico anterior não é importado. A API oficial da Meta foi preservada.

## Validação

As fontes salvas passaram por sincronização, JavaScript e compilação independente dos dois aplicativos. Os testes dirigidos registraram 13 casos no System, 62 no Control, cinco no serviço Node e três no runtime Worker. O QR também foi validado no serviço real. Pareamento com o telefone do proprietário e inspeção visual autenticada continuam pendentes.

Compile cada aplicação com `npm run build:cloudflare` e confira as instruções em `deployment/README.md`. Os commits de origem estão registrados em `SOURCE_MANIFEST.json`. O ramo principal antigo não deve substituir as fontes sincronizadas.
