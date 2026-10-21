# Fama Control na Cloudflare

`npm run build:cloudflare` gera a versão independente em `dist/server` e os arquivos da interface em `dist/client`.

Com a autenticação da própria conta Cloudflare configurada, publique o conjunto completo:

```sh
npx wrangler deploy --config dist/server/wrangler.json --keep-vars
```

O arquivo `cloudflare.json` registra os domínios, o banco D1 e as conexões internas com System e IA. As credenciais permanecem no ambiente do Worker.

O backup completo usa as funções existentes do banco e confere a restauração. A cópia externa exige ativar R2 na conta e vincular o bucket como `BUCKET`; sem isso, o sistema deve informar a pendência.

Alterações de esquema e de planos exigem verificação própria. Publicar o Worker não deve recriar bancos ou alterar assinaturas.
