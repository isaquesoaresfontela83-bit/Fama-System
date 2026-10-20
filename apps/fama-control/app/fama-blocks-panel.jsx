'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { famaBlocks, parseBlockRules, resolveBlockAccess } from '@/lib/fama-blocks';
import { requestJson } from '@/lib/client-request';
import { minimumPlanForFeature, normalizePlanTier, planIncludesFeature, planNames } from '@/lib/plan-features';
export function FamaBlocksPanel({ companies, members, available }) {
    const [scope, setScope] = useState('global');
    const [companyId, setCompanyId] = useState('');
    const [memberId, setMemberId] = useState('');
    const [search, setSearch] = useState('');
    const [rules, setRules] = useState(null);
    const [confirmedKey, setConfirmedKey] = useState('');
    const [draft, setDraft] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const generation = useRef(0);
    const pending = useRef(false);
    const companiesHere = companies.filter(company => company.status !== 'deleted');
    const membersHere = members.filter(member => member.organizationId === companyId);
    const company = companiesHere.find(item => item.id === companyId);
    const member = membersHere.find(item => item.id === memberId);
    const selectedPlan = scope === 'global' ? undefined : company?.plan ?? 'inicial';
    const ready = available && (scope === 'global' || Boolean(company && (scope === 'organization' || member)));
    const targetKey = `${scope}:${scope === 'global' ? '' : companyId}:${scope === 'member' ? memberId : ''}`;
    useEffect(() => {
        const current = ++generation.current;
        const abort = new AbortController();
        setRules(null);
        setDraft({});
        setError('');
        if (!ready) {
            setLoading(false);
            return () => abort.abort();
        }
        setLoading(true);
        const params = new URLSearchParams({ scope, organizationId: scope === 'global' ? '' : companyId, memberId: scope === 'member' ? memberId : '' });
        void requestJson(`/api/admin/blocks?${params}`, { signal: abort.signal, cache: 'no-store' }, 15_000).then(payload => {
            if (current !== generation.current || abort.signal.aborted)
                return;
            const loaded = parseBlockRules(payload.rules);
            setRules(loaded);
            setDraft(loaded[scope].overrides);
            setConfirmedKey(targetKey);
        }).catch(cause => { if (current === generation.current && !abort.signal.aborted)
            setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os blocos.'); })
            .finally(() => { if (current === generation.current && !abort.signal.aborted)
            setLoading(false); });
        return () => { abort.abort(); generation.current++; };
    }, [targetKey, ready, reload]);
    const preview = useMemo(() => rules ? resolveBlockAccess(scope === 'member' ? member?.role ?? 'member' : 'owner', scope === 'member' ? member?.permissions : undefined, { ...rules, [scope]: { ...rules[scope], overrides: draft } }, selectedPlan) : [], [rules, draft, scope, member, selectedPlan]);
    const dirty = Boolean(rules && JSON.stringify(Object.entries(draft).sort()) !== JSON.stringify(Object.entries(rules[scope].overrides).sort()));
    const visible = famaBlocks.filter(block => `${block.label} ${block.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
    function change(id, value) {
        if (value === 'add' && selectedPlan !== undefined && !planIncludesFeature(selectedPlan, id))
            return;
        setDraft(previous => { const next = { ...previous }; if (value === 'inherit')
            delete next[id];
        else
            next[id] = value === 'add'; return next; });
    }
    async function save() {
        if (!rules || !ready || confirmedKey !== targetKey || !dirty || pending.current)
            return;
        pending.current = true;
        setSaving(true);
        const current = generation.current;
        try {
            const response = await requestJson('/api/admin/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, organizationId: scope === 'global' ? '' : companyId, memberId: scope === 'member' ? memberId : '', revision: rules[scope].revision, overrides: draft }) }, 20_000);
            if (current !== generation.current)
                return;
            if (!response.verified)
                throw new Error('A gravação dos blocos não foi confirmada.');
            const saved = parseBlockRules(response.rules);
            setRules(saved);
            setDraft(saved[scope].overrides);
            toast.success('Blocos salvos. O Fama System aplicará os novos acessos automaticamente.');
        }
        catch (cause) {
            if (current === generation.current) {
                setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
                setRules(null);
            }
        }
        finally {
            pending.current = false;
            setSaving(false);
        }
    }
    return <section className="control-panel fama-blocks-panel">
    <div className="control-panel-heading"><div><p className="control-kicker">FAMA SYSTEM</p><h2>Blocos do sistema</h2></div><Badge variant="secondary">{famaBlocks.length} blocos disponíveis</Badge></div>
    <p className="control-muted">O plano da empresa define os recursos disponíveis. Dentro desse plano, a regra da pessoa prevalece sobre a empresa; a da empresa prevalece sobre a geral. Para liberar recursos de outro plano, altere o plano de recursos da empresa. A cobrança pode continuar desativada nas cortesias.</p>
    {selectedPlan !== undefined && company && <p className="control-muted">Plano de {company.name}: <strong>{planNames[normalizePlanTier(selectedPlan)]}</strong></p>}
    <div className="fama-block-targets">
      <label>Aplicar para<NativeSelect value={scope} disabled={saving} onChange={event => { setScope(event.target.value); setError(''); }}><NativeSelectOption value="global">Todos</NativeSelectOption><NativeSelectOption value="organization">Uma empresa</NativeSelectOption><NativeSelectOption value="member">Uma pessoa</NativeSelectOption></NativeSelect></label>
      {scope !== 'global' && <label>Empresa<NativeSelect value={companyId} disabled={saving || !available} onChange={event => { setCompanyId(event.target.value); setMemberId(''); }}><NativeSelectOption value="">Escolha a empresa</NativeSelectOption>{companiesHere.map(item => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></label>}
      {scope === 'member' && <label>Pessoa<NativeSelect value={memberId} disabled={saving || !companyId || !available} onChange={event => setMemberId(event.target.value)}><NativeSelectOption value="">Escolha a pessoa</NativeSelectOption>{membersHere.map(item => <NativeSelectOption key={item.id} value={item.id}>{item.displayName || item.email} · {item.email}{item.role === 'owner' ? ' · Proprietário' : ''}{item.status !== 'active' ? ' · Inativo ou convidado' : ''}</NativeSelectOption>)}</NativeSelect></label>}
    </div>
    {!available && <p role="alert" className="control-empty">A lista de empresas e pessoas está indisponível. Recarregue o Fama Control para conferir os destinos.</p>}
    {available && !ready && <p className="control-empty">Escolha {scope === 'member' ? 'a empresa e a pessoa' : 'a empresa'} para configurar seus blocos.</p>}
    {loading && <p role="status" className="control-empty">Conferindo os blocos…</p>}
    {error && <div role="alert" className="fama-block-error"><p>{error}</p><Button variant="outline" disabled={saving} onClick={() => setReload(value => value + 1)}>Recarregar regras</Button></div>}
    {rules && ready && confirmedKey === targetKey && !loading && <>
      <div className="fama-block-toolbar"><label>Buscar bloco<input value={search} onChange={event => setSearch(event.target.value)} placeholder="CRM, financeiro, IA…"/></label><div className="control-row-actions"><Button variant="outline" disabled={saving} onClick={() => setDraft(Object.fromEntries(famaBlocks.filter(block => selectedPlan === undefined || planIncludesFeature(selectedPlan, block.id)).map(block => [block.id, true])))}>Adicionar todos</Button><Button variant="outline" disabled={saving} onClick={() => setDraft(Object.fromEntries(famaBlocks.map(block => [block.id, false])))}>Remover todos</Button><Button variant="ghost" disabled={saving} onClick={() => setDraft({})}>{scope === 'global' ? 'Seguir os perfis' : 'Herdar regras'}</Button></div></div>
      <div className="fama-block-summary"><strong>{preview.length} de {famaBlocks.length} blocos disponíveis {scope === 'global' ? 'na regra geral' : scope === 'organization' ? `para ${company?.name}` : `para ${member?.displayName || member?.email}`}</strong><small>{scope !== 'member' ? 'A seleção individual pode definir exceções para cada pessoa.' : 'A prévia já considera o perfil e todas as regras.'}</small></div>
      <div className="fama-block-grid">{visible.map(block => <article className="fama-block-card" key={block.id}><div><small>{block.group}</small><h3>{block.label}</h3><p>{block.description}</p></div><label>Regra para {scope === 'global' ? 'todos' : scope === 'organization' ? 'a empresa' : 'esta pessoa'}<NativeSelect aria-label={`Regra de ${block.label}`} disabled={saving} value={draft[block.id] === undefined ? 'inherit' : draft[block.id] ? 'add' : 'remove'} onChange={event => change(block.id, event.target.value)}><NativeSelectOption value="inherit">{scope === 'global' ? 'Seguir o perfil' : 'Herdar'}</NativeSelectOption><NativeSelectOption value="add" disabled={selectedPlan !== undefined && !planIncludesFeature(selectedPlan, block.id)}>Adicionar</NativeSelectOption><NativeSelectOption value="remove">Remover</NativeSelectOption></NativeSelect></label><Badge variant="secondary">{selectedPlan !== undefined && !planIncludesFeature(selectedPlan, block.id) ? `A partir do ${planNames[minimumPlanForFeature(block.id)]}` : preview.includes(block.id) ? 'Disponível' : 'Removido'}</Badge></article>)}</div>
      {!visible.length && <p className="control-empty">Nenhum bloco encontrado.</p>}
      <div className="fama-block-save"><p>{dirty ? 'Alterações aguardando sua aplicação.' : 'Regras conferidas e salvas.'} {Object.keys(draft).length ? `${Object.keys(draft).length} regras específicas.` : 'Sem exceções neste destino.'}</p><Button disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Aplicar blocos'}</Button></div>
    </>}
  </section>;
}
