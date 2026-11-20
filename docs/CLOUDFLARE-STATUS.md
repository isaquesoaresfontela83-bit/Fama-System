# Water System e Water Control 15.23.21 — 19/11/2026

Lançamento conjunto `2026-11-19-water-opening-domain-01`. Confira os dois aplicativos em [Water System](https://watersystem.online/) e [Water Control](https://control.watersystem.online/).

| Aplicação | Versão ativa do Worker | Implantação | Módulos | Bindings |
| --- | --- | --- | --- | --- |
| Water System | `b185fc67-1dfe-45bc-b7bb-0c6eb27104c7` | `32682a87-ae9d-4b10-a039-f89bc980af21` | 144 | 41 |
| Water Control | `c9475019-f9cc-414a-aa69-55b4b7b47b88` | `5f69deae-ebbe-4296-85d5-d7401a8381aa` | 77 | 29 |

Os hashes dos módulos publicados conferem com os pacotes preparados. Os 62 testes, a verificação conjunta e a verificação de sintaxe passaram. O navegador confirmou o monograma centralizado na abertura de 320 px. As páginas públicas, as rotas de autenticação e os endpoints de saúde responderam no novo domínio.

O Supabase passou a usar o novo endereço padrão e os três destinos para confirmação de cadastro e recuperação de senha. A migração `20261120003744_water_backup_origin.sql` atualizou o destino do backup. O backup de teste foi completo, válido e criptografado, e o agendamento confirmou execuções bem-sucedidas. As rotas, domínios personalizados e regras de redirecionamento dos três endereços antigos foram removidos e conferidos na Cloudflare.

---

# Apresentação e preços 15.23.8 — 19/11/2026 — publicado e verificado

Lançamento conjunto `2026-11-19-premium-public-themes-01`, publicado pela conexão autenticada da Cloudflare nos Workers existentes. A apresentação premium está em `https://famasystem.online/` e `https://famasystem.online/planos`, com temas claro/escuro e preferência persistente.

| Aplicação | Versão Worker ativa | Implantação | Módulos | Bindings |
| --- | --- | --- | --- | --- |
| System | `dd4a6e14-7703-41b5-8e84-4edccd317100` | `1869f832-b415-4552-b729-ec7b751cee9e` | 144 | 41 |
| Control | `bf7c1ba8-bce0-4b06-b917-c088fa9c9eb0` | `f36fd360-65c9-4d85-b559-27a554675482` | 77 | 29 |

Os 140/73 módulos anteriores foram preservados integralmente. Leitura posterior confirmou os hashes de todos os módulos e os bindings herdados, incluindo ASSETS e conexões existentes. A extensão usa somente quatro módulos adicionais por aplicação; o Control mantém suas rotas e recebe o identificador conjunto. Preços, limites e recursos são consultados pelo handler público vigente do System, conectado ao Control. Sessões, consentimento e contratação continuam sendo tratados pelo aplicativo original.

59 testes, sintaxe e verificação conjunta passaram. HTTP confirmou 11 páginas/recursos com resposta 200, os dois endpoints de saúde em 15.23.8 e os quatro arquivos públicos idênticos aos preparados. A apresentação foi conferida no navegador nos dois temas, incluindo persistência ao recarregar, demonstração interativa e preços/links anuais. A tela privada de acesso do Control também foi carregada. Operações autenticadas e pagamento não foram reexecutados. A prévia óptica anterior permanece preservada.

Detalhes e hashes em [deployment.json](../features/pricing/premium/deployment.json); fonte e procedimento em [apresentação comercial](../features/pricing/premium/README.md).

# SEO 15.23.4 — publicado e verificado

Lançamento conjunto `2026-11-15-seo-discovery-01` publicado em 15/11/2026, confirmado em 16/11/2026 nos dois domínios.

| Aplicação | Versão Worker | Implantação |
| --- | --- | --- |
| System | `9c9b68e3-0a55-40ba-93a9-5d6fdf45e0a0` | `327ca49f-093f-47e0-b610-d5e94f1cf875` |
| Control | `362bd6e7-dec0-40a5-8eb5-6c7263931093` | `b18c3a2b-072e-4785-b402-0fa380d507a1` |

Preservados integralmente 131/64 módulos originais e 41/29 bindings; leitura de volta confirmou 133/66 módulos. 41 testes, sintaxe e verificação conjunta aprovados. Os dois endpoints de saúde retornam 15.23.4. As quatro páginas públicas responderam HTTP 200 com canonical e JSON-LD; sitemap e llms.txt responderam HTTP 200. Control mantém noindex e robots restritivo. Fluxos autenticados não foram reexecutados nesta atualização.

Em 16/11/2026, após autorização explícita do proprietário, a conta isaquesoaresfontela83@gmail.com foi verificada como proprietária do domínio no Google Search Console via registro TXT adicionado ao DNS Cloudflare, sem alterar outros registros. O sitemap `https://famasystem.online/sitemap`.xml foi enviado e a interface confirmou **Processado**, com **4 páginas encontradas**. Isso confirma descoberta do sitemap, não a indexação de todas as páginas nem posicionamento nas buscas. Não remover o TXT de verificação.

# Contas e aprovação de colaborador — 15.23.3 — 09/11/2026

Lançamento conjunto `2026-11-09-account-access-01` publicado nos dois Workers existentes.

| Aplicação | Versão Worker ativa | Implantação |
| --- | --- | --- |
| System | `29da1dc5-156d-4a12-bd9b-f5f1d0ce5231` | `ba5b6d66-2712-460e-84ba-d293c9b7a04a` |
| Control | `c9338df9-528a-48c0-aecb-0bc9eeeb33f0` | `4143585a-516d-42d0-b92e-d8faf0987746` |

A versão ativa 15.23.2 foi recuperada diretamente da Cloudflare com 127 módulos System e 60 Control. Antes da publicação, os hashes originais e as versões ativas foram conferidos; 41 bindings System e 29 Control foram herdados. Leitura de volta confirmou 131 e 64 módulos, incluindo os novos módulos de acesso. Os endpoints de saúde dos dois domínios responderam 15.23.3 / `2026-11-09-account-access-01` via Browser Rendering. O formulário público de segunda conta foi carregado no domínio System. O teste de login com duas credenciais e a página do Control autenticada dependem da sessão do proprietário.

A solicitação para `grupofamaofc@gmail.com` está na tabela `control_collaborator_requests` do D1 Control com estado `pending` e `user_id` vazio. O convite e a permissão só serão emitidos após aprovação na página `/colaboradores-control`. Quatro testes locais passaram, além da checagem de sintaxe e do verificador de versão conjunta.

# Resposta ao toque — 15.23.2 — 07/11/2026

Lançamento conjunto `2026-11-07-mobile-tap-01` publicado nos dois Workers.

| Aplicação | Versão Worker | Implantação |
| --- | --- | --- |
| System | b9d6df1c-94e2-4a8a-892f-ccd5b75aa2bd | d7bdc26d-46db-4f98-8d1f-6c1a980ca77c |
| Control | 5cff2387-f835-46c6-9a7b-26d1fa36b5d5 | 868d43c8-14b3-4b17-ac33-739f913dc3fe |

Toques em botões e links agora têm pressão e retorno suave de 320 ms, inclusive na barra inferior. Listeners passivos não interceptam cliques nem rolagem; movimento acima de 10 px e cancelamento interrompem o efeito. Movimento reduzido e controles desabilitados não animam. CSS oferece indicação de pressão sem JavaScript.

30 testes passaram, sintaxe e verificador conjunto passaram. Os dois pacotes foram validados antes da ativação; 123 módulos System, 56 Control e todos os bindings foram preservados. Leitura de volta confirmou os quatro módulos da extensão. As páginas públicas dos dois domínios abriram em navegador e incluem CSS/cliente 15.23.2. Não houve teste em aparelho móvel físico nem sessão autenticada.

`features/liquid-glass/build-input.mjs` monta os recursos e incorpora `touch-feedback.mjs` no cliente. Base anterior em `baseline-15.23.2.json`.

---

# Cloudflare — barra personalizável 15.23.1 — 06/11/2026

Versão conjunta `15.23.1`, lançamento `2026-11-06-all-module-shortcuts-01`, publicada nos dois Workers existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | `https://famasystem.online/entrar` | `01aa1076-cab8-44d2-9284-717bf21456cd` | `03480bd7-6bd4-444d-a2d6-4c488d77d5b4` |
| Control | `https://control.famasystem.online/` | `6e738e28-0630-40bd-8a8c-11f18f5b7823` | `e4d7deb7-3d55-487c-9716-f25beea4ee62` |

## Comportamento

O botão **Editar** da barra inferior abre um diálogo para mostrar/ocultar os atalhos existentes, reordenar com setas, salvar, cancelar ou restaurar o padrão. Mais permanece obrigatório. A preferência é local ao navegador e compartilhada entre contas utilizadas nesse navegador; não é sincronizada com a conta. O editor lista o catálogo completo de áreas autorizadas, não apenas os cinco botões iniciais. Inclui busca, Pedidos, Financeiro, Estoque, Orçamentos, Serviços, CRM, Contratos, Garantias, Equipe, Gráficos, Gestão, ferramentas e áreas de conta/ajuda. A lista é filtrada por `/api/access`; Pedidos também exige validação da política própria. Nenhuma permissão ou módulo é liberado pela preferência.

Os botões originais são reutilizados. Os atalhos adicionais invocam o handler do menu original; quando necessário, abrem o menu móvel e o grupo recolhido antes de selecionar a função. Não há rotas inventadas ou acesso direto a dados pelo atalho. A ordem visual acompanha a ordem de teclado. A personalização reaplica após atualizações da interface e troca de permissões. O diálogo usa `showModal`, rótulos, foco visível e restaura o foco ao fechar. Se o armazenamento falhar, a escolha pode ser aplicada apenas na sessão com aviso explícito. Layout inválido ou corrompido retorna ao padrão.

Liquid Glass e as animações anteriores da barra foram preservados. As preferências por movimento reduzido, maior contraste e menor transparência continuam contempladas.

## Preservação

Os 123 módulos originais System e 56 Control foram preservados e seus hashes conferidos após a publicação. A extensão contém quatro módulos Worker, incluindo os recursos do cliente. Os 41 bindings System e 29 Control foram herdados, mantendo ASSETS, bancos, credenciais, compatibilidade e observabilidade.

## Validação

- 27 testes passaram, incluindo normalização, reordenação, persistência JSON, proteção do Mais, recursos GET/HEAD e o módulo Pedidos. Sintaxe e verificador conjunto passaram.
- QA de DOM com LinkeDOM: catálogo completo, adicionar Financeiro/Estoque/Pedidos, navegação original do Financeiro, abertura de grupo recolhido para Estoque, busca, persistência, remoção de atalhos sem permissão e restauração do padrão.
- Leitura de volta confirmou os módulos originais e os recursos novos nos dois Workers. Ambos os endpoints de saúde retornam 15.23.1; as páginas públicas carregam o CSS e o cliente novos.
- Não houve login real. A interação visual do personalizador dentro de uma conta autenticada não foi conferida em navegador real. O QA de DOM não substitui essa conferência.
- SHA-256 do CSS preparado: `811404f3825c95d95c2b430604ffdacc3758037b8f48053dad839b91a406196c`.

Consulte [operação](OPERACAO.md), [extensão visual](../features/liquid-glass/README.md) e [documentação](README.md).
