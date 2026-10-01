# Publicação e transferência

## Projetos atuais no Sites

Os arquivos `.openai/hosting.json` preservam os projetos originais do usuário. Uma atualização desses mesmos projetos deve manter seus IDs e passar pelo fluxo de versão/publicação do Sites. Uma cópia independente deve ser registrada como projeto novo e receber IDs novos fornecidos pelo Sites.

O código exportado não altera a publicação atual. A entrega também não transfere contas, permissões, domínios ou recursos de hospedagem por si só.

Para publicar uma cópia completa, configure primeiro o Supabase, Auth, Storage, segredos, proprietário e os endereços entre System e Control. Publique o Control antes de testar os recursos do System que dependem da ponte, dos planos e do suporte administrativo.

## Cloudflare Workers em conta própria

O código foi preparado para Cloudflare Workers com arquivos estáticos e bindings. Ele não é um site apenas estático nem uma aplicação que possa ser copiada integralmente para hospedagem PHP. Outras plataformas exigem adaptação do runtime.

O auxiliar `scripts/prepare-cloudflare-deployment.mjs` prepara uma configuração de publicação a partir da saída do build, preservando as regras produzidas pelo plugin Cloudflare. Ele acrescenta os bindings `ASSETS` e `IMAGES`, altera o nome do Worker e substitui o ID D1 de exemplo por um recurso seu. Não envia código nem cria recursos na Cloudflare.

1. Em sua conta Cloudflare, crie um D1 auxiliar para cada projeto e anote seus UUIDs reais.
2. Compile cada projeto com `npm run build`.
3. A partir da pasta principal desta entrega, prepare o arquivo de deploy do Control:

```bash
node scripts/prepare-cloudflare-deployment.mjs \
  --project apps/fama-control \
  --worker-name meu-fama-control \
  --database-name meu-fama-control-db \
  --database-id UUID-REAL-DO-D1 \
  --supabase-url https://SEU-PROJETO.supabase.co
```

4. Confira o JSON produzido em `apps/fama-control/dist/server/wrangler.export.json`. Instale as migrações D1 auxiliares, usando os arquivos originais de `drizzle/` e o novo D1. O nome do binding é `DB`.
5. Em um terminal dentro de `fama-control`, confira o empacotamento:

```bash
npx wrangler deploy --config dist/server/wrangler.export.json --dry-run
```

6. Autentique a CLI na sua própria conta e publique quando a configuração estiver completa:

```bash
npx wrangler deploy --config dist/server/wrangler.export.json
```

7. Configure todos os segredos e variáveis necessários no Worker da conta própria pelo painel ou pela CLI. Por exemplo, a CLI pode solicitar o valor sem incluí-lo na linha de comando:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY --name meu-fama-control
```

8. Repita os passos para `fama-system`, com nome e D1 próprios, e as configurações adicionais desse projeto. Os novos endereços devem substituir as referências da instalação antiga antes da publicação final.

O script é um auxiliar de preparação. A conferência do pacote não publica nem testa uma conta Cloudflare diferente. Habilite os recursos necessários dessa conta, inclusive o binding de transformação de imagens quando utilizado pela aplicação. Após cada novo build, execute o auxiliar novamente: os arquivos em `dist/` são gerados.

Se preferir definir a configuração permanentemente na entrada do build, adapte `localBindingConfig` em `vite.config.ts`, preservando os plugins Vinext/Cloudflare e o entrypoint do Worker. Não reutilize o ID D1 de exemplo `00000000-0000-4000-8000-000000000000` em produção.

Documentação oficial: [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/), [secrets](https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [assets](https://developers.cloudflare.com/workers/static-assets/binding/) e [Images binding](https://developers.cloudflare.com/images/optimization/binding/).

## Domínios e retorno de autenticação

Configure os seus domínios no provedor de hospedagem e os destinos de autenticação/redefinição de senha no Supabase. Revise os endereços de webhooks Asaas e Meta e os links em PDFs/páginas. A lista de ocorrências está em `DOMINIOS-E-PROPRIETARIO.md`.

## Conferir a instalação nova

Entre no Control, crie uma empresa de teste e confirme login no System. Cadastre usuários, mude funções e permissões, confirme persistência e isolamento entre empresas. Confira que as opções de cobrança continuam desativadas quando a intenção é acesso gratuito.

A validação descartável do Control só deve ser executada após ajustar seu domínio alvo e confirmar que as duas aplicações e o banco pertencem ao mesmo ambiente. Confirme a limpeza dos registros gerados.
