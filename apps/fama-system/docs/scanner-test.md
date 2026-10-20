# Digitalização experimental

No detalhe de um cliente, contrato ou pedido, abra Arquivos do registro → Digitalizar pelo scanner.

## Requisitos

- Windows, macOS ou Linux com Python 3, NAPS2 e perfil chamado Fama configurado com a digitalizadora. Windows aceita WIA sem NAPS2.
- Scanner disponível e conectado ao mesmo computador do navegador.
- A compatibilidade física com Epson L350 ainda não foi validada.
- Acesso a https://famasystem.online e armazenamento de anexos já configurado na empresa.

Baixe o conector pela própria tela e execute `python fama-scanner.py`. Informe o código temporário exibido. O código muda a cada execução e não é armazenado no navegador. Autorize acesso à rede local se o navegador solicitar.

Com NAPS2, o conector usa o scanner configurado no perfil Fama; no fallback WIA do Windows, usa o primeiro scanner disponível. Captura uma página por solicitação, solicitando 300 dpi. Se houver vários scanners, mantenha apenas o desejado disponível no teste. Confira cada prévia, remova páginas incorretas e salve o PDF (até 20 páginas e 10 MB). O PDF é enviado pela API de anexos existente, com autenticação e isolamento de empresa. Fechar o registro descarta páginas não salvas.

O serviço escuta apenas em 127.0.0.1:17843, exige origem exata e código da sessão. Os arquivos de captura temporários são removidos ao fim de cada solicitação. Para encerrar, use Ctrl+C. Este teste não instala serviço automático e não implementa OCR.

## Validação executada

- Análise de sintaxe JavaScript/JSX e build de produção.
- 86 testes existentes de segurança, incluindo rejeição de acesso anônimo aos anexos.
- Conector: rejeição de origem externa, rejeição de código incorreto, preflight autorizado e erro explícito fora do Windows.
- Oito testes automatizados cobrem origem, autenticação, status, captura simulada NAPS2, concorrência, timeout e detecção Linux/macOS.
- Captura real, permissões do navegador e fluxo completo com scanner dependem do computador do usuário.
- Android/iOS não executam o conector. ChromeOS depende de Linux com acesso ao scanner, sem suporte garantido. Nenhuma câmera é utilizada.

## Publicação

Os testes que importam o Worker podem restaurar arquivos WASM grandes da IA no diretório dist. Após esses testes, execute `node scripts/verify-release-assets.mjs` antes de empacotar e confirme que o arquivo final não contém entradas acima de 25 MiB.
