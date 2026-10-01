# Desenvolvimento pela raiz

## Preparação

Use Linux/WSL2 com Node.js 22.13 ou superior. O arquivo `.nvmrc` seleciona a série 22 para ferramentas compatíveis.

```bash
npm run verify
npm run setup
npm run install:apps
```

Os modelos são copiados para `apps/fama-system/.dev.vars` e `apps/fama-control/.dev.vars`. O comando preserva qualquer arquivo existente. Esses arquivos ficam fora do versionamento; os modelos em `config/env/` continuam disponíveis no Git.

Prepare um Supabase de desenvolvimento seguindo [BANCO.md](BANCO.md), preencha as configurações segundo [CONFIGURACAO.md](CONFIGURACAO.md) e ajuste os endereços conforme [DOMINIOS-E-PROPRIETARIO.md](DOMINIOS-E-PROPRIETARIO.md).

## Executar

Em terminais separados:

```bash
npm run dev:system
```

```bash
npm run dev:control
```

O System usa a porta 5173 e o Control a porta 5174. As aplicações continuam aceitando seus próprios comandos dentro de `apps/<aplicação>/`.

## Verificar mudanças

```bash
npm run verify
npm run typecheck
npm test
```

O teste de cada aplicação já compila seu projeto. Use `npm run build` isoladamente quando precisar apenas dos artefatos de publicação.

Para trabalhar em uma aplicação:

```bash
npm run typecheck -- --app system
npm test -- --app control
```

`npm run verify:source` compara as fontes com o snapshot de origem. Esse comando atende à conferência da entrega; após mudanças de código deliberadas, seus hashes naturalmente podem divergir. A CI utiliza `npm run verify`, que permite desenvolver sobre a entrega.

## Dependências

Cada aplicação mantém seu `package-lock.json`, `.npmrc` e `vendor/`. O orquestrador da raiz usa o diretório correto ao chamar npm. Os scripts de build originais procuram executáveis no `node_modules` local, por isso a organização usa instalações independentes em vez de hoisting de workspaces.

Ao alterar dependências, execute npm na aplicação correspondente e versione seu lockfile. O package da raiz organiza os comandos e não requer dependências adicionais.

## Banco e publicação

Mantenha as alterações SQL versionadas e separe snapshot de criação de migração de instalação existente. A publicação continua por aplicação, conforme [PUBLICACAO.md](PUBLICACAO.md).
