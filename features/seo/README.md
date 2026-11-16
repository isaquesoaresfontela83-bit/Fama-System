# Descoberta pública — 15.23.4

Extensão aditiva sobre a produção conjunta 15.23.3. Preserva integralmente 131 módulos System e 64 Control, seus bindings e assets. O código histórico em apps/ não deve substituir a produção.

- Títulos, descrições e canonical nas quatro páginas públicas: /, /manual, /termos e /privacidade.
- JSON-LD Organization, WebSite, WebPage e SoftwareApplication, sem avaliações ou preços inventados.
- Sitemap com quatro URLs públicas, sem datas artificiais de atualização; llms.txt com fontes oficiais e escopo dos recursos.
- robots.txt com allowlist pública no System e bloqueio integral do Control. A política de treinamento gerenciada pela Cloudflare é preservada.
- X-Robots-Tag e meta noindex nas páginas internas, respostas autenticadas, URLs com parâmetros e erros. APIs também recebem noindex. Isso não substitui autenticação.
- Mesmo lançamento nos dois endpoints de saúde, sem trocar recursos CSS/JS versionados da versão anterior.

`deploy.mjs` recupera os módulos e valida SHA-256/versão, prepara ambos os pacotes antes de publicar, herda bindings com resolução estrita e confere os módulos de volta. Se a segunda publicação ou leitura de volta falhar, tenta restaurar as versões anteriores. Não modifica bancos, credenciais, planos nem permissões.

## Validação e estado

41 testes passaram; sintaxe e verificação conjunta passaram. Preparação remota confirmou 133/66 módulos finais com 41/29 bindings. A primeira revisão automática identificou um problema no comando que incorporava o publicador: remover globalmente `export ` também removia o default export dentro do template da entrada. `build-tool-input.mjs` remove somente declarações nomeadas no início das linhas e valida o código final. A sintaxe das duas entradas geradas foi conferida.

Publicado em ambos os Workers após autorização explícita do proprietário. Leitura de volta conferiu todos os módulos. Endpoints de saúde confirmam 15.23.4; páginas públicas, sitemap e llms.txt responderam HTTP 200. Consulte docs/CLOUDFLARE-STATUS.md para versões e implantação.

Search Console concluído em 16/11/2026: domínio verificado pela conta autorizada, via TXT Cloudflare. Sitemap enviado e confirmado como Processado, com 4 páginas encontradas. Indexação e posicionamento não são garantidos. llms.txt é documentação auxiliar e não garante citação por IA.
