'use client';
import { useEffect, useState } from 'react';
import { ExternalLink, GitBranch, Link2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { integrationProviders, defaultFamaRepository } from '@/lib/integration-catalog';
import { requestJson } from '@/lib/client-request';
import { ControlBaileys } from './control-baileys';

export function ControlIntegrations() {
    const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(''), [repository, setRepository] = useState(defaultFamaRepository), [ip, setIp] = useState('');
    const [github, setGithub] = useState(null), [network, setNetwork] = useState(null);
    useEffect(() => {
        const controller = new AbortController();
        setError(''); setData(null);
        requestJson('/api/admin/integrations', { cache: 'no-store', signal: controller.signal })
            .then(value => { if (!controller.signal.aborted) setData(value); })
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
        <p className="control-muted">Acompanhe as conexões e consulte IPinfo e GitHub. As credenciais e as chamadas aos provedores permanecem no backend.</p>
        <ControlBaileys/>
        {!data && !error && <p role="status">Conferindo integrações e versões…</p>}
        {error && <p className="control-error" role="alert">{error}</p>}
        {data && <>
            <div className={`companion-release ${data.release.synchronized ? 'synchronized' : ''}`} role="status"><ShieldCheck /><div><strong>{data.release.synchronized ? 'System e Control na mesma atualização' : 'Conferir sincronização dos sistemas'}</strong><p>Control {data.release.control.version} · System {data.release.system?.version || 'sem resposta'}</p><small>{data.release.synchronized ? `Lançamento ${data.release.control.releaseId}` : 'A publicação conjunta só é concluída quando os dois lançamentos coincidem.'}</small></div></div>
            {data.backendMessage && <p role="alert" className="control-error">{data.backendMessage}</p>}
            <div className="control-integration-grid">{integrationProviders.map(provider => {
                const item = state(provider.id);
                const label = item?.configured === null || !item ? 'Status indisponível' : provider.id === 'github' && item.available ? 'Consulta pública disponível' : item.configured ? 'Configuração presente' : provider.id === 'ipinfo' && item.available ? 'Modo público disponível' : 'Configuração pendente';
                return <article key={provider.id} className="control-integration-card"><div className="control-integration-card-heading"><h3>{provider.name}</h3><span className={item?.configured ? 'configured' : ''}>{label}</span></div><p>{provider.description}</p><small>{provider.scope === 'control' ? 'Consulta exclusiva do Fama Control.' : 'Ações disponíveis no Fama System para proprietários e administradores.'}</small><a href={provider.url} target="_blank" rel="noreferrer">Abrir {provider.name}<ExternalLink aria-hidden="true" /></a></article>;
            })}</div>
            <p className="control-muted">Configuração presente indica que os campos necessários foram cadastrados. A validação com o serviço real é feita separadamente. No IPinfo, o modo Lite exige token; o modo público tem limite compartilhado.</p>
            <details className="control-integration-setup"><summary>Configurar as conexões</summary><p>Cadastre as credenciais em Edge Functions → Secrets, no painel seguro do backend. O Drive precisa também da autorização da conta e da pasta de destino; o Resend precisa de um remetente verificado.</p><a href="https://supabase.com/dashboard/project/mupnsdqahoybhmkpufmx/functions" target="_blank" rel="noreferrer">Abrir configuração do backend<ExternalLink aria-hidden="true" /></a></details>
            <div className="control-integration-queries">
                <form onSubmit={event => void consult(event, 'github')}><h3><GitBranch />GitHub</h3><label htmlFor="integration-repository">Proprietário/repositório</label><Input id="integration-repository" value={repository} onChange={event => setRepository(event.target.value)} maxLength={201} autoComplete="off" disabled={Boolean(busy)} /><Button type="submit" disabled={Boolean(busy) || !state('github')?.available}>{busy === 'github' ? 'Consultando…' : 'Consultar alterações'}</Button><small>Alterações no repositório não confirmam a publicação no Fama.</small>{github && <div className="control-integration-result" aria-live="polite"><a href={github.url} target="_blank" rel="noreferrer">{github.repository}</a><p>{github.release ? `Última versão no GitHub: ${github.release.name}` : 'Nenhuma versão publicada no GitHub.'}</p><ul>{github.commits.map(commit => <li key={commit.sha}><code>{commit.sha.slice(0,7)}</code> {commit.message}</li>)}</ul></div>}</form>
                <form onSubmit={event => void consult(event, 'ipinfo')}><h3><ShieldCheck />IPinfo</h3><label htmlFor="integration-ip">Endereço IP</label><Input id="integration-ip" value={ip} onChange={event => setIp(event.target.value)} maxLength={45} placeholder="Vazio para consultar esta conexão" autoComplete="off" disabled={Boolean(busy)} /><Button type="submit" disabled={Boolean(busy) || !state('ipinfo')?.available}>{busy === 'ipinfo' ? 'Consultando…' : 'Consultar país e rede'}</Button><small>Os dados informam país e rede. Não representam posição GPS.</small>{network && <dl className="control-integration-result" aria-live="polite"><dt>IP</dt><dd>{network.ip}</dd><dt>País</dt><dd>{network.country || network.countryCode || 'Não informado'}</dd><dt>Rede</dt><dd>{network.network || 'Não informada'} {network.asn}</dd><dt>Fonte</dt><dd>{network.source}</dd></dl>}</form>
            </div>
        </>}
    </section>;
}
