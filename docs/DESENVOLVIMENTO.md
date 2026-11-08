# Desenvolvimento

## Versão e fonte

O repositório reúne System e Control. As árvores `apps/system` e `apps/control` são históricas: não recompilá-las para substituir a produção. As extensões vigentes estão em `features/`, sobre os módulos recuperados dos Workers.

## Comandos da raiz

| Comando | Finalidade |
| --- | --- |
| `npm test` | Executar os testes de Pedidos, segurança, navegação e Liquid Glass. |
| `npm run test:coverage` | Exigir 90% de linhas, ramificações e funções do backend de Pedidos. |
| `npm run lint` | Análise estática das extensões e ferramentas de auditoria. |
| `npm run check:types` | Verificar tipos dos controles novos de corpo, sessão e limites. |
| `npm run check:secrets` | Procurar padrões de credenciais sem imprimir seus valores. |
| `npm run security:dependencies` | Auditar os três lockfiles; falha para alertas altos/críticos. |
| `npm run build` | Compilar as extensões e conferir o manifesto do candidato conjunto. |
| `npm run test:e2e` | Playwright em desktop, tablet e celular, somente na fixture isolada. |
| `npm run test:pedidos` | Testar vendas, entregas, isolamento e permissões. |
| `npm run test:glass` | Testar a extensão visual e a preservação das respostas. |
| `npm run check:companion` | Conferir versão, lançamento e contratos entre os aplicativos. |
| `npm run check:syntax` | Validar a sintaxe dos 694 arquivos de implementação inventariados. |
| `npm run dev:pedidos` | Abrir a prévia isolada de Pedidos com dados fictícios. |
| `npm run build:pedidos` | Compilar somente a extensão Pedidos; requer esbuild. |

Use Node.js 24, pois os testes de Pedidos usam `node:sqlite`. Execute `npm ci --ignore-scripts` na raiz. Os testes não precisam de credenciais. A prévia `npm run dev` usa dados fictícios em memória; não testa autenticação real nem persistência de produção.

## Verificação das fontes históricas

O CI instala cada aplicativo pelo próprio lockfile, executa o build e depois `node scripts/run-test-suite.mjs` dentro de `apps/system` ou `apps/control`. Essa ordem é necessária: parte dos testes exercita o Worker compilado, o CSS e o WASM gerados. O script normaliza os assets novamente após as fixtures Vite e verifica a compressão antes de executar os testes finais de runtime.

Em 08/11/2026, os dois builds e as suítes completas passaram com instalação limpa no GitHub. Isso valida as árvores históricas; sua substituição sobre os módulos atuais de produção continua proibida. Consulte `docs/audit/REPORT.md` e o commit exato de cada evidência antes de uma publicação.

## Organização

Cada extensão guarda implementação, testes, instruções e manifesto da base em sua própria pasta. Documentos operacionais ficam em `docs/`; resultados de publicação ficam junto à extensão. Não mover caminhos referenciados por imports ou por ferramentas de implantação sem atualizar e validar seus consumidores.

Arquivos gerados, caches, dependências e arquivos locais de ambiente não entram no Git. Nunca adicionar valores de segredos, exportações de bancos ou credenciais ao repositório.
