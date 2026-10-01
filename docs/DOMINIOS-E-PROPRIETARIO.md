# Domínios e identidade na transferência

Os caminhos nas tabelas são relativos à aplicação correspondente em `apps/fama-system/` ou `apps/fama-control/`.
O código foi preservado exatamente como publicado. Estes endereços precisam de conferência ao mudar de instalação.

## fama-system

| Arquivo | Linha | Endereço |
| --- | --- | --- |
| `README.md` | 100 | `https://famasystem.online/api/billing/asaas-webhook` |
| `app/api/support/route.ts` | 7 | `https://control.famasystem.online/api/public/support` |
| `lib/launch-readiness.ts` | 11 | `https://famasystem.online/api/billing/asaas-webhook` |
| `lib/plans.ts` | 43 | `https://control.famasystem.online/api/public/plans` |
| `lib/supabase.ts` | 71 | `https://control.famasystem.online/api/internal/data` |

## fama-control

| Arquivo | Linha | Endereço |
| --- | --- | --- |
| `README.md` | 89 | `https://famasystem.online/entrar` |
| `app/company-accounts-dialog.tsx` | 109 | `https://famasystem.online/entrar` |
| `app/page.tsx` | 22 | `https://fama-system.isaquesoaresfontela8.chatgpt.site` |
| `lib/access-validation.ts` | 12 | `https://fama-system.isaquesoaresfontela8.chatgpt.site` |

## Proprietário e autorização

Configure `PLATFORM_OWNER_EMAIL` e `PLATFORM_OWNER_USER_ID` com o usuário Supabase correto. A implementação atual também possui uma lista explícita de proprietário em `lib/tenant.ts`; revise essa lista nos dois projetos ao entregar a outra pessoa. O identificador Supabase do usuário muda quando uma nova conta é criada.

O Fama System tem endereços fixos para o serviço privado do Control em `lib/supabase.ts`, `app/api/support/route.ts` e outros pontos listados acima. O diagnóstico do Control aponta para o domínio nativo do System em `lib/access-validation.ts`. Ajuste todos os endereços aplicáveis antes de testar a cópia, para que nenhuma chamada da nova instalação dependa da antiga.

Os testes contêm referências aos domínios antigos para verificar a implementação atual; revise suas expectativas se mudar esses endereços. Cada `.openai/hosting.json` conserva o ID do projeto original. Reutilize esses IDs apenas para atualizar os próprios projetos atuais; uma instalação independente deve receber IDs novos fornecidos pelo provedor.
