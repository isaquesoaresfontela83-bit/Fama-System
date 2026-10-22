# Publicação Cloudflare

As duas aplicações usam seus Workers completos, com as fontes e a interface originais. Não usar os encaminhadores de `deployment/hybrid` nem o Blueprint Render arquivado.

1. Compilar as duas aplicações com `npm run build:cloudflare`. O comando prepara `dist/server/fama-entry.mjs`, o binding `FAMA_STATIC_ASSETS` e um manifesto completo de todos os JS/CSS em `dist/server/fama-static-assets.json`.
2. Executar `node apps/system/scripts/verify-companion.mjs apps/control` a partir da raiz e os testes relevantes antes de publicar qualquer aplicação.
3. Publicar o pacote completo de cada Worker com seus assets. Preservar os bindings, domínios e segredos existentes; não preencher o ambiente com valores vazios. Para a publicação via API que retém a coleção ASSETS existente, carregar também TODOS os JS/CSS do manifesto na base de arquivos públicos, incluindo dependências compartilhadas e imports dinâmicos. Não carregar só os arquivos iniciais da página.
4. Conferir o manifesto antes de ativar: caminho, tamanho dos bytes decodificados e checksum de cada arquivo devem corresponder ao build. Publicar cada arquivo completo, sem expor conteúdo parcial. A base de arquivos públicos é independente dos bancos operacionais; nunca guardar dados de clientes ou segredos nela. A tabela auxiliar `static_asset_parts` serve apenas para montar uploads públicos em partes.
5. Ativar as versões preparadas nos dois Workers e verificar `/api/health`, páginas de acesso, console do navegador, planos e rotas privadas sem autenticação. Um HTTP 200 na saúde não comprova o carregamento dos módulos da interface.

Os wrappers de entrada versionados aqui são cópias exatas dos ativados em 22/10/2026. Servem apenas caminhos estáticos permitidos por GET/HEAD e encaminham os demais pedidos ao aplicativo original. Cache usa a URL completa, inclusive o domínio, e nunca armazena APIs privadas. Binários e demais arquivos públicos permanecem na coleção ASSETS existente.

Versão e verificações atuais: `../../docs/CLOUDFLARE-STATUS.md`.
