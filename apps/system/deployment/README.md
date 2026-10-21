# Fama System na Cloudflare

`npm run build:cloudflare` gera o servidor em `dist/server` e os arquivos da interface em `dist/client`.

Com a autenticação da própria conta Cloudflare configurada, publique os dois juntos:

```sh
npx wrangler deploy --config dist/server/wrangler.json --keep-vars
npm run smoke:production
```

O arquivo `cloudflare.json` registra os domínios, o banco D1 e as conexões internas com Control e IA. As credenciais ficam somente no ambiente do Worker.

A verificação pública confere a versão dos três domínios, os arquivos da interface, o bloqueio de APIs sem sessão, a origem de operações e a rejeição de cabeçalhos de identidade falsificados. Ela não entra em contas nem movimenta dados de clientes.

As ferramentas em `/mcp` e os endpoints internos exigem `FAMA_BACKUP_SERVICE_TOKEN`. Cabeçalhos informados pelo cliente não autenticam o proprietário. A IA continua no serviço Python `fama-ai-python`.

Arquivos WASM acima de 25 MiB são entregues pela cópia gzip correspondente; a entrada do Worker faz a descompressão. A verificação do pacote deve rodar após os testes, pois fixtures de compilação podem recriar esses arquivos.

Ao atualizar também o endereço legado, limpe os arquivos temporários de sincronização do pacote antes de enviá-lo: `python3 scripts/clean-release-archive.py pacote-original.tar pacote-final.tar`. O comando preserva os arquivos compilados, remove diretórios `.rsync-tmp` e valida o limite de 25 MiB por arquivo.
