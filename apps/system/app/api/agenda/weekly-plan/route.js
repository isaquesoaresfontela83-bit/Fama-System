import { requireTenant, RequestError, tenantError } from '@/lib/tenant';
import { hasFeaturePermission } from '@/lib/permissions';
import { readJsonObject } from '@/lib/request-body';
import { assertRateLimit } from '@/lib/security';
import { validateWeeklyRules, proposeWeek } from '@/lib/weekly-planner';
import { GET as bootstrap } from '../../bootstrap/route';
import { GET as weather } from '../../operation-weather/route';
import { enrichWithCloudflare } from '@/lib/fama-ai-cloudflare';
import { readPublicAssistantSettings } from '@/lib/fama-ai-settings-reader';
import { planIncludesFeature } from '@/lib/plan-features';
export async function POST(request) {
    try {
        const { user, organization } = await requireTenant(request);
        if (!hasFeaturePermission(organization.role, organization.permissions, 'agenda', organization.moduleAccess))
            throw new RequestError('Seu perfil não tem acesso à agenda.', 403);
        await assertRateLimit(request, 'agenda_weekly_plan', user.id, 6, 60);
        const raw = await readJsonObject(request, 80000);
        let rules;
        try {
            rules = validateWeeklyRules(raw);
        }
        catch (e) {
            throw new RequestError(e.message, 400);
        }
        const snapshot = await bootstrap(request);
        if (!snapshot.ok)
            return snapshot;
        const data = await snapshot.json();
        if (rules.jobs.some(j => !data.appointments.some(a => a.id === j.id)))
            throw new RequestError('Um atendimento não está disponível nesta empresa. Atualize a agenda.', 409);
        if (rules.jobs.some(j => { const a = data.appointments.find(a => a.id === j.id); return !data.employees.some(e => e.active && e.name === a?.technician); }))
            throw new RequestError('Os atendimentos selecionados precisam de um técnico ativo.', 409);
        let forecast = null;
        try {
            const url = new URL('/api/operation-weather?forecast=1', request.url);
            if (rules.weatherPoint) {
                url.searchParams.set('lat', String(rules.weatherPoint.latitude));
                url.searchParams.set('lon', String(rules.weatherPoint.longitude));
            }
            const response = await weather(new Request(url, { headers: request.headers, signal: request.signal }));
            if (response.ok)
                forecast = (await response.json()).forecast ?? null;
        }
        catch { }
        if (rules.googleBusy && !data.employees.some(e => e.active && e.name === rules.googleBusy?.technician))
            throw new RequestError('Selecione um técnico ativo para a disponibilidade Google.', 400);
        const proposal = proposeWeek(data.appointments, rules, forecast);
        const facts = `Proposta para ${rules.week}: ${proposal.suggestions.length} serviços encaixados, ${proposal.unplaced.length} sem encaixe. ${proposal.warnings.join(' ')} Nenhum compromisso foi alterado. As sugestões respeitam jornada, pausa, técnico, duração, estimativa de deslocamento e janela informada do cliente. Não acrescente novos horários nem afirme que há precisão de trânsito ou clima no endereço do cliente.`;
        let narrative = '', engine = 'rules', aiEnabled = false;
        try {
            const config = await readPublicAssistantSettings();
            aiEnabled = !!config.settings.enabled && !!config.settings.sources.agenda;
        }
        catch { }
        if (aiEnabled && planIncludesFeature(organization.plan, 'assistant')) {
            const answer = await enrichWithCloudflare({ question: 'Explique esta proposta de planejamento semanal e suas limitações em um parágrafo. Não execute ações.', source: 'agenda', history: [], timeZone: 'America/Sao_Paulo' }, { text: facts, source: 'agenda', actions: [], engine: 'internal' }, request.signal);
            if (answer.cloudNarrative) {
                narrative = answer.cloudNarrative;
                engine = 'cloudflare';
            }
        }
        return Response.json({ ...proposal, narrative, engine, weatherReference: forecast?.city ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (error) {
        return tenantError(error, 'Não foi possível montar a proposta semanal.');
    }
}
