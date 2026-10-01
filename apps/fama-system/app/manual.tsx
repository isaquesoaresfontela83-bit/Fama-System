import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Database,
  FileDown,
  FileSignature,
  KeyRound,
  LockKeyhole,
  BadgeDollarSign,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

const firstSteps = [
  [
    "1",
    "Abra e entre",
    "Use sua Conta Fama com e-mail e senha. Na primeira visita, escolha Criar conta, informe seu nome, e-mail e uma senha com ao menos 8 caracteres, e aceite os Termos de Uso e a Política de Privacidade. Se a confirmação por e-mail estiver ativa, confirme a mensagem antes de voltar ao sistema.",
  ],
  [
    "2",
    "Proteja a conta",
    "Depois de entrar, abra Privacidade e segurança e ative a verificação em duas etapas (MFA/TOTP). Guarde o código do aplicativo autenticador em local seguro.",
  ],
  [
    "3",
    "Crie o ambiente",
    "Se for o primeiro acesso, informe o nome da empresa. Esse ambiente passa a ser o espaço privado da operação, com clientes, equipe, documentos e financeiro separados.",
  ],
  [
    "4",
    "Escolha a empresa",
    "Se você administra mais de uma empresa, selecione o ambiente no campo do topo. Sempre confirme esse campo antes de cadastrar ou consultar qualquer informação.",
  ],
  [
    "5",
    "Cadastre a equipe",
    "Abra Usuários e empresas para convidar colaboradores pelo e-mail que eles usarão no Fama System. Depois defina o perfil e os módulos permitidos.",
  ],
  [
    "6",
    "Comece pelo CRM",
    "Registre os contatos interessados, defina a próxima ação e conduza cada oportunidade até a proposta e o fechamento.",
  ],
];

const moduleGuides = [
  {
    title: "CRM",
    purpose: "Organizar oportunidades e vendas",
    fields: "Nome, telefone, origem, interesse, valor estimado e próxima ação.",
    routine:
      "Use os cartões nas etapas Novo, Em contato, Visita técnica, Proposta e Fechados. Abra um cartão para consultar os dados e avance a etapa quando a negociação evoluir.",
  },
  {
    title: "Orçamentos",
    purpose: "Montar propostas comerciais",
    fields:
      "Cliente, serviço, materiais, mão de obra, desconto, validade e observações.",
    routine:
      "O total é calculado automaticamente. Atualize o status para Rascunho, Enviado, Aprovado ou Recusado. Use PDF para gerar a proposta e anexe memoriais, fotos ou documentos.",
  },
  {
    title: "Agenda",
    purpose: "Planejar visitas e rotas",
    fields:
      "Compromisso, cliente, data/hora, técnico, tipo, endereço e observações.",
    routine:
      "Os compromissos são agrupados por dia. Use Agendado, Em rota e Concluído para acompanhar a execução. A lateral mostra a carga dos técnicos ativos.",
  },
  {
    title: "Ordens de serviço",
    purpose: "Controlar a execução em campo",
    fields: "Cliente, serviço, data, técnico, valor e observações.",
    routine:
      "Acompanhe Aberta, Em execução e Concluída. No detalhe ficam o número da OS, medições de pH, cloro e alcalinidade quando registradas, produtos utilizados, relatório técnico e anexos.",
  },
  {
    title: "Garantias",
    purpose: "Controlar cobertura e pós-venda",
    fields:
      "Cliente, origem, item coberto, compra/entrega, vencimento, condições e observações.",
    routine:
      "Observe os vencimentos dos próximos 30 dias. Clique em Agendar para criar o atendimento na Agenda, escolhendo data, horário e técnico.",
  },
  {
    title: "Clientes e piscinas",
    purpose: "Manter histórico técnico do cliente",
    fields:
      "Nome, telefone, e-mail, endereço, tipo e volume da piscina, plano e observações técnicas.",
    routine:
      "Use o cadastro como ficha principal do cliente e registre características que ajudam a equipe a preparar visitas e manutenções.",
  },
  {
    title: "Contratos",
    purpose: "Gerenciar serviços recorrentes",
    fields:
      "Cliente, CPF/CNPJ, endereço, objeto, vigência, frequência, mensalidade, dia de pagamento e cláusulas.",
    routine:
      "Acompanhe contratos Rascunho, Ativo, Suspenso e Encerrado. A tela calcula a receita mensal ativa e permite gerar o contrato em PDF.",
  },
  {
    title: "Estoque",
    purpose: "Controlar produtos, peças e equipamentos",
    fields: "Produto, SKU, unidade, quantidade, mínimo e custo unitário.",
    routine:
      "Use + e − para ajustes rápidos. Itens abaixo do mínimo aparecem como alerta e o sistema estima o valor total do estoque.",
  },
  {
    title: "Financeiro",
    purpose: "Acompanhar contas a pagar e receber",
    fields: "Descrição, tipo, categoria, valor, vencimento e status.",
    routine:
      "Cadastre Receitas e Despesas. Use Pendente, Pago e Atrasado. O saldo projetado considera recebidos + a receber − despesas. As abas do financeiro separam Resumo, Pagar e receber, Cobranças, Bancos e conciliação, e Compras e fornecedores.",
  },
  {
    title: "Equipe",
    purpose: "Distribuir capacidade operacional",
    fields:
      "Nome, função, telefone, cor de identificação e situação ativa/inativa.",
    routine:
      "A carga de trabalho é calculada pelos agendamentos atribuídos. Somente profissionais ativos aparecem como opção para novas rotas.",
  },
];

const statuses = [
  ["CRM", "Novo → Em contato → Visita técnica → Proposta → Fechados"],
  ["Orçamentos", "Rascunho · Enviado · Aprovado · Recusado"],
  ["Agenda", "Agendado · Em rota · Concluído"],
  ["Ordens de serviço", "Aberta · Em execução · Concluída"],
  ["Garantias", "Ativa · Atendimento agendado · Concluída · Expirada"],
  ["Contratos", "Rascunho · Ativo · Suspenso · Encerrado"],
  ["Financeiro", "Pendente · Pago · Atrasado"],
];

export function Manual() {
  return (
    <div className="manual-layout">
      <section className="surface manual-intro">
        <div className="manual-icon">
          <BookOpenCheck />
        </div>
        <div>
          <small>MANUAL COMPLETO</small>
          <h2>Como operar o Fama System</h2>
          <p>
            Um roteiro do primeiro acesso ao controle diário de vendas,
            serviços, contratos, equipe, documentos e segurança.
          </p>
        </div>
        <div className="manual-actions">
          <span>
            <CheckCircle2 /> Dados separados por empresa
          </span>
          <span>
            <LockKeyhole /> Acesso por convite
          </span>
          <span>
            <ShieldCheck /> Segurança por camadas
          </span>
        </div>
      </section>

      <nav className="surface manual-toc" aria-label="Índice do manual">
        <strong>Ir direto para</strong>
        <a href="#primeiro-acesso">Primeiro acesso</a>
        <a href="#navegacao">Navegação</a>
        <a href="#dashboard">Visão geral</a>
        <a href="#referencias-visuais">Referências visuais</a>
        <a href="#modulos">Módulos</a>
        <a href="#financeiro-detalhado">Financeiro, bancos e compras</a>
        <a href="#planos-pagamentos">Planos e pagamentos</a>
        <a href="#documentos">Documentos</a>
        <a href="#permissoes">Permissões</a>
        <a href="#seguranca">Segurança</a>
        <a href="#rotina">Rotina diária</a>
        <a href="#suporte">Suporte</a>
      </nav>

      <section id="primeiro-acesso" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>COMECE AQUI</small>
            <h2>Primeiro acesso, passo a passo</h2>
          </div>
          <KeyRound />
        </div>
        <div className="manual-steps">
          {firstSteps.map(([number, title, description]) => (
            <article className="manual-step" key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="manual-note">
          <ShieldCheck />
          <p>
            <strong>Importante:</strong> cada login deve ser pessoal. Não
            compartilhe senha, sessão, código MFA ou chave de infraestrutura.
          </p>
        </div>
      </section>

      <section id="referencias-visuais" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>REFERÊNCIA FIEL DA INTERFACE</small>
            <h2>Imagens para localizar cada área</h2>
          </div>
          <BookOpenCheck />
        </div>
        <p className="manual-muted">
          As imagens abaixo reproduzem a navegação, os textos e a organização
          visual da versão atual. Os valores exibidos são apenas exemplos; os
          dados reais aparecem depois do login e mudam conforme a empresa.
        </p>
        <div className="manual-image-grid">
          <figure className="manual-image-card">
            <img src="/manual/login-fama-system.svg" alt="Tela de entrada do Fama System com login e prévia dos módulos" />
            <figcaption><strong>1. Entrada:</strong> use Entrar ou Criar conta e confirme a empresa antes de operar.</figcaption>
          </figure>
          <figure className="manual-image-card">
            <img src="/manual/financeiro-fama-system.svg" alt="Resumo do Financeiro do Fama System com saldo, contas, bancos e IA" />
            <figcaption><strong>2. Financeiro:</strong> consulte saldo, contas, bancos, sincronização e prioridades da IA.</figcaption>
          </figure>
          <figure className="manual-image-card manual-image-card-wide">
            <img src="/manual/fama-control.svg" alt="Painel Fama Control com empresas, usuários, permissões, auditoria e segurança" />
            <figcaption><strong>3. Fama Control:</strong> o proprietário administra empresas, usuários, permissões, auditoria, backup e segurança.</figcaption>
          </figure>
        </div>
      </section>

      <section id="navegacao" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>ORIENTAÇÃO DA TELA</small>
            <h2>Navegação e comandos gerais</h2>
          </div>
          <Sparkles />
        </div>
        <div className="manual-two-columns">
          <div>
            <h3>Menu lateral</h3>
            <p>
              O menu é dividido em <strong>Operação</strong> (Visão geral, CRM,
              Orçamentos, Agenda, Ordens de serviço e Garantias) e{" "}
              <strong>Gestão</strong> (Clientes e piscinas, Contratos, Estoque,
              Financeiro e Equipe).
            </p>
            <p>
              Na área <strong>Conta</strong> ficam Usuários e empresas,
              Privacidade e segurança, Manual de uso e, somente para o
              proprietário da plataforma, a área Plataforma.
            </p>
          </div>
          <div>
            <h3>Barra superior</h3>
            <p>
              Use o seletor para trocar a empresa, o campo de busca para filtrar
              o módulo atual, o botão de tema para alternar claro/escuro e o
              ícone de saída para encerrar a sessão.
            </p>
            <p>
              Quando o módulo permite cadastro, o botão azul no topo abre o
              formulário correspondente. Clique no nome ou na seta de uma linha
              para abrir os detalhes.
            </p>
          </div>
        </div>
        <figure className="manual-figure">
          <div className="manual-screen-head">
            <span>Fama System</span>
            <small>PRÉVIA ILUSTRATIVA — MENU PRINCIPAL</small>
          </div>
          <div className="manual-screen-menu">
            <b>Visão geral</b>
            <span>CRM</span>
            <span>Orçamentos</span>
            <span>Agenda</span>
            <span>Ordens de serviço</span>
            <span>Garantias</span>
            <span>Clientes e piscinas</span>
            <span>Contratos</span>
            <span>Estoque</span>
            <b>Financeiro</b>
            <span>Equipe</span>
          </div>
          <figcaption>
            O seletor de empresa, o menu e a conta definem qual área você está
            usando. A imagem é uma referência visual; os dados reais aparecem
            após entrar.
          </figcaption>
        </figure>
      </section>

      <section id="dashboard" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>VISÃO DE GESTÃO</small>
            <h2>Como ler a Visão geral</h2>
          </div>
          <Database />
        </div>
        <div className="manual-check-grid">
          <div>
            <h3>Operação de hoje</h3>
            <p>
              Mostra compromissos do dia, ordens abertas e acesso rápido à
              Agenda.
            </p>
          </div>
          <div>
            <h3>Saúde da água</h3>
            <p>
              Exibe a última ordem com pH, cloro e alcalinidade quando esses
              parâmetros estão registrados.
            </p>
          </div>
          <div>
            <h3>Indicadores</h3>
            <p>
              Receita recebida, valores a receber, pipeline comercial e alertas
              de estoque.
            </p>
          </div>
          <div>
            <h3>Atenção necessária</h3>
            <p>Lista cobranças atrasadas e itens que precisam de reposição.</p>
          </div>
        </div>
        <p className="manual-muted">
          Os valores são calculados apenas para a empresa selecionada. Trocar de
          empresa troca também todos os indicadores e registros exibidos.
        </p>
      </section>

      <section id="modulos" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>OPERAÇÃO COMPLETA</small>
            <h2>Guia de cada módulo</h2>
          </div>
          <CalendarDays />
        </div>
        <div className="manual-module-grid">
          {moduleGuides.map((module) => (
            <article className="manual-module-card" key={module.title}>
              <h3>{module.title}</h3>
              <span>{module.purpose}</span>
              <p>
                <strong>Cadastro:</strong> {module.fields}
              </p>
              <p>
                <strong>Uso:</strong> {module.routine}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="financeiro-detalhado" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>CONTAS E MOVIMENTAÇÕES</small>
            <h2>Financeiro, bancos e compras</h2>
          </div>
          <Database />
        </div>
        <figure className="manual-figure manual-finance-figure">
          <div className="manual-screen-head">
            <span>Financeiro</span>
            <small>FLUXO DE TRABALHO</small>
          </div>
          <div className="manual-flow">
            <article>
              <b>1</b>
              <strong>Cadastre a conta</strong>
              <span>Receita, despesa ou fornecedor</span>
            </article>
            <i>→</i>
            <article>
              <b>2</b>
              <strong>Registre o movimento</strong>
              <span>Vencimento, valor e categoria</span>
            </article>
            <i>→</i>
            <article>
              <b>3</b>
              <strong>Concilie</strong>
              <span>Vincule ao extrato bancário</span>
            </article>
          </div>
          <figcaption>
            O fluxo ilustra a relação entre lançamentos, extratos e conciliação;
            os dados da empresa não são exibidos neste manual.
          </figcaption>
        </figure>
        <div className="manual-module-grid manual-finance-details">
          <article className="manual-module-card">
            <h3>1. Resumo</h3>
            <p>
              Veja valores a receber, a pagar, itens em atraso e contas
              conectadas. Os atalhos iniciam um novo recebimento, uma despesa,
              uma importação de extrato ou uma compra.
            </p>
          </article>
          <article className="manual-module-card">
            <h3>2. Pagar e receber</h3>
            <p>
              Crie um lançamento, escolha receita ou despesa, descreva,
              categorize, informe valor e vencimento e salve. Ao liquidar,
              atualize o status para Pago. Confira os vencimentos antes de
              marcar como pago.
            </p>
          </article>
          <article className="manual-module-card">
            <h3>3. Cobranças</h3>
            <p>
              Consulte os recebimentos pendentes e atrasados. Registre o
              pagamento no lançamento correspondente para atualizar os
              indicadores; confirme valor e data com o comprovante.
            </p>
          </article>
          <article className="manual-module-card">
            <h3>4. Bancos e conciliação</h3>
            <p>
              Conecte Asaas, Mercado Pago ou PagBank como principal, cadastre
              uma conta manual ou importe extrato CSV. A sincronização do Asaas
              pode ser iniciada automaticamente ao abrir o Financeiro e também
              pelo botão Sincronizar tudo. A chave é validada no servidor e
              nunca volta para o navegador. No CSV, selecione a conta e envie
              até 500 linhas com Data, Descrição e Valor ou com Crédito e
              Débito. Depois, confira cada movimento e faça a conciliação.
            </p>
          </article>
          <article className="manual-module-card">
            <h3>5. Compras e fornecedores</h3>
            <p>
              Cadastre o fornecedor com nome e, se necessário, documento e
              contato. Registre a compra escolhendo o fornecedor, número de
              nota, data, vencimento, valor total e observações. Ao salvar, o
              sistema cria a conta a pagar associada; verifique o vencimento e a
              nota fiscal.
            </p>
          </article>
          <article className="manual-module-card">
            <h3>6. Nota fiscal pelo portal oficial</h3>
            <p>No Financeiro, abra Notas fiscais e clique em Preparar nota fiscal. Informe cliente, descrição, valor e competência. Copie os dados e abra o emissor nacional ou o emissor habilitado pela prefeitura. Para produtos, use o emissor autorizado pela SEFAZ do seu estado. Entre com o acesso do titular, confira os dados e emita em produção. Baixe o PDF ou XML, anexe no Fama e registre o número e a chave. O XML confere emitente, cliente e valor e preenche número e chave. Consulte a autenticidade e a situação no portal oficial. A nota fica guardada como Nota registrada. Cancelamentos devem ser confirmados primeiro no emissor e depois registrados no histórico.</p>
          </article>
          <article className="manual-module-card">
            <h3>Conferências importantes</h3>
            <p>
              Evite lançar a mesma compra duas vezes. Revise sinal do movimento,
              conta selecionada e diferença de centavos antes de conciliar. Um
              movimento conciliado fecha a correspondência com aquele
              lançamento.
            </p>
          </article>
        </div>
        <div className="manual-note">
          <ShieldCheck />
          <p>
            <strong>Asaas:</strong> conecte uma conta existente com uma chave de
            API do ambiente correto ou inicie o cadastro no site oficial. Mercado
            Pago e PagBank podem ser cadastrados com segurança e escolhidos
            como principal; a sincronização nativa deles fica preparada para a
            próxima conexão. A chave fica criptografada no servidor e a senha
            nunca é solicitada pelo Fama System. Também é possível usar conta
            manual ou extrato CSV.
          </p>
        </div>
      </section>

      <section id="planos-pagamentos" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>ASSINATURA DA PLATAFORMA</small>
            <h2>Planos, Pix automático e ativação</h2>
          </div>
          <BadgeDollarSign />
        </div>
        <div className="manual-flow">
          <article>
            <b>1</b>
            <strong>Escolha o plano</strong>
            <span>O proprietário ou administrador abre Planos e pagamentos e compara Inicial, Intermediário e Profissional.</span>
          </article>
          <i>→</i>
          <article>
            <b>2</b>
            <strong>Gere o Pix</strong>
            <span>Informe o responsável financeiro. A cobrança é criada pela Asaas usando a chave segura da plataforma.</span>
          </article>
          <i>→</i>
          <article>
            <b>3</b>
            <strong>Ativação automática</strong>
            <span>Quando a Asaas confirma o pagamento, o webhook atualiza o plano para ativo e registra a próxima validade.</span>
          </article>
        </div>
        <div className="manual-module-grid manual-finance-details">
          <article className="manual-module-card">
            <h3>Quem pode pagar</h3>
            <span>Segurança</span>
            <p>Somente donos e administradores da empresa veem a área de planos. Colaboradores e técnicos não alteram assinatura.</p>
          </article>
          <article className="manual-module-card">
            <h3>Dados usados</h3>
            <span>Privacidade</span>
            <p>Nome, e-mail, CPF/CNPJ e telefone são usados apenas para gerar a cobrança. Chave Asaas nunca aparece no navegador.</p>
          </article>
          <article className="manual-module-card">
            <h3>Status do plano</h3>
            <span>Controle</span>
            <p>Teste ativo, aguardando Pix, ativo e atenção no pagamento indicam se a empresa está liberada, pendente ou precisa regularizar.</p>
          </article>
          <article className="manual-module-card">
            <h3>Antes de vender</h3>
            <span>Configuração</span>
            <p>Cadastre a chave Asaas da plataforma como segredo do site e configure o webhook de pagamentos na conta Asaas.</p>
          </article>
        </div>
        <div className="manual-note">
          <ShieldCheck />
          <p>
            <strong>Regra de segurança:</strong> não cole chave de API em conversa,
            manual, planilha ou código. A chave deve ficar somente nos segredos do
            ambiente de produção.
          </p>
        </div>
      </section>

      <section className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>LEITURA RÁPIDA</small>
            <h2>Status e momento de uso</h2>
          </div>
          <CheckCircle2 />
        </div>
        <div className="manual-status-table">
          {statuses.map(([module, values]) => (
            <div key={module}>
              <strong>{module}</strong>
              <span>{values}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="documentos" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>ARQUIVOS E DOCUMENTOS</small>
            <h2>PDF, anexos e cópias</h2>
          </div>
          <FileDown />
        </div>
        <div className="manual-two-columns">
          <div>
            <h3>PDFs</h3>
            <p>
              Em Orçamentos, clique em <strong>PDF</strong> para gerar uma
              proposta. Em Contratos, abra o registro e clique em{" "}
              <strong>Gerar contrato em PDF</strong>. Confira o conteúdo antes
              de enviar ou assinar.
            </p>
          </div>
          <div>
            <h3>Anexos</h3>
            <p>
              Na área Arquivos de cada detalhe, envie PDF, JPG, PNG ou WEBP de
              até 10 MB. Os arquivos ficam privados e o link de acesso é
              temporário.
            </p>
          </div>
        </div>
        <div className="manual-note">
          <FileSignature />
          <p>
            <strong>Boa prática:</strong> anexe fotos da piscina, notas fiscais,
            plantas, comprovantes, laudos e documentos que ajudem a equipe a
            comprovar o atendimento.
          </p>
        </div>
      </section>

      <section id="permissoes" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>ACESSO DA EQUIPE</small>
            <h2>Convites, perfis e permissões</h2>
          </div>
          <UsersRound />
        </div>
        <ol className="manual-ordered">
          <li>
            Abra <strong>Usuários e empresas</strong> e clique em{" "}
            <strong>Adicionar usuário</strong>.
          </li>
          <li>
            Informe o e-mail exato que a pessoa usará para entrar no Fama
            System.
          </li>
          <li>
            Escolha Colaborador ou Técnico. O proprietário também pode criar
            Administradores.
          </li>
          <li>
            No Fama Control, use <strong>Configurar</strong> para marcar os
            módulos permitidos.
          </li>
          <li>
            Quando a pessoa sair da empresa, remova o acesso imediatamente.
          </li>
        </ol>
        <p className="manual-muted">
          Proprietário e Administrador possuem acesso total. Colaboradores e
          Técnicos só visualizam e operam os módulos liberados; a permissão é
          conferida na tela e também no servidor.
        </p>
        <figure className="manual-figure manual-control-reference">
          <img src="/manual/fama-control.svg" alt="Referência visual do Fama Control para permissões por usuário" />
          <figcaption>Use Configurar no usuário correto e marque somente os módulos necessários para a função.</figcaption>
        </figure>
      </section>

      <section id="seguranca" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>PROTEÇÃO DA OPERAÇÃO</small>
            <h2>Privacidade, segurança e recuperação</h2>
          </div>
          <ShieldCheck />
        </div>
        <div className="manual-security-list">
          <article>
            <KeyRound />
            <div>
              <h3>MFA/TOTP</h3>
              <p>
                Ative em Privacidade e segurança. Em cada novo login, o código
                do autenticador será solicitado.
              </p>
            </div>
          </article>
          <article>
            <LockKeyhole />
            <div>
              <h3>Separação por empresa</h3>
              <p>
                O sistema valida a empresa, o usuário e a permissão antes de
                carregar ou alterar registros.
              </p>
            </div>
          </article>
          <article>
            <Database />
            <div>
              <h3>Exportação e backup</h3>
              <p>
                Administradores podem exportar a cópia da empresa. O
                proprietário pode baixar o backup global no Fama Control.
              </p>
            </div>
          </article>
          <article>
            <CircleHelp />
            <div>
              <h3>Lixeira</h3>
              <p>
                Registros operacionais excluídos ficam protegidos na recuperação
                por até 30 dias e podem ser restaurados por um administrador.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section id="rotina" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>PROCESSO RECOMENDADO</small>
            <h2>Rotina diária e semanal</h2>
          </div>
          <Sparkles />
        </div>
        <div className="manual-routine">
          <div>
            <h3>Todos os dias</h3>
            <ol>
              <li>Confira a Visão geral e os compromissos.</li>
              <li>Confirme técnicos, endereços e horários.</li>
              <li>Atualize a próxima ação de cada lead.</li>
              <li>Envie ou atualize orçamentos pendentes.</li>
              <li>Finalize ordens e registre o relatório do atendimento.</li>
              <li>Confira garantias próximas do vencimento.</li>
              <li>Lance recebimentos, despesas e reposições de estoque.</li>
            </ol>
          </div>
          <div>
            <h3>Toda semana</h3>
            <ol>
              <li>Revise o pipeline e os orçamentos recusados.</li>
              <li>Confira contratos que vencem nos próximos 30 dias.</li>
              <li>Revise permissões e remova acessos desnecessários.</li>
              <li>Exporte uma cópia dos dados importantes.</li>
              <li>Confira Auditoria e Segurança no Fama Control.</li>
            </ol>
          </div>
        </div>
      </section>

      <section id="suporte" className="surface manual-section">
        <div className="manual-section-heading">
          <div>
            <small>RESOLUÇÃO DE PROBLEMAS</small>
            <h2>Se alguma coisa não aparecer</h2>
          </div>
          <CircleHelp />
        </div>
        <div className="manual-troubleshooting">
          <p>
            <strong>Empresa errada:</strong> confira o seletor no topo e troque
            para o ambiente correto.
          </p>
          <p>
            <strong>Módulo escondido:</strong> peça ao proprietário ou
            administrador para revisar sua permissão no Fama Control.
          </p>
          <p>
            <strong>Lista vazia:</strong> confirme a empresa, atualize a página
            e verifique se o registro foi salvo.
          </p>
          <p>
            <strong>Arquivo sem abrir:</strong> confira o formato e o limite de
            10 MB; o link de download é temporário.
          </p>
          <p>
            <strong>Login recusado:</strong> confirme e-mail, senha e, se
            necessário, use Esqueci minha senha. Com MFA ativo, confira o código
            do autenticador.
          </p>
          <p>
            <strong>Erro persistente:</strong> registre o horário, a empresa, o
            módulo e a mensagem exibida; não envie senha ou chave de
            infraestrutura.
          </p>
        </div>
      </section>

      <section className="manual-columns">
        <section className="surface manual-help">
          <div className="panel-heading">
            <div>
              <small>SEGURANÇA</small>
              <h2>O que nunca compartilhar</h2>
            </div>
            <LockKeyhole />
          </div>
          <p>
            Não envie senhas, códigos MFA, tokens, chaves do Supabase ou chaves
            de criptografia por mensagens, anotações, anexos ou chamados.
          </p>
        </section>
        <section className="surface manual-help">
          <div className="panel-heading">
            <div>
              <small>PROPRIETÁRIO</small>
              <h2>Fama Control</h2>
            </div>
            <ShieldCheck />
          </div>
          <p>
            Use o painel privado para empresas, permissões, auditoria,
            solicitações LGPD, backup global, recriptografia e restauração de
            empresas.
          </p>
        </section>
        <section className="surface manual-help">
          <div className="panel-heading">
            <div>
              <small>VERSÃO</small>
              <h2>Manual atualizado</h2>
            </div>
            <BookOpenCheck />
          </div>
          <p>
            Este manual acompanha a versão atual do Fama System e pode ser
            aberto pela área Manual de uso ou pelo rodapé da tela de acesso.
          </p>
        </section>
      </section>
    </div>
  );
}
