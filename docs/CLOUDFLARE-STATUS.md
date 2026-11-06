# Cloudflare — Liquid Glass 15.22.3 — 06/11/2026

Versão conjunta `15.22.3`, lançamento `2026-11-06-animated-dock-01`, publicada nos dois Workers existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `020d4e60-8033-4e03-b862-883a8b0b88cd` | `743e1a57-31ff-4279-b0ec-b2495cedaf8f` |
| Control | https://control.famasystem.online/ | `a4a6dafe-ed37-4a23-9191-1cb25e8e1d58` | `b8bc2825-054f-4195-85a8-269559c6e6f2` |

## Alteração

Tema translúcido inspirado no Liquid Glass, com desfoque, saturação, brilho nas bordas e sombras. Mantém a identidade azul e branca e adapta o material ao tema escuro. Respeita preferência por menor transparência e maior contraste, reduz desfoque no celular e remove efeitos na impressão. Não equivale à renderização nativa da Apple.

A nova entrada envolve `pedidos-main.mjs`. Os 123 módulos anteriores do System e 56 do Control foram preservados e seus hashes conferidos após a publicação; foram adicionados três módulos em cada Worker. Os 41 bindings System e 29 Control foram herdados, mantendo a coleção ASSETS, bancos, credenciais, compatibilidade e observabilidade existentes.

## Validação

- 20 testes passaram, incluindo Pedidos, isolamento, permissões e preservação de respostas e cookies na extensão visual. Verificador conjunto e sintaxe passaram.
- Os dois `/api/health` retornaram `status: ok`, versão 15.22.3 e o mesmo release ID. A base Pedidos permanece 15.21.0 e a aplicação original recuperada 15.20.0.
- As páginas de acesso foram inspecionadas em navegador. Ambas carregam a folha nova; no System, o cartão de acesso apresenta `blur(18px) saturate(1.5)`. Não foi observado transbordamento horizontal na largura desktop conferida.
- SHA-256 do CSS servido: `a61dd47370e011d958cc407c9ebb4a116fa2524d5b35c21ab343b26a998521da`.
- Não foi realizado login real nem conferência visual das áreas autenticadas ou em viewport móvel. As verificações de console consultadas mostraram apenas mensagens da extensão do navegador.

## Repositório

README, índice de documentação, comandos da raiz, guias de desenvolvimento/operação e validação GitHub Actions foram organizados. Os caminhos das aplicações foram preservados. O main histórico não representa a produção e não deve ser implantado.

Consulte [operação](OPERACAO.md), [Liquid Glass](../features/liquid-glass/README.md) e [histórico 15.10.0](CLOUDFLARE-15.10.0.md).

## Hover 15.22.3

Adicionada animação suave ao passar o mouse e pressionar os botões. Conferido no navegador real: `:hover` ativo, `translate: 0px -2px`, `brightness(1.06)` e transição de 180 ms. Os dois domínios carregam a folha 15.22.3. Os ajustes de acessibilidade e blur móvel da produção 15.22.1 foram preservados. Foram substituídos apenas os três módulos da extensão em cada Worker, mantendo os demais 123/56 módulos. Não foi realizado login real.

## Barra inferior 15.22.3

Publicadas as animações da barra inferior: entrada, salto do ícone selecionado, hover com aumento e elevação, giro do Novo e resposta de pressão. Os 20 testes, sintaxe e verificador conjunto passaram. As duas páginas públicas carregam a folha 15.22.3; não houve login para conferir a barra autenticada. Não declarar essa interação visual testada em conta real.
