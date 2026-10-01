# Manual de uso do Fama System

Este manual orienta a rotina comercial, operacional e financeira da empresa. A tela **Manual de uso** dentro do site contém figuras de navegação e também pode ser aberta pela tela de entrada.

## 1. Entrar e preparar a empresa

1. Abra o endereço oficial do Fama System e entre com seu e-mail e senha. Se ainda não tem uma conta, escolha **Criar conta**, informe seu nome e crie uma senha com pelo menos oito caracteres.
2. Aceite os Termos de Uso e a Política de Privacidade. Se receber um e-mail de confirmação, confirme antes de voltar ao login.
3. No primeiro acesso, crie o perfil da empresa. Se tiver acesso a mais de uma, use o seletor da barra superior para escolher qual quer operar.
4. Convide a equipe em **Usuários e empresas**. Use o e-mail que cada pessoa usará para entrar e peça ao proprietário para limitar os módulos necessários no Fama Control.
5. Em **Privacidade e segurança**, ative a verificação em duas etapas quando disponível e guarde o acesso ao autenticador em local seguro.

## 2. Entender a tela

O menu lateral organiza os módulos por operação e gestão. A barra superior permite trocar a empresa, procurar registros dentro do módulo, mudar o tema visual e encerrar a sessão. O botão de cadastro abre o formulário da área atual. Selecione uma linha para ver os detalhes, atualizar dados, anexar arquivos ou gerar um documento.

Confira sempre a empresa selecionada antes de fazer uma alteração. Indicadores, listas e cadastros pertencem ao ambiente ativo.

## 3. Referências visuais

O manual dentro do sistema traz imagens fiéis da versão atual para facilitar a localização dos comandos:

- Tela de entrada: diferencia **Entrar** de **Criar conta** e mostra a organização dos módulos.
- Financeiro: mostra a posição do saldo, valores a receber, atrasos, sincronização bancária e o painel de IA.
- Fama Control: mostra a área administrativa de empresas, usuários, permissões, auditoria, backup e segurança.

Os números nas imagens são exemplos e não representam os dados da sua empresa. Para ver os dados reais, entre com sua conta e confirme o ambiente selecionado.

## 4. Fluxo completo de trabalho

1. **CRM:** crie um contato interessado, preencha origem, necessidade, valor estimado e a próxima ação. Atualize a etapa à medida que avança: Novo, Em contato, Visita técnica, Proposta e Fechados.
2. **Clientes e piscinas:** transforme o contato em cadastro da empresa. Guarde telefone, e-mail, endereço e detalhes úteis da piscina, como tipo, volume, plano e observações técnicas. Evite dados que não sejam necessários para o serviço.
3. **Orçamentos:** escolha o cliente e o serviço, informe materiais, mão de obra, desconto e validade. Confira o total calculado, salve e gere o PDF no detalhe. Atualize o status para Rascunho, Enviado, Aprovado ou Recusado.
4. **Agenda:** crie a visita, associe o cliente, endereço, tipo de serviço, horário e técnico. Use os estados Agendado, Em rota e Concluído para a equipe saber o andamento.
5. **Ordens de serviço:** abra a ordem para o atendimento. Registre execução, leituras de pH, cloro e alcalinidade quando aplicáveis, produtos utilizados, observações e anexos. Marque Aberta, Em execução ou Concluída de acordo com o trabalho realizado.
6. **Garantias:** registre item coberto, origem, datas, validade, condições e observações. Confira os próximos vencimentos; use **Agendar** para criar o atendimento na agenda.
7. **Contratos:** informe cliente, CPF/CNPJ, endereço, serviço contratado, vigência, frequência, mensalidade, vencimento e cláusulas. Revise os dados antes de gerar o PDF e acompanhe Rascunho, Ativo, Suspenso ou Encerrado.
8. **Estoque:** mantenha produto, SKU, unidade, quantidade disponível, mínimo e custo atualizados. Ajuste a quantidade após entrada ou consumo e revise os alertas de itens abaixo do mínimo.
9. **Financeiro:** registre receitas e despesas com descrição, tipo, categoria, valor, vencimento e status. Acompanhe pendentes, pagos e atrasados. Confira os indicadores para a empresa atualmente selecionada.

## 5. Financeiro, bancos, cobranças e compras

O espaço Financeiro reúne cinco abas: **Resumo**, **Pagar e receber**, **Cobranças**, **Bancos e conciliação** e **Compras e fornecedores**.

### Pagar e receber

Cadastre uma conta como receita ou despesa e confira descrição, categoria, valor, vencimento e cliente ou fornecedor quando aplicável. Atualize o status somente depois de conferir o comprovante. Revise periodicamente os itens atrasados e os recebimentos próximos.

### Cobranças

Use a lista para acompanhar valores de clientes ainda não recebidos e identificar atrasos. Localize o lançamento certo antes de baixá-lo; conferir cliente, valor e data evita quitar a conta errada.

### Bancos e conciliação

- Cadastre uma conta manual se quiser controlar o saldo ou movimentos sem conexão bancária.
- Para importar um extrato, selecione a conta, envie um CSV e confira o formato: **Data, Descrição e Valor**, ou **Data, Descrição, Crédito e Débito**. O limite da importação é de 500 linhas.
- Compare cada movimento com um lançamento de mesmo valor e natureza (entrada/receita ou saída/despesa). Escolha o lançamento correspondente para conciliar.
- Se não existir lançamento, confira o extrato e use **Criar lançamento e conciliar**. Essa ação cria o lançamento a partir do movimento selecionado.
- Para conectar a Asaas, abra **Financeiro > Bancos e conciliação**, escolha Sandbox ou Produção e informe uma chave de API do mesmo ambiente. A chave é validada no servidor, criptografada e nunca volta para o navegador. O sistema não solicita a senha da conta Asaas.
- Mercado Pago e PagBank podem ser cadastrados com segurança e escolhidos como principal. A sincronização nativa desses dois provedores fica preparada para a próxima conexão; a sincronização automática já funciona para as conexões Asaas disponíveis.
- Ao abrir o Financeiro, o sistema tenta atualizar as conexões automaticamente. O botão **Sincronizar tudo** permite repetir a atualização manualmente e mostra o resultado de cada provedor.
- Quem ainda não possui conta pode iniciar o cadastro pelo botão **Criar conta no Asaas**. Senha, documentos, selfie e aprovação são tratados no ambiente oficial da Asaas; depois, gere a chave de API e conecte-a ao Fama System.

### Compras e fornecedores

1. Cadastre o fornecedor com nome e, se disponíveis, documento fiscal, telefone e e-mail.
2. Selecione **Compra** e escolha o fornecedor.
3. Informe referência ou nota fiscal, data da compra, vencimento, valor total e observações.
4. Salve e confira a conta a pagar gerada e seu vencimento.

Evite registrar a mesma nota mais de uma vez. Compare data, número da nota e valor ao revisar a lista de compras.

## 6. Equipe e permissões

Cadastre profissionais em **Equipe** e mantenha ativos somente os que podem receber novas tarefas. A agenda mostra a carga dos técnicos com base nos compromissos atribuídos.

O proprietário ou administrador convida colaboradores em **Usuários e empresas**. O Fama Control permite que o proprietário marque os módulos permitidos por pessoa. Libere apenas o que cada função requer. Após a alteração, a pessoa deve atualizar ou reabrir o sistema. Se um módulo não aparecer, peça ao administrador para conferir a permissão.

## 7. PDFs e arquivos

Propostas e contratos podem ser gerados em PDF pelo próprio registro; confira destinatário, valores, prazo e condições antes de enviar ou assinar. Nos detalhes, use **Arquivos do registro** para anexar documentos de apoio nos formatos PDF, JPG, PNG ou WEBP, com até 10 MB por arquivo. Guarde apenas arquivos úteis ao atendimento e não inclua senhas, códigos ou chaves.

## 8. Rotina sugerida

**Todo dia:** veja a Visão geral; confirme agenda, equipe e endereços; atualize a próxima ação dos leads; acompanhe orçamentos enviados; finalize ordens e registre medições; atualize recebimentos, despesas e estoque.

**Toda semana:** revise negócios parados, cobranças atrasadas, garantias e contratos próximos do vencimento, níveis mínimos de estoque, usuários e permissões. Combine com o proprietário uma revisão de backup no Fama Control.

## 9. Segurança e solução de problemas

- Use uma conta pessoal e uma senha única. Nunca compartilhe senha, sessão ou código MFA.
- Confirme a empresa selecionada; dados ausentes podem estar em outro ambiente ou escondidos por permissão.
- Se um registro não aparecer, limpe o campo de busca, verifique filtros, atualize a página e confirme se o salvamento foi concluído.
- Se um arquivo não abrir, confirme formato e tamanho; o acesso a arquivos privados pode usar links temporários.
- Se o login falhar, confirme o e-mail, a senha e o código MFA; use **Esqueci minha senha** quando disponível.
- Para pedir ajuda, anote horário, módulo e texto do erro. Nunca envie senhas, códigos MFA, tokens ou chaves de infraestrutura.

### WhatsApp oficial

Os botões de WhatsApp do sistema abrem mensagens pré-preenchidas para revisão e envio manual. A API oficial da Meta pode ser ativada pelo administrador depois de configurar o número comercial, o token do sistema, o identificador do número e o token de verificação do webhook como segredos do ambiente. O Fama System não pede nem exibe esses segredos no navegador.

Quando ativada, a API permite enviar mensagens de texto e templates aprovados e receber eventos no webhook `/api/whatsapp`. Mensagens automáticas devem respeitar opt-in do cliente e templates aprovados pela Meta.

## 10. Fama Control

O Fama Control é um painel separado para o proprietário administrar empresas, usuários e permissões e conferir segurança, auditoria, privacidade e backups. Para instruções detalhadas, abra o **Manual completo do Fama Control** a partir da tela de entrada desse painel.
