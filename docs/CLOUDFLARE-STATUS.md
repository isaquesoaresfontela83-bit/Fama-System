# Cloudflare — barra personalizável 15.23.1 — 06/11/2026

Versão conjunta `15.23.1`, lançamento `2026-11-06-all-module-shortcuts-01`, publicada nos dois Workers existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `01aa1076-cab8-44d2-9284-717bf21456cd` | `03480bd7-6bd4-444d-a2d6-4c488d77d5b4` |
| Control | https://control.famasystem.online/ | `6e738e28-0630-40bd-8a8c-11f18f5b7823` | `e4d7deb7-3d55-487c-9716-f25beea4ee62` |

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
