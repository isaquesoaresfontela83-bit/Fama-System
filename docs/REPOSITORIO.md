# Repositório e GitHub

## Repositório conectado

O código completo está no repositório público [isaquesoaresfontela83-bit/Fama-System](https://github.com/isaquesoaresfontela83-bit/Fama-System), na branch `chore/fama-platform-monorepo`, que reúne Fama System, Fama Control, banco, configurações e documentação.

Para baixar essa organização diretamente do GitHub:

```bash
git clone --branch chore/fama-platform-monorepo https://github.com/isaquesoaresfontela83-bit/Fama-System.git fama-platform
cd fama-platform
npm run verify:source
```

O commit da organização deriva da antiga `main`, preservando seu histórico. Os dez arquivos antigos sem equivalente no snapshot atual ficam em [archive/github-main-2026-09-10/](../archive/github-main-2026-09-10/), com os hashes e a origem documentados. Os arquivos ativos e seus caminhos são os descritos no README da raiz.

O repositório conectado já é público. Os modelos de configuração não contêm credenciais de produção; configure os valores privados apenas no seu ambiente, seguindo [CONFIGURACAO.md](CONFIGURACAO.md).

## Entrega Git

O ZIP original da entrega inclui um repositório Git local, branch principal `main`, commit inicial e tag `snapshot-2026-10-01`. Os commits dos projetos de origem ficam registrados em `SOURCE_MANIFEST.json`. Esse ZIP é uma entrega independente; a proposta no GitHub mantém também o histórico anterior do repositório conectado.

Após extrair o ZIP, entre na pasta `fama-platform` e confira:

```bash
git status
git log -1 --oneline
npm run verify:source
```

Configure seu nome/e-mail de autor antes dos próximos commits. Não é necessário reinicializar o Git da pasta entregue.

## Enviar o ZIP para outro repositório próprio

Crie um repositório privado chamado `fama-platform`, vazio, na sua conta GitHub. Não crie README ou licença automaticamente, pois o repositório já possui seu commit inicial.

Dentro da pasta extraída, conecte o endereço fornecido pelo GitHub:

```bash
git remote add origin https://github.com/SEU-USUARIO/fama-platform.git
git push -u origin main
git push origin snapshot-2026-10-01
```

A autenticação deve ser feita pela sua ferramenta Git ou pelo login oficial da conta. Os dados de acesso não fazem parte deste pacote.

## Branches e colaboração

Use branches curtas para mudanças concretas e abra pull requests para `main`. O modelo de PR pede o comportamento alterado e os resultados da validação. A tag de origem permite identificar a entrega inicial.

## Verificação automática

O workflow `.github/workflows/ci.yml` está preparado para pushes em `main`, pull requests e execução manual. Ele verifica a estrutura e executa uma matriz com cada aplicação: instalação pelo lockfile, TypeScript e testes existentes, que incluem o build.

O workflow utiliza permissões de leitura e serviços simulados dos testes. Consulte a aba Actions e os checks da proposta no GitHub para acompanhar a execução e os resultados. A configuração de um workflow, sozinha, não comprova que os testes passaram.

As ações usadas foram conferidas na documentação oficial: [actions/checkout](https://github.com/actions/checkout) e [actions/setup-node](https://github.com/actions/setup-node).

## Gerar próximas entregas

Depois de fazer commit das alterações:

```bash
npm run package
```

O comando gera em `artifacts/` um ZIP dos arquivos versionados, um identificador de commit e o checksum. Ele verifica a estrutura, exige uma árvore de trabalho limpa e exporta os arquivos do projeto. Credenciais locais e a configuração interna do Git ficam fora dessa exportação de código.

O pacote inicial desta organização também conserva os metadados Git locais para que a pasta extraída já possa ser usada como repositório. Essa é uma diferença deliberada em relação ao exportador de código para entregas futuras.

## Snapshot e evolução do código

A organização inicial está preservada no commit `62f701fc4983eaa685b5149e9a93300e2effac05`. `npm run verify:source` confere os 412 arquivos e seus hashes nesse commit, registrado em `SOURCE_MANIFEST.json`; as versões atuais podem evoluir. Pacotes exportados sem histórico usam `npm run verify`. A assistente do VS Code e sua integração atual estão documentadas em [ASSISTENTE.md](ASSISTENTE.md).
