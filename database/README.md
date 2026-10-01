# Banco compartilhado

O diretório `supabase/` centraliza a captura da estrutura compartilhada do Fama System e Fama Control: tabelas, funções, triggers, políticas, índices, storage e agendamentos.

Comece por [BANCO.md](../docs/BANCO.md). Os snapshots de criação atendem instalações Supabase novas; as migrações históricas continuam em `apps/fama-system/supabase/` e `apps/fama-control/supabase/`.

As migrações D1 continuam em `apps/<aplicação>/drizzle/`, onde os scripts de build originais precisam encontrá-las. Cada aplicação preserva seu schema, lockfile e migrações; não execute indiscriminadamente todos os SQLs de ambos os projetos no mesmo banco.
