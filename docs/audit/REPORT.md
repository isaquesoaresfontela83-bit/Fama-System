# Auditoria Fama System e Fama Control — 08/11/2026

**A branch passou na validação automatizada; a auditoria integral e a publicação da aplicação continuam pendentes.** Foram corrigidas as falhas reproduzidas nas extensões, os alertas dos três lockfiles e a execução histórica de testes. O endurecimento PostgreSQL foi aplicado e verificado. A aplicação publicada permanece em 15.23.2; o candidato 15.24.0 ainda não foi implantado.

A fonte vigente dos módulos originais publicados não está integralmente sincronizada em `apps/`. O build histórico aprovado não deve substituir esses módulos, pois isso poderia perder alterações legítimas. A autorização de publicação já foi recebida; o bloqueio restante é técnico, de sincronização e homologação. As verificações atuais não permitem declarar todo o sistema corrigido ou pronto para uso real.

## Segurança

### Correções do candidato

| ID | Severidade no contexto | Causa raiz | Correção e evidência |
| --- | --- | --- | --- |
| F01 | Média | Cookies renovados descartados; sessão e acesso consultados em paralelo | Renovação sequencial e propagação interna/ao navegador; regressão de sessão passou |
| F02 | Média | Corpo limitado em bytes, sem prazo | Prazo de 10 s, cancelamento e liberação do reader; testes de timeout, aborto, falha, UTF-8 e tamanho |
| F03 | Média | Mutações novas sem quota própria persistente | SQLite/D1 por empresa, usuário e ação, chave SHA-256, atualização atômica e 429/Retry-After |
| F04 | Baixa | Produto nulo gerava 503 e campos textuais aceitavam objetos | Validação antes da gravação, erro 400 e regressões para estruturas inválidas |
| F05 | Baixa | `application/json-seq` era aceito como JSON | Media type exato, objeto JSON e UTF-8 estrito; regressão passou |
| F06 | Baixa | Assinaturas incompletas de imagem eram aceitas | JPEG ampliado, assinatura PNG completa/IHDR/tamanho mínimo e versão PDF; regressões passaram. Não é antivírus |
| F07 | Alta, disponibilidade | Menu sem `<li>` podia clonar continuamente a raiz observada e congelar a aba | Inserção sem clonar a raiz; falha reproduzida e regressão para menus planos e listas |
| F08 | Baixa | Respostas novas não herdavam todos os headers | CSP para JSON, bloqueio de enquadramento, referência restrita e cache privado; regressões passaram |
| F09 | Baixa no uso observado | esbuild no intervalo de aviso do servidor de desenvolvimento Windows | Atualização para 0.28.2; scanner da raiz sem alertas |

F01–F08 ainda não estão ativos em produção. As quotas do candidato são 60 mutações, 10 uploads e 15 alterações administrativas por minuto. Antes de ativá-lo, criar aditivamente `sales_order_rate_limits` nos D1 correspondentes, conforme `features/pedidos/rate-limit.mjs` e `storage.mjs`.

Os testes exercitaram isolamento entre empresas, IDs, origens, HMAC/timestamp, permissões comerciais/financeiras, revisão otimista, concorrência, idempotência, criptografia e anexos. Não foi demonstrada exploração SQL/NoSQL Injection, XSS, CSRF ou escalonamento em produção. A aprovação não prova ausência dessas classes no sistema inteiro.

### Dependências: antes e depois

| Escopo | Antes | Depois |
| --- | --- | --- |
| Ferramentas da raiz | Alerta de esbuild corrigido na primeira rodada | 0 alertas |
| Lockfile System | 34 pacotes sinalizados: 3 críticos, 14 altos, 16 moderados, 1 baixo | 0 alertas |
| Lockfile Control | Mesma distribuição, com grande sobreposição | 0 alertas |

Os números representam pacotes afetados, inclusive por dependências transitivas. Não são 68 vulnerabilidades independentes. Os JSON completos do npm audit estão nos artefatos do [CI aprovado](https://github.com/isaquesoaresfontela83-bit/Fama-System/actions/runs/42479099956).

Atualizações principais: Next 16.4.5, React/React DOM/RSC 19.2.9, DOMPurify 3.4.17, Vite 8.3.6, Cloudflare Vite Plugin 1.67.0, Wrangler 4.156.1 e Zod 4.6.7. Overrides explícitos corrigem dependências transitivas de imagem, SVG, ZIP, glob e esbuild. Vinext permanece 0.0.50; seus componentes transitivos afetados foram atualizados. Os dois builds e todas as suítes passaram com os lockfiles atualizados e instalação limpa no GitHub.

**Risco residual de produção:** atualizar esses lockfiles e compilar `apps/` não altera os módulos originais publicados. DOMPurify 3.4.16 foi identificado em um módulo SSR publicado do System; os índices contêm React 19.2.6. O rastreamento completo das dependências/rotas alcançáveis e a atualização compatível da produção permanecem pendentes. Não foi feita substituição isolada de bundles sem validação nem declarada correção desse componente publicado.

Referências primárias dos avisos iniciais: [DOMPurify](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), [Next](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [RSC](https://github.com/advisories/GHSA-wx67-qw84-cm4g). O intervalo de versões sinalizado não demonstra sozinho exploração no Worker.

### Banco: alterações aplicadas

As seis funções JSON invocadoras e imutáveis dos schemas System/Control tiveram `search_path = ''` fixado na migração `audit_pin_pure_json_helpers_search_path`. Os seis testes SELECT passaram antes e depois; os seis avisos desapareceram. Corpos, assinaturas, donos e privilégios foram preservados. SQL/reversão: [applied-json-search-path.sql](../../deployment/security/applied-json-search-path.sql).

Após autorização explícita em 08/11, o RLS foi habilitado em `fama_control_runtime.fama_platform_integrations` e `fama_control_runtime.fama_provider_activity`, sem FORCE. Ambas tinham zero registros. O [snapshot](../../deployment/security/control-private-tables-backup-2026-11-08.json) registra estrutura, defaults, constraints, índices, donos, ACLs e contagens. A [restauração](../../deployment/security/control-private-tables-restore-empty.sql) foi executada em PGlite isolado: comparação de estrutura, CRUD do proprietário, negação a quatro outros papéis e rollback do RLS. O teste considera a diferença de representação de NOT NULL entre PostgreSQL 17 e 18.

A migração real recusa executar se dono, ACL, RLS ou condição de tabela vazia mudarem e limita lock/execução. No mesmo fluxo confirmou que o backend proprietário continua fora do filtro RLS e que as duas leituras funcionam. A consulta posterior confirmou RLS ativo, FORCE desativado, donos/ACLs intactos, zero registros e nenhum SELECT a anon/authenticated. SQL/reversão: [applied-private-control-rls.sql](../../deployment/security/applied-private-control-rls.sql). O backup cobre somente as duas tabelas vazias; não é backup verificado de todo o projeto.

O proprietário `fama_control_backend` continua aplicando a autorização do aplicativo. A ausência de política nas tabelas privadas nega acesso aos demais papéis sem concessões DML. RLS é defesa adicional e não substitui os filtros de empresa.

O consultor do Supabase agora apresenta 69 observações informativas de RLS habilitado sem política e um aviso de proteção nativa contra senhas vazadas desativada; os seis avisos de search_path foram eliminados. O aplicativo possui verificação própria, mas caminhos alternativos diretos do Auth não foram homologados. Esse aviso nativo não foi declarado resolvido. [database-evidence.json](database-evidence.json) registra os resultados.

Não foram alterados registros de negócio, chaves, planos, DNS, bindings ou serviços externos. As migrações registram metadados próprios no histórico do Supabase. Não houve sobrecarga, ataque destrutivo ou teste invasivo em terceiros.

## Qualidade

### Resultado final, sem somar repetições

| Suíte | Aprovados | Reprovados | Ignorados |
| --- | ---: | ---: | ---: |
| System: fonte histórica e build gerado | 1.032 | 0 | 0 |
| Control: fonte histórica, banco isolado e build gerado | 614 | 0 | 0 |
| Pedidos e Liquid Glass | 58 | 0 | 0 |
| Playwright: desktop, tablet e celular | 9 | 0 | 0 |
| **Total** | **1.713** | **0** | **0** |

System/Control incluem os dois testes WASM executados depois das demais fixtures e da verificação dos assets. A cobertura repete 44 testes de Pedidos e não é somada novamente. Os mesmos 1.032 e 614 casos passaram localmente e no GitHub com instalação limpa. Os nove Playwright passaram em 7,9 s no CI. [ci-evidence.json](ci-evidence.json) e [validation-2026-11-08.json](validation-2026-11-08.json) registram contagens; os logs completos estão na execução do GitHub.

As 27 falhas do CI anterior e as 38 da instalação local parcial foram resolvidas na validação da fonte histórica. O CI agora compila antes de testar. Os testes antigos acompanham o catálogo personalizável, a identificação atual da IA e o fluxo atual da agenda, conservando a segurança. O teste semanal usa relógio fixo; o teste de versão compara a release real; a CSP é comparada com o Worker; o teste de provedor usa a API atual do Miniflare e intercepta toda saída de rede. Nenhum teste foi removido ou ignorado para obter aprovação. [legacy-failures.json](legacy-failures.json) conserva a lista anterior como evidência histórica.

### Cobertura real

| Escopo medido | Linhas | Ramificações | Funções |
| --- | ---: | ---: | ---: |
| Backend de Pedidos, sete arquivos, 44 testes | **99,45%** | **93,31%** | **96,58%** |
| API de Pedidos isoladamente | 98,98% | 91,83% | 93,10% |

O CI exige 90% das três métricas nesse escopo. A cobertura global de frontend, autenticação histórica, banco real e provedores não foi medida. Os 1.713 testes não significam 90% de cobertura global. [coverage.txt](coverage.txt) registra o resultado. Sintaxe: 694 arquivos de implementação aprovados. Tipos: controles novos de corpo/sessão/quota e suas dependências. A varredura de padrões de segredos terminou sem achados; não cobre todo o histórico Git.

### Matriz funcional e limites

| Área | Evidência obtida | Limite ou pendência |
| --- | --- | --- |
| Pedidos, parcelas, cancelamento, agenda e anexos | CRUD, persistência, validação, permissões, criptografia, idempotência e concorrência em fixtures | Fluxo autenticado publicado ainda não homologado |
| Rotas privadas e autenticação | Rejeição anônima/origem cruzada nos builds; sessões, MFA, recuperação e permissões nas suítes | Sem login/MFA real de produção |
| CRM, contratos, garantias, estoque e financeiro | Suítes históricas, PDFs reais gerados e isolamento por empresa em fixtures | Não comprova cada botão/integração da interface publicada |
| Câmera e código de barras | Casos de leitor nativo e WASM passaram | Sem teste físico de câmera, scanner ou aparelho |
| Barra inferior e Liquid Glass | Preferências, recursos permitidos, toque, gesto cancelado, movimento reduzido e congelamento | Sem medição física de FPS ou todos os gestos/navegadores |
| Interface Pedidos/dock | Nove Playwright: busca, vazio, formulário, criação, persistência, troca de empresa, atalhos e Escape | Fixture isolada em Chromium; acessibilidade parcial |
| Supabase | Funções, catálogo, permissões, contagens e RLS no projeto real | Sem restauração do banco inteiro ou Auth/Storage completos |
| Cloudflare | Versões ativas e inventário de módulos conferidos; configuração preservada | Candidato não implantado; homologação autenticada conjunta pendente |
| Pagamentos, WhatsApp, e-mail, Google e fiscal | Fluxos/falhas/destinos/redirects simulados; teste de provedor no runtime Workers | Sem mensagem, cobrança, e-mail ou documento fiscal real |

Playwright usa 1280×900, 820×1180 e 390×844 com toque. A conferência visual anterior da fixture verificou persistência e ausência de transbordamento do documento em celular/tablet; [mobile-qa.jpg](mobile-qa.jpg). Não houve leitura manual de 100% dos arquivos nem conferência de todos os botões. [inventory.json](inventory.json) registra 148 entradas de rotas e referências estáticas a testes, que não equivalem a aprovação individual de funcionalidades.

## Desempenho

| Cenário reproduzido em teste isolado | Antes | Depois |
| --- | ---: | ---: |
| Consultas de parcelas para pedido com entrada e 36 parcelas | 37 | 1 |
| Redução de consultas | — | 97,3% |
| Menu sem `<li>` | Clonagem contínua e congelamento | Inserção única, regressão aprovada |

A consulta em lote mantém o predicado de empresa e os IDs autorizados. O número não foi extrapolado para latência de produção. Não há comparativo válido de Core Web Vitals, memória, FPS, consultas reais ou desempenho entre navegadores. A identidade visual foi preservada.

## GitHub, arquitetura e publicação

Branch: `audit/security-quality-2026-11-07`. PR: https://github.com/isaquesoaresfontela83-bit/Fama-System/pull/13. A `main` é histórica. [GITHUB-STATUS.md](GITHUB-STATUS.md) registra os commits e os seis jobs aprovados em `473a62403be7d589b33fdd660e1914a0d1abfd5d`. [FILES.md](FILES.md) relaciona os arquivos modificados.

| Aplicação | Worker | Versão ativa preservada | Módulos |
| --- | --- | --- | ---: |
| System | `fama-system-app` | `b9d6df1c-94e2-4a8a-892f-ccd5b75aa2bd` | 127 |
| Control | `fama-control-app` | `5cff2387-f835-46c6-9a7b-26d1fa36b5d5` | 60 |

A produção continua em 15.23.2 / `2026-11-07-mobile-tap-01`. A cadeia é Liquid Glass → Pedidos → `index.js` original. [baseline-15.24.0.json](../../features/liquid-glass/baseline-15.24.0.json) registra os 187 módulos e hashes. O candidato troca sete módulos conhecidos por aplicação e preserva os 120 originais do System e 53 do Control. Os sete módulos foram compilados/verificados; os dois builds históricos também passaram, mas não foram publicados sobre a base vigente.

O workflow verifica sintaxe, lint, tipos do escopo, segredos, paridade, dependências, testes, cobertura, E2E e builds. `release-gate` exige todos os jobs aprovados, em Ubuntu 24.04/Node 24. Não há job de implantação nem proteção contra publicações manuais externas. Artefatos duram 14 dias.

Nenhum Worker foi publicado nesta auditoria. A API autenticada da Cloudflare confirmou as versões acima. A tentativa de repetir os GETs públicos de saúde nesta rodada recebeu bloqueio 403 do acesso de saída deste ambiente; isso não foi registrado como falha da aplicação. Os HTTP 200 anteriores e as fixtures não substituem uma nova conferência autenticada dos dois domínios.

### Pendências para publicação verificável

1. Sincronizar a fonte original vigente e rastrear/corrigir as dependências efetivamente publicadas. Os lockfiles corrigidos estão disponíveis; recompilar a árvore histórica sobre produção segue proibido.
2. Validar os dois aplicativos em homologação isolada com sessões/papéis, recursos estáticos e integrações controladas. Os testes atuais não cobrem todas as funções da versão publicada.
3. Criar a tabela aditiva de quotas nos D1, reconferir hashes/versões e atualizar os sete módulos da extensão em conjunto, preservando bindings, assets, dados, público e domínios. `deployGlass` sozinho atualiza quatro módulos e não publica todo o candidato.
4. Rever a proteção nativa contra senhas vazadas e os caminhos alternativos do Auth. Verificar backup integral/recuperação para os demais dados antes de mudanças que os coloquem em risco.

### Rollback

Antes de ativar uma futura versão, reconfirmar a versão atual e conservar os manifestos. Em falha conjunta, devolver 100% do tráfego aos IDs System/Control acima e conferir páginas, assets e saúde dos dois domínios. Se houver publicação posterior legítima, atualizar a referência de rollback. A tabela aditiva de quotas pode permanecer; não remover dados para reverter código.

A reversão RLS é somente DISABLE ROW LEVEL SECURITY nas duas tabelas; a das seis funções usa RESET search_path, conforme os SQL. O rollback RLS foi ensaiado no banco isolado. Não houve rollback nem restauração integral em produção. Os dados existentes foram preservados; a auditoria integral permanece aberta nas pendências explícitas deste relatório.
