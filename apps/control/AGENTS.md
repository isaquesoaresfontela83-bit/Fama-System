# Preferência permanente do proprietário

Fama System e Fama Control devem ser atualizados juntos. Esta regra foi solicitada explicitamente em 20/10/2026 e vale para os próximos trabalhos nos dois projetos.

- Ao alterar qualquer um, recuperar a fonte atual dos dois e verificar o impacto no outro: funcionalidades, administração, permissões, planos, integrações e contratos de API.
- Implementar o controle administrativo correspondente às funções do System. IPinfo Lite e GitHub REST ficam no Fama Control; chamadas e credenciais dos provedores ficam no backend.
- Usar a mesma versão e o mesmo identificador de lançamento em `lib/fama-release.js` nos dois. Executar `node scripts/verify-companion.mjs <caminho-do-outro-projeto>` antes de publicar.
- Validar os dois pacotes antes da primeira publicação; publicar o conjunto no destino híbrido aprovado e conferir os dois domínios. Preservar dados, planos, credenciais e público atual.
- Só informar atualização conjunta concluída após confirmação das duas publicações. Se uma falhar, corrigir ou restaurar a versão compatível e informar a pendência com clareza.
- Manter estas instruções versionadas nos dois projetos e no repositório compartilhado. Não substituir produção pelo ramo principal antigo sem sincronizar a fonte publicada.

## Destino VPS autorizado em 21/10/2026

O proprietário escolheu uma VPS gratuita para System e Control. Preparar e testar os dois no mesmo lançamento; a troca de domínio e a importação de dados dependem do backup atual e do servidor provisionado. Nunca substituir o banco atual por uma base vazia. A opção Cloudflare existente é mantida somente para compatibilidade da fonte anterior.

## Hospedagem híbrida autorizada em 21/10/2026

O proprietário escolheu telas estáticas, backend Render gratuito e persistência no Supabase. Não trocar os domínios antes da importação e validação dos dois sistemas. Não usar SQLite nem sessões Baileys no disco efêmero da Render. Manter os segredos apenas no backend.

## Publicação 15.8.0 em 22/10/2026

As duas confirmações de publicação e a autorização específica da transferência temporária de bancos/segredos foram recebidas. A migração foi concluída e os dois domínios confirmaram 15.8.0 com o mesmo lançamento. Não pedir novamente essas autorizações. Nunca usar AppDeploy, inclusive para prévias. Preservar o frontend original. O destino atual é estático Render + APIs Render + Supabase; Cloudflare faz somente o encaminhamento dos domínios e mantém o Baileys persistente. Consultar docs/HYBRID-STATUS.md na raiz. Não reimplantar a aplicação completa nos Workers antigos nem publicar o main desatualizado.
