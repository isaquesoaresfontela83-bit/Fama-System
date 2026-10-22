# Estado da implantação híbrida — 22/10/2026

Fonte preparada: **15.8.0 / 2026-10-22-customers-agenda-01**, branch `release/15.8.0-prepared`. Consulte [RELEASE-15.8.0.md](RELEASE-15.8.0.md) para funcionalidades e validação. System e Control mantêm o frontend original e precisam ser publicados juntos. AppDeploy está proibido, inclusive para prévias.

## Destinos existentes

Workspace Render confirmado: Fama system (`tea-dbcgqg3rjlhs73be8ojg`). Repositório verificado e com permissão de escrita: `isaquesoaresfontela83-bit/Fama-System`. Auto-deploy desativado nos quatro serviços.

| Aplicação | Serviço | Endereço |
| --- | --- | --- |
| System API | srv-dbchh71kjs5s73ef2ggg | https://fama-system-api.onrender.com |
| Control API | srv-dbchhduktt5c73cukph0 | https://fama-control-api.onrender.com |
| System estático | srv-dbcl9r6i0phs73f77jhg | https://fama-system-web.onrender.com |
| Control estático | srv-dbcl9t2vcj2c73f1mdj0 | https://fama-control-web.onrender.com |

Os estáticos existentes publicaram a fonte 15.7.2 (`0da6e94a9c063ae66bedadfa9063f15fbd3f3a66`). As APIs continuam sem iniciar: último deploy informado `update_failed`, fonte `85b8b290e1380f934141c8a1c04b22e599e6befc`, com `FAMA_POSTGRES_URL` ausente. Não criar outros serviços de teste nem publicar `main`, que contém fonte antiga.

Os domínios principais permanecem nos Workers independentes `fama-system-app` e `fama-control-app` da conta Cloudflare `0b7f140d49afd304babf88f180bab819`. Nenhuma troca de domínio foi realizada nesta preparação.

Projeto Supabase existente: `mupnsdqahoybhmkpufmx`, região sa-east-1. Os esquemas `fama_system_runtime` e `fama_control_runtime` e seus marcadores já existem. Sua existência não comprova que os dados atuais dos dois Workers foram copiados ou que as chaves de produção foram preservadas. Nunca sobrescrever esses esquemas com importação vazia.

## Bloqueio específico da transferência

O proprietário autorizou em 21/10 copiar os bancos auxiliares para o Supabase e configurar as chaves originais no Render. Em 22/10 confirmou duas vezes a publicação conjunta (“Autorizo” e “Sim autorizo”). A revisão automática, ainda assim, rejeitou a transferência criptografada de produção para a pasta local temporária, por considerar ausente autorização específica para esse trânsito sensível.

Não contornar essa rejeição por outro endpoint, mecanismo de cópia ou execução indireta. Nenhum banco ou segredo original foi recebido na tentativa rejeitada. As três variáveis temporárias `FAMA_MIGRATION_*` foram removidas dos dois Workers, com sucesso confirmado pelo conector. O receptor temporário continha somente a chave RSA criada para a tentativa, sem dados de produção.

As autorizações gerais de publicação estão satisfeitas. A única confirmação adicional necessária decorre da revisão automática e diz respeito a receber os bancos e as chaves originais em ambiente temporário privado de migração, para transferi-los aos destinos aprovados e apagar as cópias ao concluir. Nunca solicitar que o usuário cole segredos no chat.

## Continuação após resolver o bloqueio

1. Obter cópias atuais dos D1 associados aos Workers reais e suas configurações originais por transferência autenticada e criptografada. Não presumir que as antigas cópias Sites equivalem aos domínios reais.
2. Comparar os registros atuais com os esquemas privados existentes no Supabase. O importador recusa sobrescrever tabelas; reconciliar diferenças sem apagar dados. Criar conexão de menor privilégio com TLS verificado, preservando a chave de criptografia original.
3. Aplicar a migração aditiva `apps/system/deployment/hybrid/customer-agenda.sql`, já testada localmente, ao banco operacional existente. Ainda não aplicada nesta preparação. Não executar o schema completo em produção.
4. Configurar os dois backends Render com os segredos originais, a conexão PostgreSQL e as URLs internas. Não usar SQLite ou sessões Baileys no disco efêmero. O serviço Baileys persistente existente permanece separado.
5. Atualizar os quatro serviços para a mesma fonte validada. Conferir proxy na mesma origem, cookies, login/MFA/recuperação, permissões, empresas, dados criptografados e módulos administrativos. As branches atualmente configuradas são `deploy/hybrid-15.7.0` (APIs) e `release/15.7.2` (estáticos); qualquer avanço deve ser fast-forward, sem force push.
6. Somente após a validação conjunta, trocar e conferir os dois domínios. Habilitar o cron da agenda apenas com os segredos no Vault e endpoint real validado. O SQL não ativa preferências das empresas; o envio depende de escolha explícita de seu administrador e Baileys conectado.
7. Remover qualquer configuração temporária de transferência e apagar as cópias locais sensíveis. Só informar publicação concluída depois de os dois sistemas confirmarem a versão nova nos destinos reais.
