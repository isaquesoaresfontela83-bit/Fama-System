# Desenvolvimento

## Versão e fonte

O repositório reúne System e Control. As árvores `apps/system` e `apps/control` são históricas: não recompilá-las para substituir a produção. As extensões vigentes estão em `features/`, sobre os módulos recuperados dos Workers.

## Comandos da raiz

| Comando | Finalidade |
| --- | --- |
| `npm test` | Executar os 25 testes de Pedidos e Liquid Glass. |
| `npm run test:pedidos` | Testar vendas, entregas, isolamento e permissões. |
| `npm run test:glass` | Testar a extensão visual e a preservação das respostas. |
| `npm run check:companion` | Conferir versão, lançamento e contratos entre os aplicativos. |
| `npm run check:syntax` | Validar a sintaxe da extensão e do publicador Liquid Glass. |
| `npm run dev:pedidos` | Abrir a prévia isolada de Pedidos com dados fictícios. |
| `npm run build:pedidos` | Compilar somente a extensão Pedidos; requer esbuild. |

Use Node.js 24, pois os testes de Pedidos usam `node:sqlite`. Os testes da raiz não precisam de instalação de pacotes ou credenciais.

## Organização

Cada extensão guarda implementação, testes, instruções e manifesto da base em sua própria pasta. Documentos operacionais ficam em `docs/`; resultados de publicação ficam junto à extensão. Não mover caminhos referenciados por imports ou por ferramentas de implantação sem atualizar e validar seus consumidores.

Arquivos gerados, caches, dependências e arquivos locais de ambiente não entram no Git. Nunca adicionar valores de segredos, exportações de bancos ou credenciais ao repositório.
