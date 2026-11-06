# Cloudflare — barra personalizável 15.23.0 — 06/11/2026

Versão conjunta `15.23.0`, lançamento `2026-11-06-customizable-dock-01`, publicada nos dois Workers existentes.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `d62b22f1-524c-4ef4-8a14-02057a22be60` | `569bad24-bbee-42f6-9117-fffcfea9b6a9` |
| Control | https://control.famasystem.online/ | `3abf8869-4354-4ff1-b100-15b8036befc4` | `d10f42ef-890c-4461-afeb-219e54eb324b` |

## Comportamento

O botão **Editar** da barra inferior abre um diálogo para mostrar/ocultar os atalhos existentes, reordenar com setas, salvar, cancelar ou restaurar o padrão. Mais permanece obrigatório. A preferência é local ao navegador e compartilhada entre contas utilizadas nesse navegador; não é sincronizada com a conta. Apenas botões já autorizados e renderizados pela aplicação são personalizados. Nenhuma rota, permissão ou módulo é liberado pela preferência.

Os próprios nós dos botões são reutilizados, preservando os listeners nativos e a ordem de teclado. A personalização reaplica após atualizações da interface e troca de permissões. O diálogo usa `showModal`, rótulos, foco visível e restaura o foco ao fechar. Se o armazenamento falhar, a escolha pode ser aplicada apenas na sessão com aviso explícito. Layout inválido ou corrompido retorna ao padrão.

Liquid Glass e as animações anteriores da barra foram preservados. As preferências por movimento reduzido, maior contraste e menor transparência continuam contempladas.

## Preservação

Os 123 módulos originais System e 56 Control foram preservados e seus hashes conferidos após a publicação. A extensão contém quatro módulos Worker, incluindo os recursos do cliente. Os 41 bindings System e 29 Control foram herdados, mantendo ASSETS, bancos, credenciais, compatibilidade e observabilidade.

## Validação

- 25 testes passaram, incluindo normalização, reordenação, persistência JSON, proteção do Mais, recursos GET/HEAD e o módulo Pedidos. Sintaxe e verificador conjunto passaram.
- QA de DOM com LinkeDOM: abrir configurações, reordenar, ocultar, salvar, recarregar, restaurar, cancelar, listeners nativos, ausência de atalhos sem permissão e apenas um botão Editar.
- Leitura de volta confirmou os módulos originais e os recursos novos nos dois Workers. Ambos os endpoints de saúde retornam 15.23.0; as páginas públicas carregam o CSS e o cliente novos.
- Não houve login real. A interação visual do personalizador dentro de uma conta autenticada não foi conferida em navegador real. O QA de DOM não substitui essa conferência.
- SHA-256 do CSS preparado: `d8d3e199b89201e6a7e256049f56402256c2761f4fe0a46fe5a9daef0d0b496b`.

Consulte [operação](OPERACAO.md), [extensão visual](../features/liquid-glass/README.md) e [documentação](README.md).
