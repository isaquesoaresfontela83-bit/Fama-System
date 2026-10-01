# Desenvolvimento e contribuição

Comece pelo [guia de desenvolvimento](docs/DESENVOLVIMENTO.md). Mantenha a alteração na aplicação ou no diretório compartilhado que realmente a utiliza.

## Organização

- Código operacional: `apps/fama-system/`.
- Administração: `apps/fama-control/`.
- Snapshot e documentação do banco compartilhado: `database/` e `docs/BANCO.md`.
- Configurações de exemplo: `config/env/`.
- Comandos do repositório: `scripts/`.

Preserve os lockfiles e atualize a documentação quando mudar um comando, endpoint, configuração ou migração. Os artefatos de build são gerados em cada aplicação; os arquivos históricos ficam em `archive/`.

## Verificação

Execute `npm run verify`, `npm run typecheck` e os testes adequados à alteração. Os comandos aceitam `--app system` ou `--app control` para selecionar o projeto. Informe os resultados no pull request.

O manifesto documenta a entrega original. Use `npm run verify:source` para conferir essa origem; mudanças deliberadas no código podem divergir do snapshot sem impedir a verificação normal da CI.

## Configurações e dados

Versione modelos de configuração; mantenha os valores reais nos arquivos locais ignorados ou nos segredos da hospedagem. Exemplos e testes devem usar dados sintéticos. Preserve as licenças e avisos dos fornecedores que já acompanham as aplicações.

## Pull requests

Explique o problema concreto, o comportamento resultante e a validação executada. Para alterações de banco, indique se o SQL atende uma instalação nova ou atualiza uma instalação existente.
