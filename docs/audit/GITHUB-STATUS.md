# GitHub — auditoria de 07/11/2026

Branch: `audit/security-quality-2026-11-07`. [PR #13, em rascunho](https://github.com/isaquesoaresfontela83-bit/Fama-System/pull/13).

| Commit remoto | Mudança |
| --- | --- |
| `6bf2a228b0e75784d962d2e8689bb74dca28307f` | Correções de Pedidos, regressões e candidato conjunto |
| `b7d41a31e34644ab98a68d54667e5e1b5ac4bfb1` | CI, ferramentas, homologação e Playwright |
| `cdc5cded1873a8bee145eeeee0d45b78ac398494` | Relatório e evidências iniciais |
| `df3df9be42d92b1eca8e497ddf75eff50223786a` | Runner Ubuntu 24.04 compatível e controle de concorrência |

O histórico inclui o fechamento documental posterior, sem alteração adicional do código executável.

## Pipeline observado

[Execução 42438259815](https://github.com/isaquesoaresfontela83-bit/Fama-System/actions/runs/42438259815), commit de código `df3df9be42d92b1eca8e497ddf75eff50223786a`: **concluída com falha; publicação não liberada**.

| Job | Resultado real |
| --- | --- |
| quality | Aprovado: instalação, sintaxe, lint, tipos dos controles, padrões de credenciais, paridade, testes, cobertura e build |
| interface | Aprovado: 9 testes Playwright, desktop/tablet/mobile, 8,1 s de execução |
| dependencies | Reprovado: alertas altos/críticos nos lockfiles históricos |
| historical-tests (system) | Reprovado: 927 itens, 911 aprovados, 16 reprovados |
| historical-tests (control) | Reprovado: 541 itens, 530 aprovados, 11 reprovados |
| release-gate | Reprovado |

Os testes históricos foram instalados no CI a partir dos lockfiles. A rodada local de apoio contou 38 falhas; a rodada do CI contou 27. Resultados de ambientes diferentes são mantidos separados. Não houve remoção ou marcação de testes como ignorados para obter aprovação.

O código das extensões passou em 58 testes locais, além dos 9 E2E no CI. Cobertura do backend de Pedidos: 99,45% de linhas / 93,31% de ramificações / 96,58% de funções. [ci-evidence.json](ci-evidence.json) registra os dados observados.

## Publicação e banco

Nenhum Worker foi atualizado. Os dois domínios responderam 200 e versão 15.23.2 após o ajuste restrito do banco. Não há implantação automática no workflow.

Somente o search_path de seis funções JSON foi fixado no banco, em alternativa restrita aprovada. As verificações SELECT passaram novamente e os seis avisos correspondentes desapareceram. [database-evidence.json](database-evidence.json). RLS, tabelas, permissões e registros operacionais foram preservados. A proposta de RLS permanece pendente de autorização e backup verificado.

A fonte vigente completa, alertas de dependências e testes históricos ainda precisam de tratamento. Não considerar o PR pronto para merge/publicação em produção.
