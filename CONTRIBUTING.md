# Contribuir com o Fama System

## Preparação

Leia [README.md](README.md) e [docs/REPOSITORY.md](docs/REPOSITORY.md). Use Node.js 22.13 ou superior e `npm ci` para respeitar o lockfile. As configurações reais ficam fora do Git; o inventário está em [.env.example](.env.example).

## Alterações

Crie uma branch a partir da revisão atual da `main`. Use nomes como `fix/login`, `feat/agenda` ou `chore/documentacao`. Mantenha cada pull request concentrado em um objetivo, com descrição da mudança e da validação.

Mudanças de organização devem preservar os imports, as migrações, a identidade do projeto em `.openai/hosting.json` e os arquivos de terceiros. `build/` contém código necessário, e `vendor/` é importado pelo CSS.

## Validação

Para mudanças de aplicação:

```sh
npm run lint
npm test
```

Os testes existentes incluem compilação e componentes; eles não comprovam por si só todos os fluxos comerciais. Alterações em sessão, empresa, permissões ou financeiro exigem também testes dos fluxos afetados, incluindo isolamento entre duas empresas.

Para mudanças apenas em documentação, confira os caminhos citados, os comandos e `git diff --check`. Não apresente validação de documentação como teste completo do produto.

## Publicação

Descreva no pull request as variáveis ou migrações necessárias e a versão de destino. Confirme o ambiente antes de integrar uma mudança de configuração do login. Preserve revisões anteriores para recuperação.

Relatos com credenciais ou dados pessoais seguem [SECURITY.md](SECURITY.md).
