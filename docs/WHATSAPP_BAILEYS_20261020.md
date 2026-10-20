# WhatsApp Baileys — Fama 15.4

System e Control publicados juntos em 20/10/2026, com lançamento `2026-10-20-baileys-01`. Os domínios confirmaram a mesma versão. O runtime dos sites continua independente na Cloudflare.

- Fama System: **Chat → WhatsApp** e **Configurações → WhatsApp Baileys**.
- Fama Control: **Integrações → WhatsApp Baileys**. O administrador cadastra e testa o servidor; o token é criptografado no backend.
- Serviço Node completo: `apps/fama-system/services/baileys`. Consulte seu README para instalação ou Docker.

**Pendente:** não existe servidor Baileys persistente provisionado na infraestrutura conectada. O conector informa essa condição. O QR real só será gerado quando o serviço estiver hospedado e configurado; o proprietário precisa escaneá-lo no celular. Não houve pareamento nem envio real de mensagens.

O serviço isola sessões por empresa, mantém credenciais e textos criptografados em SQLite, limita tentativas e não repete envios sem confirmação. Baileys é independente da API oficial da Meta, que foi preservada. O atendimento inicial suporta conversas individuais e texto; mídias recebidas aparecem identificadas, sem download, e histórico anterior não é importado.

Os dois pacotes passaram pela compilação independente e pelas verificações de JavaScript, sincronização e testes dirigidos. A integração usa testes simulados; nenhuma mensagem de cliente foi enviada nos testes. Verificação visual em navegador autenticado e o teste de pareamento real continuam pendentes.

Para compilar, entre separadamente em cada pasta de aplicação, instale com `npm ci` e execute `npm run build:cloudflare`. As credenciais de produção não estão no repositório. Confira as instruções em `deployment/README.md` de cada aplicação. O snapshot anterior do monorepo continua preservado no histórico.
