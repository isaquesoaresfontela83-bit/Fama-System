# Pedidos de piscinas — venda e entrega

Módulo semiautomático 15.21.0, compartilhado pelo Fama System e pelo Fama Control. O pedido nasce como “A confirmar”. A confirmação da venda gera parcelas pendentes; pagamentos e recebimento da piscina exigem confirmação humana. Agendamento e reagendamento mantêm uma única entrega vinculada à Agenda. Não há envio automático pelo WhatsApp: o botão abre uma mensagem para revisão e envio pelo usuário.

## Integração com a produção existente

A fonte original da produção 15.20.0 de 26/10 não está integralmente sincronizada no GitHub. Por isso esta entrega é **aditiva**: os 120 módulos Worker do System e os 53 do Control são preservados byte a byte. `production-baseline.json` registra seus nomes, tamanhos e SHA-256, além das versões anteriores para recuperação. Não recompilar nem implantar as árvores antigas de `apps/` sobre essa produção.

`entry.mjs` envolve o aplicativo publicado, preserva seus handlers e cabeçalhos, inclui os recursos do módulo nas respostas HTML e encaminha as rotas novas. `client.mjs` acrescenta Pedidos ao menu existente e monta o módulo no espaço de trabalho, preservando a aplicação e sua navegação. O pacote mantém três módulos adicionais por Worker: `pedidos-main.mjs`, `pedidos-core.mjs` e `pedidos-resources.mjs`. A entrada importa o `index.js` original; os demais imports originais continuam intactos.

## Dados e autorização

- A sessão, MFA, empresa ou filial, perfil, plano e permissões são conferidos nos endpoints atuais da aplicação. Orçamentos é o direito de entrada; Financeiro (completo ou básico, para os lançamentos manuais) e Agenda continuam exigidos para suas respectivas ações. Filiais herdam a regra da matriz antes de aplicar uma eventual regra própria.
- Os pedidos e anexos ficam no D1 operacional do System, com payload criptografado por AES-GCM e a chave existente. Toda consulta e gravação inclui a empresa verificada. Os dados financeiros e agendamentos usam o backend operacional já configurado, inclusive Supabase quando ativo, com a criptografia atual.
- As tabelas novas são definidas em `storage.mjs` (`SCHEMA`); aplicar somente esses `CREATE TABLE/INDEX IF NOT EXISTS` antes da ativação. Não há exclusão ou substituição de tabelas existentes.
- Números sequenciais por empresa, request IDs e referência única do orçamento impedem duplicidade. Parcelas e entrega têm UUIDs determinísticos. Revisão e trava temporária protegem gravações simultâneas. Uma confirmação parcialmente interrompida pode ser repetida sem duplicar parcelas; valores ficam bloqueados para edição quando já existem parcelas vinculadas.
- Cancelamento exige motivo e nenhum pagamento recebido; remove somente os vínculos pendentes do próprio pedido e mantém o registro e seu histórico. Se uma parcela mudar concorrentemente no financeiro, a ação é interrompida. Parcelas faltantes podem ser sincronizadas na ficha do pedido.
- O Control salva regras gerais, por plano e por empresa. A chamada ao System usa o service binding existente e HMAC com timestamp. As regras não concedem acesso a módulos negados nas permissões existentes. Regras de usuário também são aceitas pela API mediante validação de vínculo.
- Anexos: até dez JPG, PNG ou PDF por pedido, 1 MiB cada, com validação do conteúdo, criptografia e download autenticado.

## Verificação e compilação

```sh
node --test features/pedidos/pedidos.test.mjs
node apps/system/scripts/verify-companion.mjs apps/control
node features/pedidos/build.mjs
```

O build usa o esbuild instalado no System, disponível no PATH ou indicado por `FAMA_ESBUILD_BIN`. Não usa nem reconstrói a base antiga. `dist/` é gerado e ignorado pelo Git. A visualização local de QA usa `node features/pedidos/preview.mjs --port 4173`; contém apenas dados fictícios em memória e nenhum serviço real.

Antes de ativar, recuperar os módulos diretamente dos Workers existentes, validar todos os hashes do manifesto e anexar os três módulos novos. Herdar todos os bindings e reter a coleção ASSETS, compatibilidade, observabilidade e domínios. Rejeitar a publicação se a produção mudou desde a captura; atualizar a base antes de continuar. Validar os dois pacotes antes da primeira ativação e conferir os dois domínios após a ativação conjunta.

O novo `/api/health` informa 15.21.0 e o mesmo release ID nos dois sistemas, preservando o resultado da saúde original e expondo `baselineVersion` para rastreabilidade. Um HTTP 200 isolado não substitui a conferência dos módulos e das páginas.
