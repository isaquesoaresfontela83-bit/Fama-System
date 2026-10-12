# Manutenção do repositório

## Fontes e arquivos gerados

`build/sites-vite-plugin.ts` é importado por `vite.config.ts` e faz parte do código-fonte. O CSS em `vendor/` também é usado pela aplicação; preserve seu aviso de licença.

`dist/`, `.next/`, `.vinext/`, `out/`, `.wrangler/` e `.sites-runtime/` são saídas ou estados locais. Elas pertencem ao ambiente de trabalho e estão no `.gitignore`.

O `package-lock.json` deve acompanhar mudanças de dependências. As migrações em `drizzle/` e os metadados correspondentes devem continuar versionados.

## Módulos e integrações

- `app/api/`: rotas da base Fama System.
- `lib/tenant.ts`: autorização por empresa e perfil.
- `lib/fama-session.ts`: assinatura e leitura da sessão.
- `db/` e `drizzle/`: banco operacional D1.
- `supabase/functions/control-auth/` e `supabase/functions/fama-control/`: funções relacionadas ao Control, com ambiente próprio.
- `sites-release/`: materiais históricos, preservados para consulta.

O frontend completo e a versão publicada do Control precisam ser identificados separadamente; não trate esta pasta de funções como um aplicativo completo.

## Situação das propostas anteriores

A proposta de monorepo e expansão funcional do PR #2 tem escopo amplo. A mudança de configuração de login do PR #3 depende de variáveis no ambiente. Ambas exigem avaliação própria; a organização documental não valida nem publica essas funcionalidades.

A URL e a chave publicável do Supabase continuam definidas no endpoint de login desta `main`. Documentar variáveis futuras não configura automaticamente o ambiente nem altera esse endpoint.

## Antes de remover ou mover arquivos

Verifique imports, referências CSS, scripts, testes e configuração de hospedagem. Uma pasta chamada `build` ou `vendor` não é evidência suficiente de que seja descartável. Revise o diff e execute os testes que correspondam à mudança.

Os comandos de desenvolvimento e as orientações de segurança estão no [README](../README.md) e em [CONTRIBUTING](../CONTRIBUTING.md).
