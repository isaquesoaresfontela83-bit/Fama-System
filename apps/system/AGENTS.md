# Preferência permanente do proprietário

Em 30/10/2026 o proprietário autorizou o envio das alterações solicitadas ao GitHub existente e a publicação conjunta do Fama System e Fama Control sem nova confirmação conversacional: “Apartar de agora você vai subir pro git hub sem precisar pedir, pode publicar”. Registrar e respeitar essa preferência nos próximos trabalhos; preservar dados, segredos, planos e público e validar antes da publicação.

Atualização de 30/10/2026: Pedidos 15.21.0 é um módulo aditivo em `../../features/pedidos/`, sobre a produção 15.20.0 recuperada diretamente da Cloudflare. Leia seu README e manifesto antes de publicar. Não implante esta árvore antiga como substituição da produção. Versão conjunta nova: `2026-10-30-pedidos-vendas-entregas-01`.

Fama System e Fama Control devem ser atualizados juntos. Esta regra foi solicitada explicitamente em 20/10/2026 e vale para os próximos trabalhos nos dois projetos.

- Ao alterar qualquer um, recuperar a fonte atual dos dois e verificar o impacto no outro: funcionalidades, administração, permissões, planos, integrações e contratos de API.
- Implementar o controle administrativo correspondente às funções do System. IPinfo Lite e GitHub REST ficam no Fama Control; chamadas e credenciais dos provedores ficam no backend.
- Usar a mesma versão e o mesmo identificador de lançamento em `lib/fama-release.js` nos dois. Executar `node scripts/verify-companion.mjs <caminho-do-outro-projeto>` antes de publicar.
- Validar os dois pacotes antes da primeira publicação; publicar o conjunto no destino Cloudflare aprovado e conferir os dois domínios. Preservar dados, planos, credenciais e público atual.
- Só informar atualização conjunta concluída após confirmação das duas publicações. Se uma falhar, corrigir ou restaurar a versão compatível e informar a pendência com clareza.
- Manter estas instruções versionadas nos dois projetos e no repositório compartilhado. Não substituir produção pelo ramo principal antigo sem sincronizar a fonte publicada.

## Destino vigente em 22/10/2026 — Cloudflare sem Render

O proprietário pediu a retirada do Render por causa da suspensão por inatividade. A publicação vigente executa a aplicação completa nos Workers Cloudflare existentes; Supabase, D1, Baileys persistente e frontend original foram preservados. As instruções históricas de VPS/Render foram substituídas por esta decisão.

Versão 15.10.0 / `2026-10-22-module-charts-01` nos dois sistemas. Não restaurar a versão 15.4, encaminhamento para onrender.com, nem publicar o main antigo. Nunca usar AppDeploy. As duas confirmações de publicação e a autorização específica de transferência temporária privada dos bancos/segredos já foram recebidas; não pedir novamente.

Consultar `../../docs/CLOUDFLARE-STATUS.md` e `../../deployment/cloudflare/README.md`. Publicar todos os módulos da interface, incluindo dependências compartilhadas e imports dinâmicos. Conferir os dois domínios visualmente antes de declarar conclusão. Os serviços Render antigos ainda não foram suspensos ou excluídos; o painel exige autenticação para essa ação.
