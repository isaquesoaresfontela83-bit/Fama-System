# Cloudflare — Liquid Glass 15.22.0 — 06/11/2026

Versão conjunta `15.22.0`, lançamento `2026-11-06-liquid-glass-01`, publicada nos dois Workers existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `67479458-5a72-4263-8917-b674d75ac519` | `5e94c29e-a3e7-424f-8302-f1d68b14ff64` |
| Control | https://control.famasystem.online/ | `03d35243-6717-447f-815d-49109aff643f` | `0c1be2af-dc2c-4fc6-a677-eca5c065ee2d` |

## Alteração

Tema translúcido inspirado no Liquid Glass, com desfoque, saturação, brilho nas bordas e sombras. Mantém a identidade azul e branca e adapta o material ao tema escuro. Respeita preferência por menor transparência e maior contraste, reduz desfoque no celular e remove efeitos na impressão. Não equivale à renderização nativa da Apple.

A nova entrada envolve `pedidos-main.mjs`. Os 123 módulos anteriores do System e 56 do Control foram preservados e seus hashes conferidos após a publicação; foram adicionados três módulos em cada Worker. Os 41 bindings System e 29 Control foram herdados, mantendo a coleção ASSETS, bancos, credenciais, compatibilidade e observabilidade existentes.

## Validação

- 20 testes passaram, incluindo Pedidos, isolamento, permissões e preservação de respostas e cookies na extensão visual. Verificador conjunto e sintaxe passaram.
- Os dois `/api/health` retornaram `status: ok`, versão 15.22.0 e o mesmo release ID. A base Pedidos permanece 15.21.0 e a aplicação original recuperada 15.20.0.
- As páginas de acesso foram inspecionadas em navegador. Ambas carregam a folha nova; no System, o cartão de acesso apresenta `blur(18px) saturate(1.5)`. Não foi observado transbordamento horizontal na largura desktop conferida.
- SHA-256 do CSS servido: `ccf7f4827371ef0081ad627b3d726e205a4060d63af51ff6511caecfd607e433`.
- Não foi realizado login real nem conferência visual das áreas autenticadas ou em viewport móvel. As verificações de console consultadas mostraram apenas mensagens da extensão do navegador.

## Repositório

README, índice de documentação, comandos da raiz, guias de desenvolvimento/operação e validação GitHub Actions foram organizados. Os caminhos das aplicações foram preservados. O main histórico não representa a produção e não deve ser implantado.

Consulte [operação](OPERACAO.md), [Liquid Glass](../features/liquid-glass/README.md) e [histórico 15.10.0](CLOUDFLARE-15.10.0.md).
