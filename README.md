# Fama System e Fama Control — hospedagem híbrida

Versão conjunta 15.7.0 (`2026-10-21-hybrid-01`). Fontes atuais completas em `apps/system` e `apps/control`, recuperadas dos repositórios Sites em 21/10/2026.

Interfaces estáticas, APIs Docker/Node.js na Render gratuita e persistência no projeto Supabase existente. Consulte `deployment/hybrid/README.md` de cada aplicação para compilação, migração e limitações.

A transferência dos bancos privados e das chaves originais aguarda autorização explícita. Os domínios principais continuam na instalação existente. Esta branch e a criação de serviços não comprovam conclusão da migração.

Não adicionar segredos ao código. Não iniciar com base vazia nem substituir os dados existentes. Validar os dois destinos antes de trocar DNS.
