import Link from "next/link";
import { Activity, ArchiveRestore, Blocks, Building2, CheckCircle2, Database, KeyRound, LockKeyhole, ShieldCheck, Sparkles, UserCog } from "lucide-react";
const areas = [
    ["Visão geral", "Confira empresas, usuários e o estado geral da plataforma."],
    ["Empresas e usuários", "Crie empresas gratuitas, gerencie contas, prazos e mensalidades, ou suspenda e restaure um ambiente."],
    ["Blocos do sistema", "Adicione, remova ou herde 14 blocos, incluindo Chat, para todos, uma empresa ou uma pessoa, inclusive proprietários."],
    ["Fama IA", "Consulte os dados disponíveis no painel e prepare ações para revisão."],
    ["Configurar IA", "Defina fontes, comandos e opções do assistente compartilhadas com o Fama System."],
    ["Vendas", "Acompanhe os indicadores comerciais apresentados pelo painel."],
    ["Financeiro", "Confira os indicadores financeiros da plataforma."],
    ["Planos", "Acompanhe os planos e as condições de acesso das empresas."],
    ["Suporte", "Leia os chamados enviados pelo Fama System e registre seu acompanhamento."],
    ["Alertas", "Confira as situações que precisam de atenção."],
    ["Orçamento", "Ajuste categorias, serviços, preços, campos e os acréscimos para urgência e emergência do catálogo compartilhado."],
    ["Usuários", "Revise empresa, perfil, situação e módulos permitidos de cada pessoa."],
    ["Segurança", "Confira identidade, MFA, criptografia, conexão de dados, auditoria e recuperação."],
    ["Auditoria", "Investigue alterações pelo evento, empresa, data e identificador do registro."],
    ["Privacidade", "Acompanhe e responda às solicitações dos titulares de dados."],
];
export function ControlManual() {
    return <div className="control-manual">
    <nav className="control-manual-toc" aria-label="Índice do manual">
      <a href="#acesso">Acesso</a><a href="#mapa">Mapa do painel</a><a href="#empresas">Empresas</a>
      <a href="#usuarios">Usuários e permissões</a><a href="#blocos">Blocos do sistema</a><a href="#ia-control">Fama IA</a>
      <a href="#seguranca">Segurança</a><a href="#auditoria">Auditoria e privacidade</a>
      <a href="#backup">Backup e recuperação</a><a href="#rotina-control">Rotina recomendada</a>
    </nav>
    <section id="acesso" className="control-manual-panel">
      <small>1 · ENTRADA NO PAINEL</small><h2>Primeiro acesso e login</h2>
      <p>O Fama Control é o painel administrativo do proprietário da plataforma. Abra o endereço oficial, confira o domínio e entre com o e-mail autorizado e a senha. No primeiro acesso, use <strong>Primeiro acesso do proprietário</strong> para criar a conta autorizada. Se a verificação em duas etapas estiver ativa, informe o código temporário do aplicativo autenticador.</p>
      <div className="control-manual-callout"><KeyRound /><span><strong>Não consegue entrar?</strong> Confirme o e-mail autorizado e o código MFA. Não compartilhe senha ou código. Se o problema continuar, use o fluxo de suporte do proprietário.</span></div>
    </section>
    <section id="mapa" className="control-manual-panel">
      <small>2 · ORIENTAÇÃO DA TELA</small><h2>Mapa visual das áreas</h2>
      <p>O menu lateral leva às áreas principais. A prévia abaixo é ilustrativa, sem dados reais.</p>
      <figure className="control-manual-figure">
        <div className="control-manual-screen-head"><span>Fama Control</span><small>PAINEL DO PROPRIETÁRIO</small></div>
        <div className="control-manual-screen">
          <nav><b>Visão geral</b><span>Empresas e usuários</span><span>Blocos do sistema</span><span>Fama IA</span><span>Configurar IA</span><span>Segurança</span><span>Auditoria</span></nav>
          <div><strong>Estado da plataforma</strong><div className="control-manual-screen-cards"><i>Empresas cadastradas</i><i>Usuários vinculados</i><i>Segurança</i></div><p>Blocos · Permissões · Auditoria · Recuperação</p></div>
        </div>
        <figcaption>Esquema do painel. A disposição se adapta ao computador e ao celular.</figcaption>
      </figure>
      <div className="control-manual-area-list">{areas.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>
    <section id="empresas" className="control-manual-panel">
      <small>3 · AMBIENTES DE CLIENTES</small><h2>Gerenciar empresas e catálogo</h2>
      <ol>
        <li>Em <strong>Empresas e usuários</strong>, confirme nome, identificador, quantidade de pessoas e estado.</li>
        <li>Use <strong>Nova empresa</strong> para cadastrar um ambiente e sua conta de acesso. Confira o prazo e a condição de mensalidade antes de salvar.</li>
        <li>Use <strong>Suspender</strong> para interromper temporariamente o acesso e <strong>Reativar</strong> para restaurá-lo.</li>
        <li><strong>Lixeira</strong> move a empresa para recuperação conforme as regras de retenção; use <strong>Restaurar</strong> para uma empresa removida.</li>
        <li>Em <strong>Orçamento</strong>, configure categorias, serviços, unidades, preços, margens, campos e percentuais de urgência e emergência.</li>
        <li>Confira o catálogo e pressione <strong>Salvar alterações</strong> para aplicar a configuração compartilhada com o Fama System.</li>
      </ol>
      <div className="control-manual-callout"><Building2 /><span>Os registros operacionais de cada negócio continuam separados no espaço da empresa dentro do Fama System.</span></div>
    </section>
    <section id="usuarios" className="control-manual-panel">
      <small>4 · ACESSO DA EQUIPE</small><h2>Configurar usuários e permissões</h2>
      <ol>
        <li>Em <strong>Usuários</strong>, localize a pessoa pelo nome ou e-mail e confira empresa, perfil e situação.</li>
        <li>Selecione <strong>Configurar</strong> para abrir as permissões individuais.</li>
        <li>Use um modelo como ponto inicial, se necessário, e revise cada módulo marcado.</li>
        <li>Libere os módulos necessários à função e retire acessos que deixaram de ser necessários.</li>
        <li>Pressione <strong>Salvar acessos</strong> e aguarde a confirmação da gravação no banco.</li>
      </ol>
      <p>O perfil define o acesso inicial. As regras de <strong>Blocos do sistema</strong> também se aplicam, inclusive ao proprietário da empresa. O Fama System confere o acesso na navegação e no servidor; a tela se atualiza ao voltar à janela e a cada 30 segundos enquanto online.</p>
      <figure className="control-manual-figure"><div className="control-manual-permissions"><UserCog /><div><strong>Permissões por módulo</strong><span><CheckCircle2 /> Clientes e piscinas</span><span><CheckCircle2 /> Agenda e ordens de serviço</span><span>□ Financeiro</span><span>□ Usuários e empresas</span><b className="control-manual-button">Salvar acessos</b></div></div><figcaption>Exemplo de seleção por módulo. Confira a empresa e a pessoa antes de salvar.</figcaption></figure>
    </section>
    <section id="blocos" className="control-manual-panel">
      <small>5 · CONFIGURAÇÃO DO FAMA SYSTEM</small><h2>Adicionar e remover blocos para qualquer empresa ou pessoa</h2>
      <ol>
        <li>Abra <strong>Blocos do sistema</strong> e escolha o alcance: geral, empresa ou pessoa.</li>
        <li>Para empresa ou pessoa, selecione o destinatário e confira sua identificação. Proprietários de empresas também podem receber regras individuais.</li>
        <li>Em cada bloco, escolha <strong>Adicionar</strong>, <strong>Remover</strong> ou <strong>Herdar</strong>. Use a busca para localizar um bloco ou as ações em lote para todos os blocos do destino selecionado.</li>
        <li>Confira a prévia do acesso efetivo e salve. Aguarde a confirmação antes de mudar o destinatário.</li>
        <li>Se houver conflito com uma alteração recente, recarregue a regra e revise sua escolha antes de salvar novamente.</li>
      </ol>
      <p>A regra da pessoa prevalece sobre a empresa; a empresa prevalece sobre a regra geral. <strong>Herdar</strong> usa a configuração anterior. Sem regras explícitas, permanecem as permissões do perfil. Cada alteração é registrada com revisão e auditoria.</p>
      <div className="control-manual-callout"><Blocks /><span>Remover um bloco restringe o acesso sem apagar dados. Remover <strong>Fama IA</strong> impede consultas, preparação automática e respostas pelo WhatsApp para o destinatário. A regra geral vale para todos, salvo exceções explícitas por empresa ou pessoa.</span></div>
    </section>
    <section id="ia-control" className="control-manual-panel">
      <small>6 · ASSISTENTE E CONFIGURAÇÃO</small><h2>Usar e configurar a Fama IA</h2>
      <p>Em <strong>Fama IA</strong>, consulte os dados disponíveis no painel. O núcleo Fama responde sem depender de uma API externa de inferência. A preparação local reutiliza os arquivos salvos e baixa somente os ausentes quando autorizada; no celular, o assistente usa o modo leve.</p>
      <p>Em <strong>Configurar IA</strong>, revise as fontes, opções e comandos do assistente. Salve e aguarde a confirmação. Se outro administrador tiver alterado a configuração, recarregue antes de salvar novamente. As preferências não concedem acesso a registros que os blocos ou as permissões da pessoa restringem.</p>
      <div className="control-manual-callout"><Sparkles /><span>Para conectar a IA ao WhatsApp, o responsável pela empresa usa <strong>Fama System → Configurações → Fama IA no WhatsApp</strong>. É necessário conectar e confirmar o número oficial na Meta e vincular os telefones da equipe a usuários ativos. O manual do System detalha a preparação.</span></div>
    </section>
    <section id="seguranca" className="control-manual-panel">
      <small>7 · PROTEÇÃO E ESTADO</small><h2>Conferir segurança</h2>
      <p>Abra <strong>Segurança</strong> e confira os indicadores e a data da última verificação. Eles mostram a configuração da identidade autorizada, criptografia, conexão de dados e recursos de produção.</p>
      <div className="control-manual-security">
        <article><ShieldCheck /><div><h3>Identidade e MFA</h3><p>Use o e-mail autorizado. Ative MFA e guarde a recuperação do autenticador em local seguro.</p></div></article>
        <article><LockKeyhole /><div><h3>Criptografia</h3><p>Confira a proteção dos dados sensíveis. Antes de proteger registros existentes, revise o indicador de configuração.</p></div></article>
        <article><Activity /><div><h3>Limites e auditoria</h3><p>Confira limites de requisição e disponibilidade dos eventos de auditoria.</p></div></article>
        <article><Database /><div><h3>Recuperação</h3><p>Confira snapshots e backups antes de restaurar dados.</p></div></article>
      </div>
      <div className="control-manual-callout"><ShieldCheck /><span>Os indicadores dependem da configuração do ambiente. Um item indisponível precisa ser conferido antes de utilizar a função correspondente.</span></div>
    </section>
    <section id="auditoria" className="control-manual-panel">
      <small>8 · RASTREABILIDADE E PRIVACIDADE</small><h2>Auditoria e solicitações de privacidade</h2>
      <p><strong>Auditoria:</strong> confira data, evento, entidade, empresa e registro para entender uma ação. Preserve os eventos durante uma investigação.</p>
      <p><strong>Privacidade:</strong> leia o pedido e os detalhes. Use <strong>Assumir</strong> para começar o atendimento e <strong>Concluir</strong> para registrar a resposta final. Use <strong>Rejeitar</strong> com uma justificativa apropriada. Confirme a identidade do solicitante antes de revelar ou exportar dados.</p>
    </section>
    <section id="backup" className="control-manual-panel">
      <small>9 · CONTINUIDADE</small><h2>Validar, baixar e recuperar</h2>
      <ol>
        <li>Antes de uma manutenção, abra <strong>Segurança</strong> e selecione <strong>Validar backup</strong>.</li>
        <li>Confira se empresas, registros, usuários e anexos esperados foram contados.</li>
        <li>Use <strong>Baixar backup global</strong> e guarde a cópia em local privado, com acesso restrito.</li>
        <li>Para uma empresa na lixeira, abra <strong>Empresas e usuários</strong> e use <strong>Restaurar</strong>.</li>
        <li>Após a recuperação, confira estado, usuários, blocos e acesso no Fama System.</li>
      </ol>
      <div className="control-manual-callout"><ArchiveRestore /><span>Backups contêm informações sensíveis. Mantenha proteção e retenção adequadas; não os disponibilize em links públicos.</span></div>
    </section>
    <section id="rotina-control" className="control-manual-panel">
      <small>10 · ROTINA DO PROPRIETÁRIO</small><h2>Conferência semanal</h2>
      <div className="control-manual-checks">
        <p><CheckCircle2 /> Revise empresas novas, suspensas e removidas.</p>
        <p><CheckCircle2 /> Confira contas, convites, permissões e regras de blocos.</p>
        <p><CheckCircle2 /> Revise as preferências da IA e o estado das integrações.</p>
        <p><CheckCircle2 /> Confira MFA, criptografia, auditoria e recuperação.</p>
        <p><CheckCircle2 /> Valide o backup e a possibilidade de restauração.</p>
        <p><CheckCircle2 /> Analise chamados, alertas e pedidos de privacidade.</p>
      </div>
      <p className="control-manual-muted">Para operar CRM, agenda, clientes, serviços e financeiro da empresa, abra o <Link href="https://famasystem.online" target="_blank">Fama System</Link>.</p>
    </section>
  </div>;
}
