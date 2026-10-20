# Preferência permanente do proprietário

Fama System e Fama Control devem ser atualizados juntos. Esta regra foi solicitada explicitamente em 20/10/2026 e vale para os próximos trabalhos nos dois projetos.

- Ao alterar qualquer um, recuperar a fonte atual dos dois e verificar o impacto no outro: funcionalidades, administração, permissões, planos, integrações e contratos de API.
- Implementar o controle administrativo correspondente às funções do System. IPinfo Lite e GitHub REST ficam no Fama Control; chamadas e credenciais dos provedores ficam no backend.
- Usar a mesma versão e o mesmo identificador de lançamento em `lib/fama-release.js` nos dois. Executar `node scripts/verify-companion.mjs <caminho-do-outro-projeto>` antes de publicar.
- Validar os dois pacotes antes da primeira publicação; publicar o conjunto na instalação independente da Cloudflare e conferir os dois domínios. Preservar dados, planos, credenciais e público atual.
- Só informar atualização conjunta concluída após confirmação das duas publicações. Se uma falhar, corrigir ou restaurar a versão compatível e informar a pendência com clareza.
- Manter estas instruções versionadas nos dois projetos e no repositório compartilhado. Não substituir produção pelo ramo principal antigo sem sincronizar a fonte publicada.
