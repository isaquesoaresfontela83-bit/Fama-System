# Cloudflare — Liquid Glass 15.22.2 — 06/11/2026

Versão conjunta `15.22.2`, lançamento `2026-11-06-button-hover-01`, publicada nos dois Workers existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `5aa26cbe-47ba-41d2-9cd8-d2ccfc33db0f` | `09ed3ebd-898f-479a-96ed-f4d41d421313` |
| Control | https://control.famasystem.online/ | `10b35506-db9b-4a16-9fec-3d28e80e7a9d` | `7a5a9b62-b6ce-47d2-a16f-baafb5876278` |

## Alteração

Tema translúcido inspirado no Liquid Glass, com desfoque, saturação, brilho nas bordas e sombras. Mantém a identidade azul e branca e adapta o material ao tema escuro. Respeita preferência por menor transparência e maior contraste, reduz desfoque no celular e remove efeitos na impressão. Não equivale à renderização nativa da Apple.

A nova entrada envolve `pedidos-main.mjs`. Os 123 módulos anteriores do System e 56 do Control foram preservados e seus hashes conferidos após a publicação; foram adicionados três módulos em cada Worker. Os 41 bindings System e 29 Control foram herdados, mantendo a coleção ASSETS, bancos, credenciais, compatibilidade e observabilidade existentes.

## Validação

- 20 testes passaram, incluindo Pedidos, isolamento, permissões e preservação de respostas e cookies na extensão visual. Verificador conjunto e sintaxe passaram.
- Os dois `/api/health` retornaram `status: ok`, versão 15.22.2 e o mesmo release ID. A base Pedidos permanece 15.21.0 e a aplicação original recuperada 15.20.0.
- As páginas de acesso foram inspecionadas em navegador. Ambas carregam a folha nova; no System, o cartão de acesso apresenta `blur(18px) saturate(1.5)`. Não foi observado transbordamento horizontal na largura desktop conferida.
- SHA-256 do CSS servido: `bafc5ce97ca393616cf0a5bcd24b94aa13f0c7526269d867c132b634d249dd98`.
- Não foi realizado login real nem conferência visual das áreas autenticadas ou em viewport móvel. As verificações de console consultadas mostraram apenas mensagens da extensão do navegador.

## Repositório

README, índice de documentação, comandos da raiz, guias de desenvolvimento/operação e validação GitHub Actions foram organizados. Os caminhos das aplicações foram preservados. O main histórico não representa a produção e não deve ser implantado.

Consulte [operação](OPERACAO.md), [Liquid Glass](../features/liquid-glass/README.md) e [histórico 15.10.0](CLOUDFLARE-15.10.0.md).

## Hover 15.22.2

Adicionada animação suave ao passar o mouse e pressionar os botões. Conferido no navegador real: `:hover` ativo, `translate: 0px -2px`, `brightness(1.06)` e transição de 180 ms. Os dois domínios carregam a folha 15.22.2. Os ajustes de acessibilidade e blur móvel da produção 15.22.1 foram preservados. Foram substituídos apenas os três módulos da extensão em cada Worker, mantendo os demais 123/56 módulos. Não foi realizado login real.
