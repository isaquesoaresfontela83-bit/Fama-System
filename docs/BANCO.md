# Instalação do banco e lógica PostgreSQL

## Conteúdo do snapshot

A captura de 01/10/2026 contém os schemas de aplicação `public` e `private`: tabelas, colunas, defaults, chaves, constraints, índices, funções, triggers, grants e políticas RLS. Os schemas `auth`, `storage`, `vault`, `extensions` e `cron` são serviços/extensões do Supabase e não são recriados integralmente pela aplicação.

O JSON `database/supabase/estrutura-atual.json` preserva os metadados capturados, inclusive extensões, grants padrão, eventos DDL e configuração dos agendamentos. Os arquivos SQL foram gerados a partir dessa captura; são um snapshot de criação, não uma migração incremental nem um dump dos registros de produção.

## Instalação nova

1. Crie um projeto Supabase novo e prepare Auth com login por e-mail/senha, SMTP e URLs de recuperação/retorno apropriadas.
2. No SQL Editor do novo projeto, execute `database/supabase/01-estrutura-completa-supabase.sql`. Ele cria as tabelas antes das chaves estrangeiras, funções, triggers, índices, políticas e grants. Habilita as extensões necessárias de criptografia e Vault.
3. Execute `database/supabase/02-storage.sql` para criar os buckets e suas políticas.
4. Crie no Vault um segredo forte chamado `fama_recovery_key`. As funções de auditoria/recuperação que usam o Vault dependem desse nome. Configure-o com o responsável pelo novo ambiente, sem registrar seu valor no repositório.
5. Crie o primeiro usuário administrativo no Supabase Auth. Cadastre seu UUID e e-mail em `public.fama_control_admins` e configure as variáveis de proprietário dos dois servidores.
6. Cadastre os planos e a configuração de catálogo na interface administrativa. Os valores configurados na produção antiga não são exportados como dados de software.
7. Confira as funções de backup e as referências históricas indicadas em `CONFERENCIA.md` antes de ativar as tarefas periódicas.

Exemplo para autorizar o novo administrador, após substituir os dois valores:

```sql
insert into public.fama_control_admins (user_id, email, enabled)
values ('UUID-DO-USUARIO-NO-SUPABASE', 'administrador@seu-dominio.com', true)
on conflict (user_id) do update
set email = excluded.email, enabled = true, updated_at = now();
```

Os UUIDs de usuário são os da instalação nova. O código do Control preserva uma lista explícita de proprietário em `lib/tenant.ts`; revise-a ao transferir a outra pessoa.

## Tarefas e eventos opcionais

`03-agendamentos.sql` recria quatro tarefas do `pg_cron`: backup, lembretes de follow-up, rotina financeira recorrente e atualização de atrasos de visitas. Elas começam desativadas na cópia. Os horários foram preservados literalmente; confira o fuso do pg_cron. Ative apenas as tarefas que estiverem configuradas e validadas na nova instalação.

Depois de validar uma tarefa, a ativação pode ser feita pelo administrador SQL:

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = 'NOME-DA-TAREFA'),
  active := true
);
```

`04-eventos-ddl.sql` preserva o evento que habilita RLS em tabelas novas. A criação de eventos DDL pode exigir privilégios administrados pelo Supabase; as tabelas já exportadas possuem suas próprias definições RLS no arquivo principal.

`05-privilegios-padrao-referencia.sql` documenta os privilégios padrão da origem. Ele não é necessário para criar as tabelas e funções exportadas, que recebem grants explícitos. Alguns papéis citados são gerenciados pelo Supabase; não aplique esse arquivo indiscriminadamente em outro ambiente.

## Instalação existente

Não reaplique `01-estrutura-completa-supabase.sql` em um banco com as tabelas criadas. Use as migrações originais pertinentes e confira a diferença para o snapshot atual. O pacote preserva todos os SQLs de `apps/fama-system/supabase/` e `apps/fama-control/supabase/`, além das migrações SQLite em `drizzle/`.

As migrações antigas dos dois projetos possuem sobreposição. O snapshot atual reúne a estrutura compartilhada; aplicar todos os `schema.sql` antigos em sequência não substitui uma análise de migração e pode alterar defaults ou políticas de uma instalação existente.

## Dados e criptografia

Os registros de empresas, usuários, logs, backups, catálogos editados e anexos não foram extraídos. Para uma mudança com dados, use um backup controlado do banco, da autenticação e do Storage. Preserve as relações entre UUIDs dos usuários e organizações.

`FAMA_DATA_ENCRYPTION_KEY` protege dados sensíveis da aplicação com AES-GCM; `fama_recovery_key`, no Vault, atende funções de auditoria/recuperação do banco. São configurações distintas. Dados criptografados da instalação antiga exigem os segredos originais correspondentes; gerar uma chave nova não permite decifrar dados antigos.

Documentação oficial: [Database backups](https://supabase.com/docs/guides/platform/backups), [Auth](https://supabase.com/docs/guides/auth), [Storage](https://supabase.com/docs/guides/storage) e [Vault](https://supabase.com/docs/guides/database/vault).

## Migração da assistente

O snapshot foi capturado antes da assistente. Após restaurá-lo, aplique uma única vez `database/supabase/migrations/20261001210000_fama_ai_settings.sql` no Supabase compartilhado. Essa migração adiciona a tabela global de preferências e a função transacional de atualização e auditoria. Os dois aplicativos usam a mesma configuração. Consulte [ASSISTENTE.md](ASSISTENTE.md).
