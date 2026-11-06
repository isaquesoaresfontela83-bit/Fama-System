# Fama System · Fama Control

Gestão para empresas de piscinas e administração central da plataforma.

**Versão publicada: 15.23.0** · `2026-11-06-customizable-dock-01`

[Fama System](https://famasystem.online/entrar) · [Fama Control](https://control.famasystem.online/) · [Documentação](docs/README.md)

## Estrutura do repositório

| Pasta | Conteúdo |
| --- | --- |
| `apps/system/` | Fontes históricas do aplicativo de gestão e integrações. |
| `apps/control/` | Fontes históricas do painel administrativo. |
| `features/pedidos/` | Módulo de vendas, parcelas e entregas, aplicado sobre a produção recuperada. |
| `features/liquid-glass/` | Tema de vidro, testes, manifesto da base e publicação aditiva. |
| `deployment/cloudflare/` | Ferramentas e documentação de implantação; conferir o guia vigente antes de usar. |
| `deployment/hybrid/` | Infraestrutura histórica retirada do tráfego de produção. |
| `docs/` | Guia de desenvolvimento, operação e histórico de versões. |
| `.github/workflows/` | Validação automática, sem publicação automática. |

## Começar

Use Node.js 24 para os testes da raiz. Não é necessário instalar dependências para executar estes testes:

```sh
npm test
npm run check:companion
```

A prévia do módulo Pedidos usa dados fictícios em memória:

```sh
npm run dev:pedidos
```

Ela não representa o aplicativo completo nem acessa os dados reais. Consulte o [guia de desenvolvimento](docs/DESENVOLVIMENTO.md) antes de executar as aplicações antigas.

## Publicação

**As fontes em `apps/` não representam integralmente a produção atual. Não reconstruí-las sobre os Workers publicados.** A versão atual preserva os módulos recuperados e acrescenta Pedidos e Liquid Glass por extensões. A branch `main` histórica não deve substituir a produção.

System e Control devem ser atualizados juntos, com a mesma versão e o mesmo identificador. Os Workers, bindings, bancos, segredos, domínios e público atuais devem ser preservados.

Consulte o [estado publicado](docs/CLOUDFLARE-STATUS.md), o [guia de operação](docs/OPERACAO.md) e as [instruções do repositório](AGENTS.md).
