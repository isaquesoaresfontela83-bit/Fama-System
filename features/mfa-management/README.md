# Gestão da verificação em duas etapas

A opção **Desativar** aparece quando há um autenticador ativo na área Privacidade e segurança do Water System e na seção de verificação em duas etapas do Water Control. A operação vale para a conta Supabase autenticada; se os dois produtos usarem a mesma conta, o resultado vale para ambos.

A interface consulta os fatores existentes no endpoint da própria aplicação, pede um código TOTP e chama as ações `challenge` e `verify` antes de enviar `unenroll` para os fatores verificados. O endpoint existente exige autenticação, origem confiável, limite de requisições e a sessão AAL2 exigida pelo Supabase. A interface não altera as regras do servidor. A confirmação adicional por código é feita pelo fluxo da interface; não é uma nova exigência imposta ao endpoint legado. Caso existam métodos que não sejam TOTP, a tela orienta a procurar suporte sem alterar os fatores. Falhas parciais são comunicadas e o estado real deve ser conferido antes de outra tentativa.

Os arquivos são servidos pela extensão de marca atual, sem modificar os módulos originais dos Workers:

| Recurso no prefixo de marca | Fonte | Tipo |
| --- | --- | --- |
| `mfa-management-15.23.28.mjs` | `client.mjs` | `application/javascript` |
| `mfa-flow-15.23.28.mjs` | `flow.mjs` | `application/javascript` |
| `mfa-management-15.23.28.css` | `style.css` | `text/css; charset=utf-8` |

Preserve esses três recursos nos dois Workers quando republicar. Execute `npm test`, as verificações de sintaxe e o verificador conjunto. Os testes simulam os endpoints; não removem fatores reais de nenhuma conta.
