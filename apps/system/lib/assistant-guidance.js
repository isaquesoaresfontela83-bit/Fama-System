import { findHelp, normalizeHelp } from './internal-help';
import { assistantSources } from './fama-ai-settings';
export function assistantGuidance(question, selected, settings) {
    const query = normalizeHelp(question);
    if (!/\b(como|onde|me ensine|passo a passo|me explique|ajuda para)\b/.test(query) || /\b(como esta|como estao|como ficou)\b/.test(query))
        return null;
    const topic = findHelp(question, selected);
    if (!topic)
        return null;
    const source = Object.hasOwn(assistantSources, topic.section) ? topic.section : 'overview';
    if (!settings.sources[source])
        return null;
    const steps = topic.steps.map((description, index) => ({ id: `help-${topic.id}-${index}`, title: `Etapa ${index + 1}`, description, priority: 'normal', source }));
    return { source, engine: 'internal', title: topic.title, narrative: 'Orientações do manual interno do Fama System.', text: [topic.title, ...topic.steps.map((step, index) => `${index + 1}. ${step}`), topic.note].filter(Boolean).join('\n'), steps, note: topic.note, actions: settings.allowNavigation ? [{ label: 'Abrir área relacionada', section: topic.section }] : [], suggestions: [{ label: 'Ver prioridades', question: 'Plano de ação da empresa', source: 'overview' }].filter(s => settings.sources[s.source]) };
}
/** Carry only a read-only query's date range into a short refinement. New dates and modules win. */
export function contextualQuestion(question, history) {
    const current = normalizeHelp(question);
    if (!/^(e |somente |apenas |so |agora )/.test(current) || /\b(hoje|amanha|ontem|semana|mes|dias|\d{2} \d{2} \d{4})\b/.test(current))
        return question;
    const prior = history.at(-1) || '', old = normalizeHelp(prior);
    if (/\b(criar|cadastrar|agendar|preparar|calcule|como|onde|mensagem)\b/.test(old))
        return question;
    const topic = /\b(financeiro|agenda|orcamento|estoque|contrato|garantia|cliente|crm|equipe|servico)\b/g;
    const oldTopics = [...old.matchAll(topic)].map(m => m[0]), newTopics = [...current.matchAll(topic)].map(m => m[0]);
    if (newTopics.length && newTopics.some(t => !oldTopics.includes(t)))
        return question;
    const period = prior.match(/\b\d{2}\/\d{2}\/\d{4}(?:\s*(?:a|até|ate)\s*\d{2}\/\d{2}\/\d{4})?\b|\b(?:hoje|amanhã|amanha|ontem|(?:(?:esta|nesta|desta|próxima|proxima)\s+)?(?:semana|mês|mes)|(?:últimos|ultimos|próximos|proximos)\s+\d+\s+dias)\b/ig)?.join(' ');
    return period ? `${question} ${period}`.slice(0, 2000) : question;
}
