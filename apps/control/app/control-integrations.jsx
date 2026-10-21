'use client';
import { useEffect, useState } from 'react';
import { GitBranch, Link2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { defaultFamaRepository } from '@/lib/integration-catalog';
import { requestJson } from '@/lib/client-request';
import { ControlBaileys } from './control-baileys';
import { ControlIntegrationManager } from './control-integration-manager';

export function ControlIntegrations() {
    const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(''), [repository, setRepository] = useState(defaultFamaRepository), [ip, setIp] = useState('');
    const [github, setGithub] = useState(null), [network, setNetwork] = useState(null);
    useEffect(() => {
        const controller = new AbortController();
        setError(''); setData(null);
        requestJson('/api/admin/integrations', { cache: 'no-store', signal: controller.signal })
            .then(value => { if (!controller.signal.aborted) { setData(value); if (value.repository) setRepository(value.repository); } })
            .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
        return () => controller.abort();
    }, [revision]);
    async function consult(event, provider) {
        event.preventDefault(); if (busy) return;
        setBusy(provider); setError('');
        if (provider === 'github') setGithub(null); else setNetwork(null);
        try {
            const result = await requestJson('/api/admin/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, ...(provider === 'github' ? { repository } : { ip }) }) }, 45000);
            if (provider === 'github') setGithub(result); else setNetwork(result);
        } catch (cause) { setError(cause.message); }
        finally { setBusy(''); }
    }
    const state = id => data?.providers.find(item => item.id === id);
    return <section className="control-panel control-integrations">
        <div className="control-panel-heading"><div><p className="control-kicker">CONEXÕES DA PLATAFORMA</p><h2><Link2 />Integrações</h2></div><Button variant="outline" disabled={!data && !error} onClick={() => setRevision(value => value + 1)}><RefreshCw />Conferir novamente</Button></div>
        <p className="control-muted">A central reúne as configurações, os testes, os documentos e as consultas da plataforma.</p>
        <ControlBaileys/>
        <ControlIntegrationManager legacyProviders={data?.providers} onChanged={() => setRevision(value => value + 1)}/>
        {!data && !error && <p role="status">Conferindo integrações e versões…</p>}
        {error && <p className="control-error" role="alert">{error}</p>}
        {data && <>
            <div className={`companion-release ${data.release.synchronized ? 'synchronized' : ''}`} role="status"><ShieldCheck /><div><strong>{data.release.synchronized ? 'System e Control na mesma atualização' : 'Conferir sincronização dos sistemas'}</strong><p>Control {data.release.control.version} · System {data.release.system?.version || 'sem resposta'}</p><small>{data.release.synchronized ? `Lançamento ${data.release.control.releaseId}` : 'A publicação conjunta só é concluída quando os dois lançamentos coincidem.'}</small></div></div>
            {data.backendMessage && <p role="alert" className="control-error">{data.backendMessage}</p>}
            <div className="control-integration-queries">
                <form onSubmit={event => void consult(event, 'github')}><h3><GitBranch />GitHub</h3><label htmlFor="integration-repository">Proprietário/repositório</label><Input id="integration-repository" value={repository} onChange={event => setRepository(event.target.value)} maxLength={201} autoComplete="off" disabled={Boolean(busy)} /><Button type="submit" disabled={Boolean(busy) || !state('github')?.available}>{busy === 'github' ? 'Consultando…' : 'Consultar alterações'}</Button><small>Alterações no repositório não confirmam a publicação no Fama.</small>{github && <div className="control-integration-result" aria-live="polite"><strong>{github.repository}</strong><p>{github.release ? `Última versão no GitHub: ${github.release.name}` : 'Nenhuma versão publicada no GitHub.'}</p><ul>{github.commits.map(commit => <li key={commit.sha}><code>{commit.sha.slice(0,7)}</code> {commit.message}</li>)}</ul></div>}</form>
                <form onSubmit={event => void consult(event, 'ipinfo')}><h3><ShieldCheck />IPinfo</h3><label htmlFor="integration-ip">Endereço IP</label><Input id="integration-ip" value={ip} onChange={event => setIp(event.target.value)} maxLength={45} placeholder="Vazio para consultar esta conexão" autoComplete="off" disabled={Boolean(busy)} /><Button type="submit" disabled={Boolean(busy) || !state('ipinfo')?.available}>{busy === 'ipinfo' ? 'Consultando…' : 'Consultar país e rede'}</Button><small>Os dados informam país e rede. Não representam posição GPS.</small>{network && <dl className="control-integration-result" aria-live="polite"><dt>IP</dt><dd>{network.ip}</dd><dt>País</dt><dd>{network.country || network.countryCode || 'Não informado'}</dd><dt>Rede</dt><dd>{network.network || 'Não informada'} {network.asn}</dd><dt>Fonte</dt><dd>{network.source}</dd></dl>}</form>
            </div>
        </>}
    </section>;
}
