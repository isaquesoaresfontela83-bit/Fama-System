# Recuperar o backup completo

Em **Fama Control → Segurança**, guarde a chave de recuperação em um local privado separado do backup. A cópia diária inclui tabelas do Supabase, arquivos reais e os bancos locais dos dois sistemas. A cópia externa no Cloudflare R2 é criptografada e mantida por 30 dias. O download **Baixar cópia externa** lê essa cópia, sem depender da tabela de backups no banco principal.

Para conferir o arquivo baixado sem alterar produção:

```sh
node scripts/restore-backup.mjs --backup fama-backup.json --key-file fama-chave-recuperacao.json --verify-only
```

Para recuperar em uma pasta vazia, use Node 22.13 ou posterior:

```sh
node scripts/restore-backup.mjs --backup fama-backup.json --key-file fama-chave-recuperacao.json --out recuperacao
```

O programa autentica todas as partes criptografadas e restaura os arquivos originais, os dois bancos SQLite e os registros PostgreSQL. Ele gera `restore-missing-postgres.sql`: execute em um banco com o esquema e as migrações do projeto já aplicados. A restauração adiciona somente registros ausentes e preserva registros existentes. Relações não resolvidas cancelam a operação inteira. Reenvie os arquivos da pasta `files` aos respectivos buckets privados pela API oficial de Storage, sem substituir arquivos existentes. A restauração do banco principal não move dinheiro, não liquida pagamentos e não emite notas fiscais.

Se o Supabase estiver totalmente indisponível, recupere o conjunto de partes e o manifesto no bucket privado de R2 da hospedagem; os nomes são `fama-backups/<identificador>/`. O acesso ao painel pode depender da autenticação do Supabase. O arquivo exportado e a chave separados permitem recuperar sem acessar o banco original. Nunca publique a chave nem os arquivos recuperados.
