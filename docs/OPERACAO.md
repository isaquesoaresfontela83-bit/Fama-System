# Operação e publicação

## Destino

| Aplicação | Worker | Domínio |
| --- | --- | --- |
| System | `fama-system-app` | https://famasystem.online/entrar |
| Control | `fama-control-app` | https://control.famasystem.online/ |

O estado verificado está em [CLOUDFLARE-STATUS.md](CLOUDFLARE-STATUS.md). A infraestrutura híbrida é histórica e não deve ser restaurada como destino.

## Fluxo vigente

1. Ler as instruções da raiz e dos dois aplicativos. Recuperar a produção dos dois Workers e conferir a versão ativa.
2. Preservar todos os módulos existentes e registrar hashes, versões e contagens antes de preparar uma extensão. Não usar a árvore antiga de `apps/` como substituição.
3. Atualizar o mesmo `lib/fama-release.js` nos dois aplicativos. Executar `npm test`, `npm run check:syntax` e `npm run check:companion`.
4. Validar os dois pacotes antes de ativar o primeiro. Conferir que a base em produção continua igual à capturada.
5. Herdar os bindings e manter ASSETS, compatibilidade, observabilidade, público e domínios. Não recriar bancos ou segredos.
6. Publicar o conjunto. Se a segunda publicação falhar, restaurar a versão anterior da primeira e registrar o resultado.
7. Ler de volta os módulos e conferir sua integridade. Verificar os dois endpoints de saúde, páginas de acesso, CSS e recursos frontend. Registrar os limites da validação autenticada.
8. Salvar o resultado de implantação, atualizar o estado documentado e enviar a alteração ao GitHub.

## Liquid Glass

`features/liquid-glass/deploy.mjs` recebe a API autenticada Cloudflare, o ID da conta e `{baseline, entry, css}`. Sem ativação, prepara e confere os dois pacotes. A ativação é explícita pelo argumento `activate` e verifica novamente a versão e o hash da base.

Cada manifesto registra a produção **antes** da publicação correspondente. Para uma atualização posterior, recuperar e registrar a nova base. O publicador rejeita uma base diferente ou módulos desconhecidos da extensão; quando a base confere, substitui somente `glass-main.mjs`, `glass-core.mjs` e `glass-styles.mjs`. Nunca reutilizar um manifesto antigo como se fosse a produção atual.

A autorização permanente do proprietário está registrada em `AGENTS.md`. Controles de aprovação da conexão continuam aplicáveis.
