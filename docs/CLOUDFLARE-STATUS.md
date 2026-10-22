# Cloudflare sem Render — 22/10/2026

Fama System e Fama Control **15.8.0**, lançamento `2026-10-22-customers-agenda-01`, ativados nos dois domínios. As aplicações completas executam na Cloudflare. Os pacotes publicados não contêm referências a `onrender.com`.

| Aplicação | Endereço | Versão Worker ativa | Implantação |
| --- | --- | --- | --- |
| System | https://famasystem.online/entrar | `69e17112-ef9a-4189-807b-6c9900c56d85` | `4083d6b9-1c2b-4e8c-9748-6551c8c5bb98` |
| Control | https://control.famasystem.online/ | `cc8783fb-212d-430d-a6a9-bdab63b17a46` | `a547b1f2-8199-429d-9c4e-737980b910df` |

## Dados, agenda e interface

Nenhuma base operacional foi apagada ou recriada. Supabase, autenticação, D1 originais, chaves e namespace persistente Baileys foram preservados. Os D1 operacionais de System/Control continuam separados da base de arquivos públicos.

O agendador Supabase `fama-daily-agenda` está ativo. O endpoint no Vault foi verificado por igualdade, sem expor token: `https://famasystem.online/api/internal/daily-agenda`. Não aponta ao Render. As três execuções verificadas de 13h35, 13h40 e 13h45 (Brasília) concluíram com sucesso; isso confirma o cron, não envio real ao WhatsApp. Nenhum envio a pessoa foi feito nesta verificação.

Foram corrigidos 43 arquivos JS/CSS ausentes da publicação anterior, incluindo módulos de tema e dependências compartilhadas que impediam o carregamento das telas. Os bytes foram recuperados do mesmo build, sem redesenhar o frontend. As telas de entrada de System/Control foram inspecionadas no navegador com a identidade original.

## Verificações

- Ambos os `/api/health` retornaram 15.8.0 e o mesmo release ID após a ativação.
- 39 testes System e 9 Control passaram, incluindo autenticação, edição, início de serviço, clientes, agenda concorrente e ponte interna WhatsApp. Os testes usam dados fictícios.
- Verificação conjunta de versão, permissões, integrações e recursos passou.
- Fluxos internos com a conta real/MFA do proprietário não foram executados. O conector Fama devolveu exigência de autenticação, sem alterar a conta.

## Serviços Render remanescentes

Os sete serviços Render antigos continuam cadastrados, com auto-deploy desligado, e não recebem tráfego da Fama. Não foram suspensos ou excluídos: o conector não oferece essa ação e o painel aberto exige login. Retirar o Render do tráfego não deve ser descrito como exclusão desses serviços. A configuração histórica foi arquivada; o destino vigente é Cloudflare.
