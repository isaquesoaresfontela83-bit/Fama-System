import { requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = [
  ["Visão geral", "Resumo da operação, compromissos do dia, ordens abertas, indicadores financeiros, funil comercial e alertas de estoque."],
  ["CRM", "Cadastro e acompanhamento de leads. Mova cada oportunidade entre Novo, Em contato, Visita técnica, Proposta e Fechado."],
  ["Orçamentos", "Crie propostas com materiais, mão de obra, desconto, validade e observações. Atualize o status e gere o PDF para envio ao cliente."],
  ["Agenda", "Cadastre visitas, manutenções e compromissos, informe cliente, data/hora, endereço, técnico, tipo e observações."],
  ["Ordens de serviço", "Controle execução em campo, técnico responsável, valor, status e dados de análise da água, como pH, cloro e alcalinidade."],
  ["Garantias", "Registre itens/serviços cobertos, origem, datas e responsável. Ao agendar uma garantia, o sistema também cria o compromisso correspondente na agenda."],
  ["Clientes e piscinas", "Mantenha nome, telefone, e-mail, endereço, tipo e volume da piscina, plano contratado, status e observações."],
  ["Contratos", "Cadastre cliente, documento, endereço, serviço, vigência, frequência, mensalidade, dia de pagamento, termos e gere o PDF do contrato."],
  ["Estoque", "Cadastre produtos, SKU, unidade, quantidade mínima, custo e ajuste o saldo sempre que houver entrada ou consumo."],
  ["Financeiro", "Registre receitas e despesas, categorias, valores, vencimentos e status. A visão geral consolida recebidos e valores a receber."],
  ["Equipe", "Cadastre os membros operacionais, função, telefone e status para uso em agendas, ordens e garantias."],
  ["Usuários e empresas", "Disponível para proprietário/administrador. Adicione usuários por e-mail, defina perfil e gerencie empresas separadas."],
] as const;

const statusRows = [
  ["CRM", "Novo → Em contato → Visita técnica → Proposta → Fechado"],
  ["Orçamento", "Rascunho → Enviado → Aprovado ou Recusado"],
  ["Agenda", "Agendado → Em rota → Concluído"],
  ["Ordem de serviço", "Aberta → Em execução → Concluída"],
  ["Garantia", "Ativa → Atendimento agendado → Concluída ou Expirada"],
  ["Contrato", "Rascunho → Ativo → Suspenso ou Encerrado"],
  ["Financeiro", "Pendente → Pago ou Atrasado"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#234264] dark:bg-[#0b2342] sm:p-7">
      <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700 dark:text-[#c4d5e7]">{children}</div>
    </section>
  );
}

export default async function ManualPage() {
  const user = await requireChatGPTUser("/manual");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#061329] dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#234264] dark:bg-[#0b2342] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black tracking-[.16em] text-sky-600 dark:text-[#74def5]">FAMA SYSTEM</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Manual completo de uso</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-[#b8cadb]">
                Guia operacional do Fama System para uso diário, cadastro, acompanhamento, segurança e solução de problemas.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-[#87a1ba]">Sessão: {user.email}</p>
            </div>
            <a href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-extrabold hover:bg-slate-100 dark:border-[#355f8b] dark:hover:bg-[#12335d]">← Voltar ao sistema</a>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <nav className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#234264] dark:bg-[#0b2342]">
              <strong className="text-sm">Índice</strong>
              <div className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-[#b8cadb]">
                {[
                  ["inicio", "1. Primeiros passos"],
                  ["empresa", "2. Empresa e navegação"],
                  ["modulos", "3. Módulos"],
                  ["status", "4. Fluxos e status"],
                  ["rotina", "5. Rotina recomendada"],
                  ["usuarios", "6. Usuários e perfis"],
                  ["pesquisa", "7. Busca e registros"],
                  ["seguranca", "8. Segurança e dados"],
                  ["problemas", "9. Solução de problemas"],
                  ["boas-praticas", "10. Boas práticas"],
                ].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-lg px-2 py-1.5 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-[#12335d] dark:hover:text-white">{label}</a>)}
              </div>
            </nav>
          </aside>

          <div className="space-y-5">
            <Section id="inicio" title="1. Primeiros passos">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Acesse o Fama System e entre com o e-mail e a senha cadastrados.</li>
                <li>No primeiro acesso, crie o perfil da empresa quando a tela de configuração inicial aparecer.</li>
                <li>Após entrar, confira no seletor superior se a empresa correta está ativa antes de cadastrar ou alterar qualquer informação.</li>
                <li>Use o botão principal do canto superior direito de cada módulo para criar novos registros.</li>
                <li>Use “Sair” ao finalizar o uso, principalmente em computador compartilhado.</li>
              </ol>
              <p><strong>Importante:</strong> cada empresa possui registros separados. Sempre confirme a empresa ativa antes de trabalhar.</p>
            </Section>

            <Section id="empresa" title="2. Empresa, menu e navegação">
              <p>O menu lateral organiza o sistema em <strong>Operação</strong> e <strong>Gestão</strong>. Em telas pequenas, use o botão de menu no topo para abrir ou recolher a barra lateral.</p>
              <p>O seletor de empresa no topo troca todo o contexto operacional. Ao trocar de empresa, o sistema recarrega os dados daquela empresa e retorna à Visão geral.</p>
              <p>A busca superior procura dentro do módulo atual. Digite nome de cliente, número, telefone, status, serviço ou outro conteúdo registrado para filtrar os itens exibidos.</p>
              <p>O botão de tema alterna entre visual claro e escuro sem alterar os dados.</p>
            </Section>

            <Section id="modulos" title="3. Como usar cada módulo">
              <div className="grid gap-3 md:grid-cols-2">
                {modules.map(([name, description]) => (
                  <article key={name} className="rounded-2xl border border-slate-200 p-4 dark:border-[#315b86] dark:bg-[#0a1d36]">
                    <h3 className="font-black text-slate-950 dark:text-white">{name}</h3>
                    <p className="mt-1">{description}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-[#286390] dark:bg-[#0a2b4c]">
                <strong>PDFs:</strong> em Orçamentos e Contratos, abra o registro e use a ação de geração de PDF quando precisar enviar ou arquivar o documento.
              </div>
            </Section>

            <Section id="status" title="4. Fluxos e status">
              <p>Atualize o status sempre que o trabalho avançar. Isso mantém os indicadores e a operação coerentes.</p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#315b86]">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-[#0e3159]"><tr><th className="p-3">Área</th><th className="p-3">Fluxo sugerido</th></tr></thead>
                  <tbody>{statusRows.map(([area, flow]) => <tr key={area} className="border-t border-slate-200 dark:border-[#315b86]"><td className="p-3 font-bold">{area}</td><td className="p-3">{flow}</td></tr>)}</tbody>
                </table>
              </div>
            </Section>

            <Section id="rotina" title="5. Rotina recomendada de uso">
              <ol className="list-decimal space-y-2 pl-5">
                <li><strong>Início do dia:</strong> abra Visão geral e Agenda; confira visitas, ordens abertas e pendências.</li>
                <li><strong>Novos contatos:</strong> cadastre primeiro no CRM e registre o próximo passo.</li>
                <li><strong>Visita técnica:</strong> agende na Agenda e informe endereço/técnico.</li>
                <li><strong>Proposta:</strong> monte o orçamento, gere o PDF e altere para Enviado.</li>
                <li><strong>Venda aprovada:</strong> atualize o CRM para Fechado e organize contrato/ordem quando aplicável.</li>
                <li><strong>Execução:</strong> abra a ordem de serviço e mantenha técnico, status e observações atualizados.</li>
                <li><strong>Pós-venda:</strong> registre garantia quando houver cobertura.</li>
                <li><strong>Financeiro:</strong> registre receita/despesa e marque como Pago quando liquidado.</li>
                <li><strong>Fim do dia:</strong> confira pendências, estoque mínimo e compromissos do dia seguinte.</li>
              </ol>
            </Section>

            <Section id="usuarios" title="6. Usuários, empresas e perfis">
              <p>Proprietários e administradores podem abrir <strong>Usuários e empresas</strong> para adicionar pessoas à empresa pelo e-mail usado no acesso.</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Proprietário:</strong> responsável principal, com maior nível de gestão da empresa.</li>
                <li><strong>Administrador:</strong> pode gerenciar usuários e realizar ações administrativas permitidas.</li>
                <li><strong>Colaborador:</strong> acesso operacional padrão.</li>
                <li><strong>Técnico:</strong> perfil voltado à execução operacional.</li>
              </ul>
              <p>Ao remover um usuário, o vínculo com a empresa é retirado. Não compartilhe uma única conta entre várias pessoas: cada usuário deve utilizar o próprio acesso.</p>
            </Section>

            <Section id="pesquisa" title="7. Busca, edição e exclusão">
              <p>A busca no topo filtra o módulo atual. Abra um item para ver detalhes e utilizar as ações disponíveis.</p>
              <p>Alterações de status e saldo são gravadas diretamente na empresa ativa. Registros excluídos deixam de aparecer no módulo; por isso, confirme cliente, número e empresa antes de excluir.</p>
              <p>A exclusão de registros operacionais é restrita a perfis administrativos previstos pelo sistema. Se um botão não aparecer, isso pode ser consequência do seu perfil.</p>
            </Section>

            <Section id="seguranca" title="8. Segurança, sessão e separação de dados">
              <ul className="list-disc space-y-2 pl-5">
                <li>O login usa e-mail e senha e cria uma sessão protegida no navegador.</li>
                <li>Os registros operacionais são vinculados à empresa selecionada.</li>
                <li>As rotas do backend validam se o usuário possui vínculo ativo com a empresa informada.</li>
                <li>Não envie senha por WhatsApp, e-mail ou mensagens em grupo.</li>
                <li>Em dispositivo de terceiros, sempre use Sair ao terminar.</li>
                <li>Se suspeitar de acesso indevido, altere a senha e revise os usuários autorizados.</li>
              </ul>
            </Section>

            <Section id="problemas" title="9. Solução de problemas">
              <div className="space-y-3">
                <p><strong>“Banco de dados indisponível”:</strong> normalmente indica falha temporária de binding/conexão do ambiente. Atualize a página; se persistir, acione o responsável técnico.</p>
                <p><strong>Não consigo entrar:</strong> confirme e-mail, senha e conexão. Se a senha foi alterada, encerre a sessão antiga e tente novamente.</p>
                <p><strong>Não aparece minha empresa:</strong> confirme se seu e-mail foi adicionado à empresa e se o vínculo está ativo.</p>
                <p><strong>Não consigo excluir:</strong> exclusões exigem perfil autorizado.</p>
                <p><strong>Dados não aparecem após trocar de empresa:</strong> aguarde o carregamento e confira novamente o seletor de empresa.</p>
                <p><strong>PDF não abriu:</strong> permita downloads/pop-ups do site e tente gerar novamente.</p>
              </div>
            </Section>

            <Section id="boas-praticas" title="10. Boas práticas para manter o sistema confiável">
              <ul className="list-disc space-y-2 pl-5">
                <li>Cadastre o cliente uma única vez e padronize nomes/telefones.</li>
                <li>Não deixe leads sem próximo passo nem ordens sem status.</li>
                <li>Atualize estoque após uso ou entrada de produtos.</li>
                <li>Registre pagamentos no mesmo dia em que forem confirmados.</li>
                <li>Use observações para informações importantes que outra pessoa da equipe precisa conhecer.</li>
                <li>Revise usuários periodicamente e remova acessos de pessoas que não trabalham mais na operação.</li>
                <li>Antes de ações destrutivas, confirme empresa, cliente e número do registro.</li>
              </ul>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-[#2d7756] dark:bg-[#0f3328] dark:text-[#b7f5d5]">
                Fluxo recomendado: <strong>CRM → Agenda → Orçamento → Ordem/Contrato → Financeiro → Garantia</strong>, adaptando conforme o tipo de serviço.
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
