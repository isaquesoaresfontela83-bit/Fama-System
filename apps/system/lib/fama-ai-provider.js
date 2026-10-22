import { answerInternal } from './fama-ai';
import { assistantSources, normalizeCommand } from './fama-ai-settings';
import { planNativeQuery, nativeGuide } from './fama-ai-native';
import { assistantGuidance, contextualQuestion } from './assistant-guidance';
import { nativeCalculation } from './fama-ai-calculator';
export { assistantProviderStatus } from './fama-ai-connection';
/** Fama's own read-only query planner. No model service or outgoing fetch. */
export function answerNative(input, data, settings, now) {
    let previousSource;
    let customerName = input.customerName;
    for (const question of input.history) {
        const previous = answerInternal(question, data, input.source, now, settings, { previousSource, customerName });
        previousSource = previous.source;
        customerName = previous.customerName ?? customerName;
    }
    const query = contextualQuestion(input.question, input.history);
    const plan = planNativeQuery(query, input.source, previousSource);
    const context = { previousSource, customerName };
    const custom = settings.commands.some(command => command.enabled && normalizeCommand(command.trigger) === normalizeCommand(input.question));
    const calculation = !custom && settings.enabled && settings.sources.overview ? nativeCalculation(input.question) : null;
    if (calculation)
        return calculation;
    const guide = !custom && settings.enabled ? (assistantGuidance(input.question, plan.sources[0], settings) ?? nativeGuide(input.question, plan.sources[0], settings)) : null;
    if (guide)
        return guide;
    if (custom || plan.sources.length < 2 || plan.single) {
        const answer = answerInternal(plan.question, data, input.source, now, settings, context);
        return { ...answer, engine: 'internal' };
    }
    const sections = plan.sources.slice(0, 5).map(source => answerInternal(query, data, source, now, settings, { ...context, forceSource: source }));
    const actions = sections.flatMap(answer => answer.actions).filter((action, index, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(action)) === index).slice(0, 10);
    return {
        source: settings.sources.overview ? 'overview' : sections[0].source,
        engine: 'internal', title: 'Análise entre os módulos',
        narrative: `Consultei ${sections.map(answer => assistantSources[answer.source]).join(', ')} na área atual.`,
        text: sections.map(answer => answer.text).join('\n\n'), sections, actions,
        note: 'Cada bloco usa os registros do seu módulo. Valores de propostas e contratos não confirmam recebimentos.',
    };
}
