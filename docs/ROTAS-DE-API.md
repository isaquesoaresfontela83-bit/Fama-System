# Rotas de API

As implementações completas ficam nos arquivos indicados.

## fama-system

| Rota | Métodos | Arquivo |
| --- | --- | --- |
| `/api/access` | GET | `app/api/access/route.ts` |
| `/api/account/export` | GET | `app/api/account/export/route.ts` |
| `/api/admin/billing` | GET, POST | `app/api/admin/billing/route.ts` |
| `/api/admin/checkouts` | GET, PATCH | `app/api/admin/checkouts/route.ts` |
| `/api/admin/launch` | POST | `app/api/admin/launch/route.ts` |
| `/api/admin/members/[id]` | PATCH | `app/api/admin/members/[id]/route.ts` |
| `/api/admin/members` | GET | `app/api/admin/members/route.ts` |
| `/api/admin/organization-settings/[id]` | GET, POST | `app/api/admin/organization-settings/[id]/route.ts` |
| `/api/admin/organizations/[id]` | PATCH, DELETE | `app/api/admin/organizations/[id]/route.ts` |
| `/api/admin/organizations` | GET | `app/api/admin/organizations/route.ts` |
| `/api/admin/security/re-encrypt` | POST | `app/api/admin/security/re-encrypt/route.ts` |
| `/api/admin/support` | GET, PATCH | `app/api/admin/support/route.ts` |
| `/api/asaas` | GET, POST | `app/api/asaas/route.ts` |
| `/api/attachments/[id]` | DELETE | `app/api/attachments/[id]/route.ts` |
| `/api/attachments` | GET, POST | `app/api/attachments/route.ts` |
| `/api/auth/login` | POST | `app/api/auth/login/route.ts` |
| `/api/auth/logout` | GET | `app/api/auth/logout/route.ts` |
| `/api/auth/mfa-login` | POST | `app/api/auth/mfa-login/route.ts` |
| `/api/auth/mfa` | GET, POST | `app/api/auth/mfa/route.ts` |
| `/api/auth/password` | POST | `app/api/auth/password/route.ts` |
| `/api/auth/recover` | POST | `app/api/auth/recover/route.ts` |
| `/api/auth/session` | POST | `app/api/auth/session/route.ts` |
| `/api/auth/signup` | POST | `app/api/auth/signup/route.ts` |
| `/api/billing/asaas-webhook` | POST | `app/api/billing/asaas-webhook/route.ts` |
| `/api/billing` | GET, POST | `app/api/billing/route.ts` |
| `/api/bootstrap` | GET | `app/api/bootstrap/route.ts` |
| `/api/company-settings` | GET, POST | `app/api/company-settings/route.ts` |
| `/api/fama-ai` | GET, POST | `app/api/fama-ai/route.ts` |
| `/api/finance-connections` | GET, POST | `app/api/finance-connections/route.ts` |
| `/api/finance` | GET, POST, PATCH | `app/api/finance/route.ts` |
| `/api/legal/consent` | POST | `app/api/legal/consent/route.ts` |
| `/api/members/[id]` | PATCH, DELETE | `app/api/members/[id]/route.ts` |
| `/api/members` | GET, POST | `app/api/members/route.ts` |
| `/api/organizations` | GET, POST | `app/api/organizations/route.ts` |
| `/api/privacy/public` | POST | `app/api/privacy/public/route.ts` |
| `/api/privacy` | GET, POST | `app/api/privacy/route.ts` |
| `/api/public/checkout` | POST, GET, PATCH | `app/api/public/checkout/route.ts` |
| `/api/public/quotes/[id]/approval` | GET, POST | `app/api/public/quotes/[id]/approval/route.ts` |
| `/api/quote-config` | GET, POST | `app/api/quote-config/route.ts` |
| `/api/quotes/[id]/approval-link` | POST | `app/api/quotes/[id]/approval-link/route.ts` |
| `/api/quotes/[id]/convert` | POST | `app/api/quotes/[id]/convert/route.ts` |
| `/api/records/[id]` | PATCH, DELETE | `app/api/records/[id]/route.ts` |
| `/api/records` | POST | `app/api/records/route.ts` |
| `/api/recovery/[id]` | POST | `app/api/recovery/[id]/route.ts` |
| `/api/recovery` | GET | `app/api/recovery/route.ts` |
| `/api/support` | GET, POST | `app/api/support/route.ts` |
| `/api/warranties/[id]/schedule` | POST | `app/api/warranties/[id]/schedule/route.ts` |
| `/api/whatsapp` | GET, POST | `app/api/whatsapp/route.ts` |

## fama-control

| Rota | Métodos | Arquivo |
| --- | --- | --- |
| `/api/admin/audit` | GET | `app/api/admin/audit/route.ts` |
| `/api/admin/backup` | GET | `app/api/admin/backup/route.ts` |
| `/api/admin/members/[id]` | PATCH | `app/api/admin/members/[id]/route.ts` |
| `/api/admin/members` | GET | `app/api/admin/members/route.ts` |
| `/api/admin/organizations/[id]/members` | GET, POST | `app/api/admin/organizations/[id]/members/route.ts` |
| `/api/admin/organizations/[id]` | PATCH, DELETE | `app/api/admin/organizations/[id]/route.ts` |
| `/api/admin/organizations` | GET, POST | `app/api/admin/organizations/route.ts` |
| `/api/admin/plans` | GET, PATCH | `app/api/admin/plans/route.ts` |
| `/api/admin/privacy` | GET, PATCH | `app/api/admin/privacy/route.ts` |
| `/api/admin/quote-config` | GET, PATCH | `app/api/admin/quote-config/route.ts` |
| `/api/admin/security/re-encrypt` | POST | `app/api/admin/security/re-encrypt/route.ts` |
| `/api/admin/security` | GET | `app/api/admin/security/route.ts` |
| `/api/admin/support` | GET, PATCH | `app/api/admin/support/route.ts` |
| `/api/admin/validation` | GET, POST | `app/api/admin/validation/route.ts` |
| `/api/attachments/[id]` | DELETE | `app/api/attachments/[id]/route.ts` |
| `/api/attachments` | GET, POST | `app/api/attachments/route.ts` |
| `/api/auth/login` | POST | `app/api/auth/login/route.ts` |
| `/api/auth/logout` | GET | `app/api/auth/logout/route.ts` |
| `/api/auth/mfa-login` | POST | `app/api/auth/mfa-login/route.ts` |
| `/api/auth/setup` | POST | `app/api/auth/setup/route.ts` |
| `/api/bootstrap` | GET | `app/api/bootstrap/route.ts` |
| `/api/internal/data` | POST | `app/api/internal/data/route.ts` |
| `/api/members/[id]` | PATCH, DELETE | `app/api/members/[id]/route.ts` |
| `/api/members` | GET, POST | `app/api/members/route.ts` |
| `/api/organizations` | GET, POST | `app/api/organizations/route.ts` |
| `/api/public/plans` | GET | `app/api/public/plans/route.ts` |
| `/api/public/support` | POST | `app/api/public/support/route.ts` |
| `/api/records/[id]` | PATCH, DELETE | `app/api/records/[id]/route.ts` |
| `/api/records` | POST | `app/api/records/route.ts` |
| `/api/warranties/[id]/schedule` | POST | `app/api/warranties/[id]/schedule/route.ts` |
