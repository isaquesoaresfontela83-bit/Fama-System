# Banco de dados completo

O snapshot contém 49 tabelas de aplicação nos schemas `public` e `private`, 31 funções, 77 triggers, índices, constraints, permissões, RLS, dois buckets e quatro tarefas agendadas. Os schemas internos `auth` e `storage` são criados pelo Supabase; o pacote preserva as referências a eles e as políticas de armazenamento da aplicação.

Em um projeto Supabase novo, siga `../../docs/BANCO.md`. Para atualizar uma instalação existente, use suas migrações aplicáveis, sem reaplicar o snapshot de criação.

`estrutura-atual.json` contém os metadados completos capturados. As migrações históricas permanecem dentro de cada projeto em `apps/`, nos diretórios `supabase/` e `drizzle/`. Elas foram mantidas sem edição.

Os arquivos SQL exportam a estrutura e a lógica do sistema. Registros de produção, contas de login, anexos e segredos não estão incluídos. As tarefas em `03-agendamentos.sql` começam desativadas na nova instalação; o JSON registra a configuração ativa da origem.
