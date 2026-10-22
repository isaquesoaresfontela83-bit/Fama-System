import { assistantSources, normalizeCommand } from './fama-ai-settings';
const patterns = [
    ['agenda', /\b(agenda|agendamentos?|agendar|compromissos?|visitas?|horarios?|amanha|hoje)\b/],
    ['quotes', /\b(orcamentos?|propostas?)\b/],
    ['finance', /\b(financeiro|receitas?|despesas?|pagamentos?|receber|pagar|saldo|caixa|cobrancas?|vencimentos?)\b/],
    ['contracts', /\b(contratos?|mensalidades?|renovacoes?)\b/],
    ['inventory', /\b(estoque|produtos?|reposicao|repor|minimo|materiais?)\b/],
    ['crm', /\b(crm|leads?|vendas?|funil|negociacoes?|contatos? comerciais)\b/],
    ['orders', /\b(ordens?|servicos?|os)\b/],
    ['customers', /\b(clientes?|piscinas?)\b/], ['team', /\b(equipe|tecnicos?|profissionais?)\b/],
    ['warranties', /\b(garantias?)\b/], ['companies', /\b(empresas?)\b/], ['users', /\b(usuarios?|permissoes|acessos?)\b/],
    ['audit', /\b(auditoria|eventos?)\b/], ['backup', /\b(backups?)\b/], ['privacy', /\b(privacidade|lgpd)\b/],
];
export function planNativeQuery(message, selected, previous) {
    const query = normalizeCommand(message);
    const explicit = patterns.filter(([, pattern]) => pattern.test(query)).map(([source]) => source);
    const followup = /^(e\b|agora\b|somente\b|apenas\b|tambem\b)/.test(query);
    const sources = explicit.length ? explicit : [selected !== 'overview' ? selected : followup && previous ? previous : 'overview'];
    const single = /\b(cliente 360|historico do cliente|visao do cliente|planejar|planejamento|organizar|criar|cadastrar|preparar|agendar|mensagem|cronograma|plano de acao|checklist)\b/.test(query);
    const question = /\b(o que fazer primeiro|por onde comecar|o que precisa de atencao|como esta minha empresa|diagnostico da empresa)\b/.test(query) ? 'Plano de ação da empresa' : message;
    const explicitAgenda = /\b(agenda|agendamentos?|agendar|compromissos?|visitas?|horarios?)\b/.test(query);
    return { question, sources: sources.length > 1 && !explicitAgenda ? sources.filter(source => source !== 'agenda') : sources, single: single || !/\be\b|relacione|cruze|todos os modulos/.test(query) };
}
const guides = {
    agenda: { title: 'Organizar um atendimento', steps: ['Prepare o agendamento com cliente, data, horário e tipo de visita.', 'Escolha um técnico e informe a duração e o endereço.', 'Consulte conflitos e revise o formulário antes de salvar.'] },
    quotes: { title: 'Montar um orçamento', steps: ['Escolha o cliente e os itens do catálogo da própria empresa.', 'Informe mão de obra, deslocamento, desconto e urgência. Normal: 0%; urgente: 10%; emergência: 20%.', 'Confira o total, a validade e as condições. Salve e confira o PDF antes de enviar.'] },
    finance: { title: 'Conferir o financeiro', steps: ['Separe receitas e despesas e defina o vencimento e a categoria.', 'Consulte valores pagos, em aberto e em atraso separadamente.', 'Compare com o extrato e confirme cada registro antes de conciliar ou marcar um pagamento.'] },
    contracts: { title: 'Preparar um contrato', steps: ['Informe cliente, objeto, período e frequência do serviço.', 'Defina a mensalidade e o dia de pagamento.', 'Revise escopo, condições e cláusulas no formulário antes de salvar.'] },
    crm: { title: 'Acompanhar uma oportunidade', steps: ['Cadastre nome, telefone e interesse do contato.', 'Atualize a etapa conforme o atendimento real e registre a próxima ação.', 'Prepare a proposta e acompanhe o retorno antes de marcar ganho ou perdido.'] },
    inventory: { title: 'Controlar o estoque', steps: ['Confira quantidade, unidade e mínimo de cada produto.', 'Consulte os itens no mínimo ou abaixo dele.', 'Registre entradas e saídas conforme a movimentação real e confira os saldos.'] },
    customers: { title: 'Consultar o histórico do cliente', steps: ['Localize o cadastro pelo nome.', 'Use Cliente 360 para reunir agenda, propostas, serviços, contratos e garantias disponíveis.', 'Confira nomes duplicados e revise o cadastro antes de atribuir registros a um cliente.'] },
    companies: { title: 'Gerenciar o acesso de uma empresa', steps: ['Abra Empresas e selecione o cadastro ou prepare uma nova empresa.', 'Confira os usuários, o plano e a situação de acesso.', 'Revise a concessão gratuita, o prazo ou o bloqueio no formulário antes de confirmar.'] },
    users: { title: 'Organizar permissões', steps: ['Escolha a empresa e o usuário correto.', 'Libere apenas os módulos necessários para a função.', 'Confira a alteração e o histórico de auditoria depois de salvar.'] },
};
export function nativeGuide(message, source, settings) {
    const query = normalizeCommand(message);
    if (/^(oi|ola|bom dia|boa tarde|boa noite|obrigad[oa])\b/.test(query) && query.split(/\s+/).length < 6 && settings.sources.overview)
        return {
            source: 'overview', engine: 'internal', title: 'Como posso ajudar hoje?', actions: [],
            text: 'Posso consultar os módulos autorizados, organizar prioridades e preparar cadastros para revisão. Você também pode ditar uma pergunta pelo microfone.',
            suggestions: [{ label: 'Prioridades', question: 'Plano de ação da empresa', source: 'overview' }, { label: 'Como usar', question: 'O que você faz?', source: 'overview' }],
        };
    if (!/\b(como|me ensine|passo a passo|me explique)\b/.test(query) || /\b(como esta|como estao|como ficou)\b/.test(query))
        return null;
    if (!settings.sources[source] || !guides[source])
        return null;
    const guide = guides[source];
    return { source, engine: 'internal', title: guide.title, narrative: 'Siga estas etapas usando os formulários do sistema.',
        text: [guide.title, ...guide.steps.map((step, i) => `${i + 1}. ${step}`)].join('\n'),
        steps: guide.steps.map((description, i) => ({ id: `guide-${source}-${i}`, title: `Etapa ${i + 1}`, description, priority: 'normal', source })),
        actions: settings.allowNavigation ? [{ label: `Abrir ${assistantSources[source]}`, section: source }] : [],
    };
}
