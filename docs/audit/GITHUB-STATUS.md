# GitHub — validação de 08/11/2026

Branch: `audit/security-quality-2026-11-07`, baseada em `release/15.23.2-mobile-tap` (`bf185fd30ff47b174d483ae99662cb110554338d`).

PR: https://github.com/isaquesoaresfontela83-bit/Fama-System/pull/13. A publicação da aplicação continua pendente pelos motivos descritos em REPORT.md.

## Execução aprovada

GitHub Actions: https://github.com/isaquesoaresfontela83-bit/Fama-System/actions/runs/42479099956

Commit de código: `473a62403be7d589b33fdd660e1914a0d1abfd5d`. Execução concluída com **success** em 08/11/2026 às 12:14:39 UTC. Os logs de cada job foram consultados diretamente.

| Job | ID | Resultado |
| --- | --- | --- |
| quality | 128726937493 | success |
| dependencies | 128726937842 | success: zero alertas nos três lockfiles |
| historical-tests (system) | 128726937796 | success: build e 1.032 testes |
| historical-tests (control) | 128726937694 | success: build e 614 testes |
| interface | 128726937731 | success: 9 testes em 7,9 s |
| release-gate | 128727542142 | success |

A suíte das extensões passou com 58 testes. A execução de cobertura repete 44 deles e não é somada novamente. Total: **1.713 aprovados, zero reprovados e zero ignorados**.

As suítes históricas agora geram e verificam os próprios bundles antes de testá-los. Depois das fixtures Vite, a validação repete a compressão/verificação de assets e executa os dois testes WASM. Não foram excluídos testes para obter aprovação. As expectativas antigas foram alinhadas ao comportamento implementado, conservando autorização e isolamento.

O CI usa Ubuntu 24.04, Node 24 e instalação limpa pelos lockfiles. Artefatos duram 14 dias. O workflow não implanta Workers nem impede publicações manuais externas. A aprovação valida este código; não comprova sincronização com todos os módulos originais publicados nem testes autenticados de produção.

## Commits enviados

| Commit | Conteúdo |
| --- | --- |
| `6bf2a228b0e75784d962d2e8689bb74dca28307f` | Pedidos: sessões, validação, quotas, uploads, navegação e consultas em lote |
| `b7d41a31e34644ab98a68d54667e5e1b5ac4bfb1` | Ferramentas, cobertura, CI e Playwright |
| `cdc5cded1873a8bee145eeeee0d45b78ac398494` | Inventário, evidências e limites iniciais |
| `df3df9be42d92b1eca8e497ddf75eff50223786a` | Runner compatível e concorrência do CI |
| `1d3f380de957adc3a366e6df075420a70b60cff6` | Evidência inicial de banco e CI |
| `ed6b091ed147c7d50bfef76b7bb522c8f8112009` | RLS autorizado, backup de duas tabelas vazias e teste de restauração |
| `473a62403be7d589b33fdd660e1914a0d1abfd5d` | Dependências corrigidas, builds completos e regressões históricas aprovadas |

Os commits de documentação posteriores preservam o SHA acima como referência exata da execução aprovada. [ci-evidence.json](ci-evidence.json) registra o resultado; [validation-2026-11-08.json](validation-2026-11-08.json) inclui contagens e hashes dos logs locais. [FILES.md](FILES.md) relaciona os arquivos da auditoria.
