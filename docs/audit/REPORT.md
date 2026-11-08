# Auditoria Fama System e Fama Control — 07/11/2026

**Candidato corrigido e testado parcialmente; publicação bloqueada.** A produção permanece em 15.23.2. O candidato 15.24.0 não representa uma auditoria integral concluída nem aprovação do sistema completo para produção.

Branch `audit/security-quality-2026-11-07`, baseada em `bf185fd30ff47b174d483ae99662cb110554338d` (`release/15.23.2-mobile-tap`). A `main` é histórica. Não houve gravação em registros reais, envio de mensagens, cobrança, sobrecarga ou exploração de terceiros. Nenhuma migração foi aplicada.

## Arquitetura e inventário

| Camada | Estado verificado |
| --- | --- |
| System | Worker `fama-system-app`, 127 módulos; versão ativa `b9d6df1c-94e2-4a8a-892f-ccd5b75aa2bd` |
| Control | Worker `fama-control-app`, 60 módulos; versão ativa `5cff2387-f835-46c6-9a7b-26d1fa36b5d5` |
| Entradas | Liquid Glass → Pedidos → `index.js` original; código original e assets não foram recompilados |
| Dados | D1 existentes; Supabase Auth e REST; criptografia de campos e autorização por empresa |
| Administração | Control → System por service binding e HMAC com timestamp para políticas de Pedidos |
| Credenciais | Bindings secretos existentes; valores não exportados para relatórios |
| Fonte histórica System | 707 arquivos, 553 JavaScript, 88 rotas, 95 arquivos de testes |
| Fonte histórica Control | 426 arquivos, 335 JavaScript, 53 rotas, 53 arquivos de testes |

[inventory.json](inventory.json) contém 148 entradas de rotas, incluindo sete da extensão. Referências estáticas a testes não provam execução. [baseline-15.24.0.json](../../features/liquid-glass/baseline-15.24.0.json) registra os 187 módulos publicados e seus hashes. O build do candidato confere 120 módulos originais System e 53 Control preservados, com sete módulos de extensão por aplicação.

Não houve leitura manual de 100% dos arquivos. A análise de sintaxe percorreu 694 arquivos de implementação; a revisão manual concentrou-se nas entradas, autenticação, autorização, persistência e extensões. A produção recuperada não tem correspondência integral com as árvores em `apps/`.

## Segurança

As correções abaixo estão na branch, **ainda fora de produção**.

| ID | Severidade | Causa e efeito | Correção e regressão |
| --- | --- | --- | --- |
| F01 | Média | Cookies renovados descartados e verificações de sessão/acesso em paralelo podiam interromper a sessão de Pedidos | Renovação sequencial, propagação interna e devolução de cookies; teste de sessão inicialmente falhou |
| F02 | Média | Leitura de corpo limitada em bytes, sem prazo | Prazo de 10 s, cancelamento/desbloqueio do reader e erros 408/400; testes de stream parado, falha e aborto |
| F03 | Média | Escritas novas sem quota própria | Contador persistente por empresa, usuário e ação: 60 mutações, 10 uploads e 15 políticas/minuto; 429 e Retry-After; testes de concorrência e janela |
| F04 | Baixa | Produto nulo retornava 503 e campos de texto aceitavam objetos | Validação de estrutura/tipos, erro 400 antes da gravação; duas regressões inicialmente falharam |
| F05 | Baixa | `application/json-seq` aceito como JSON | Media type exato, objeto JSON e UTF-8 estrito; regressão inicialmente falhou |
| F06 | Baixa | Dois bytes JPEG ou quatro bytes PNG aceitos como imagem | Assinatura JPEG ampliada, assinatura completa/IHDR de PNG e versão PDF; regressão inicialmente falhou. Não é antivírus |
| F07 | Alta, disponibilidade | Menu sem `<li>` podia clonar a raiz observada continuamente e congelar a aba | Inserção dentro do menu, sem clonar sua raiz; reproduzido no navegador e coberto em menus planos e listas |
| F08 | Baixa | Respostas novas não herdavam todos os headers da aplicação | CSP restritiva para JSON, bloqueio de enquadramento, política de referência e cache privado; anexos mantêm download autenticado/sandbox |
| F09 | Baixa, ferramenta | esbuild 0.28.0 no intervalo de um aviso de leitura local no servidor de desenvolvimento Windows | Ferramenta atualizada para 0.28.2; scanner da raiz terminou com zero alertas |

Isolamento entre empresas, HMAC, permissões comerciais/financeiras, revisão otimista, idempotência, criptografia e origens foram exercitados em fixtures. Não foi confirmada exploração SQL/NoSQL Injection, XSS, CSRF ou escalonamento em produção. Isso não comprova ausência de outras vulnerabilidades.

### Dependências pendentes

Cada lockfile histórico apresentou **34 pacotes sinalizados: 3 críticos, 14 altos, 16 moderados e 1 baixo**. Não são 68 vulnerabilidades independentes: os dois aplicativos compartilham muitos avisos, inclusive transitivos.

Os críticos são `next` 16.4.0, `dompurify` 3.4.16 e o efeito transitivo em `jspdf`. Há alertas altos em RSC, Vite, Wrangler, Zod e outros. O scanner comprova o intervalo de versões, sem demonstrar a exploração de cada aviso. O Next do lockfile não prova que o servidor Next afetado esteja sendo usado pelo Worker Vinext.

A string **DOMPurify 3.4.16 foi encontrada em um módulo SSR publicado**. A referência do navegador e os modos de sanitização afetados ainda exigem rastreamento. Atualizar bundles isoladamente ou reconstruir a produção com a fonte histórica não foi considerado uma correção validada. É necessário sincronizar a fonte vigente, atualizar os pacotes compatíveis e testar o conjunto.

Referências primárias: [DOMPurify GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), [Next GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [RSC GHSA-wx67-qw84-cm4g](https://github.com/advisories/GHSA-wx67-qw84-cm4g). Os JSON reais do scanner são artefatos do CI.

### Banco e infraestrutura

O Supabase retornou 67 observações informativas de RLS habilitado sem política, seis avisos de `search_path` mutável e um aviso de proteção nativa contra senhas vazadas desativada. RLS sem política não significa acesso público. O aplicativo possui consulta própria de senhas vazadas; caminhos alternativos diretos do Auth não foram validados.

Duas tabelas privadas do Control não têm RLS: `fama_platform_integrations` e `fama_provider_activity`. Não há SELECT concedido a `anon`/`authenticated`; ambas pertencem ao backend. Não foram encontradas funções SECURITY DEFINER desses schemas/public executáveis por `anon`. Seis verificações SELECT das funções JSON passaram, sem dados de usuários.

A revisão automática **rejeitou** aplicar ajustes de `search_path` e RLS em produção por risco de interromper acessos sem comprovação suficiente de impacto e rollback. Nada foi aplicado. [runtime-hardening-review.sql](../../deployment/security/runtime-hardening-review.sql) contém o SQL, premissas e reversão. A aplicação posterior exige autorização explícita, nova conferência e backup verificado.

Logs dos Workers estão habilitados, com redação de query strings; traces estão desabilitados. Não houve alteração de observabilidade, compatibilidade, DNS, serviços externos ou credenciais.

## Qualidade

Últimas rodadas locais completas, sem somar repetições:

| Suíte | Itens contabilizados | Aprovados | Reprovados |
| --- | ---: | ---: | ---: |
| Extensões: Pedidos, controles, navegação e Liquid Glass | 58 | 58 | 0 |
| Fonte histórica System | 917 | 892 | 25 |
| Fonte histórica Control | 531 | 518 | 13 |
| **Total local** | **1.506** | **1.468** | **38** |

Contagens históricas incluem arquivos que falharam antes de carregar todos os testes internos, contabilizados pelo Node como um item. Não houve testes marcados como ignorados nas rodadas finais. [legacy-failures.json](legacy-failures.json) registra as 38 falhas: bundles `dist`/WASM ausentes, fixtures de runtime, PDFs, câmera/scanner, estilo gerado e expectativas divergentes de IA, planos e agenda. Testes e funções não foram apagados para obter aprovação. A instalação local de apoio reutilizou parte das dependências disponíveis; esse resultado não substitui um build reprodutível da fonte publicada.

### Cobertura real

Node V8, sete arquivos do **backend de Pedidos**, com 44 testes nessa rodada:

| Escopo | Linhas | Ramificações | Funções |
| --- | ---: | ---: | ---: |
| Backend de Pedidos e controles | **99,45%** | **93,31%** | **96,58%** |
| API de Pedidos isoladamente | 98,98% | 91,83% | 93,10% |
| Modelo, quotas, corpo, sessão e storage | 100% em cada arquivo | 92,31% a 100% | 100% |

O CI exige 90% das três métricas nesse escopo. Frontend completo, árvores históricas, banco real e provedores externos não estão incluídos. [coverage.txt](coverage.txt) e [tests-final.tap](tests-final.tap) contêm evidências; [regressions-before.tap](regressions-before.tap) registra cinco falhas antes das correções. Tipos foram verificados nos controles novos de corpo, sessão e quota e suas dependências, sem alegação de validação integral da interface histórica.

### Interface e integração

O navegador, com dados fictícios, confirmou busca/estado vazio, formulário, criação, permanência ao recarregar, configuração/persistência do atalho Financeiro e administração correspondente. Frames de celular/tablet não mostraram transbordamento do documento: 375/375 px úteis no frame nominal de 390 px e 820/820 px no tablet. A tabela mantém rolagem interna. [Captura](mobile-qa.jpg).

Playwright contém nove cenários distribuídos por desktop (1280×900), tablet (820×1180) e celular (390×844 com toque), sobre a fixture isolada. O resultado efetivo remoto está no CI; configurar os cenários não prova sua aprovação.

Doze GETs seguros de produção verificaram páginas, saúde e acesso anônimo. System retornou 401 em acesso/Pedidos/administração e 403 na política interna sem assinatura; rotas ausentes do Control retornaram 404 e sua administração retornou 401. Saúde e páginas retornaram 200; ambos continuam na 15.23.2. Isso não comprova o funcionamento autenticado.

Não houve login real, celular físico, auditoria completa de acessibilidade ou testes reais de pagamentos, e-mail, WhatsApp, MFA, upload no Supabase e reconexão com terceiros. Funções que dependem desses ambientes permanecem não verificadas.

## Desempenho

| Cenário isolado | Antes | Depois |
| --- | ---: | ---: |
| Consultas de parcelas ao abrir pedido com entrada e 36 parcelas | 37 | 1 |
| Redução de consultas | — | 97,3% |

A leitura em lote mantém a empresa e os IDs autorizados, com regressão executada. Esse número não foi extrapolado para tempo de produção. Não há comparativo válido antes/depois de Core Web Vitals, memória, FPS ou latência de provedores. O congelamento do menu foi corrigido sem modificar a identidade visual.

## GitHub e publicação

Commits de implementação: `6bf2a22` (correções/regressões) e `b7d41a3` (ferramentas, CI e interface). O histórico da branch contém também o relatório e eventuais ajustes finais. A relação exata de arquivos está no diff da branch. Estado observado do pipeline: [GITHUB-STATUS.md](GITHUB-STATUS.md).

O candidato conjunto foi compilado; sete módulos por aplicação tiveram sintaxe e hashes conferidos. O build original integral publicado não foi reproduzido, pois sua fonte não está integralmente sincronizada.

O workflow executa qualidade, dependências, interface e suítes históricas. O `release-gate` exige todos; falhas não viram sucesso. Relatórios são artefatos por 14 dias. A raiz terminou sem padrões de credenciais reais detectados; a varredura é limitada a padrões conhecidos e não cobre todo o histórico Git.

**O gate local de dependências reprovou. Não há implantação automática nesse workflow.** Proteção obrigatória de branch e bloqueio de publicações manuais fora do CI não foram configurados. Nenhum Worker foi atualizado por esta auditoria.

### Condições de liberação

1. Recuperar fonte vigente completa, corrigir alertas críticos/altos aplicáveis e tratar as 38 falhas históricas, distinguindo expectativas antigas de defeitos reais.
2. Aprovar os jobs e validar os dois aplicativos em homologação com sessões/perfis reais. A fixture fictícia não substitui essa etapa.
3. Criar aditivamente `sales_order_rate_limits` nos D1 correspondentes, conforme `features/pedidos/rate-limit.mjs`. Sem a tabela, as mutações do candidato falham de forma fechada.
4. Reconfirmar 187 hashes e versões ativas; atualizar sete módulos conhecidos juntos, preservando bindings, ASSETS, dados, domínios e público. `deployGlass` sozinho não aplica o candidato completo.
5. Aplicar qualquer ajuste PostgreSQL somente após autorização pendente e conferências documentadas.

### Rollback preparado, não executado

Conservar versões e manifesto capturados. Para uma futura ativação malsucedida, direcionar 100% do tráfego System à versão `b9d6df1c-94e2-4a8a-892f-ccd5b75aa2bd` e Control à `5cff2387-f835-46c6-9a7b-26d1fa36b5d5`, depois verificar saúde, páginas e assets dos dois domínios. Reconfirmar a ausência de publicação posterior antes de escolher essas versões. A tabela aditiva de quotas pode permanecer sem interferir no código anterior. Não excluir registros para reverter código.

A reversão PostgreSQL específica está comentada no SQL. Não houve ensaio de rollback em produção nem backup de dados verificado nesta rodada. A auditoria permanece aberta nos itens pendentes acima.
