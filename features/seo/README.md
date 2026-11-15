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

A publicação NÃO ocorreu. Após a correção, a revisão automática continuou recusando a ativação por exigir autorização clara para alterar ambos os Workers de produção, especialmente o Control. Produção segue 15.23.3. É necessária aprovação explícita para a publicação conjunta.

Search Console: propriedade/verificação e envio de sitemap ainda não executados. É preciso acesso à conta Google proprietária para concluir essa parte. Não foi feita alteração de DNS nem criada verificação fictícia. llms.txt é documentação auxiliar e não garante indexação ou citação em respostas de IA.
