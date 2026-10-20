'use client';
import { useId, useMemo } from 'react';
import { ArrowRight, Download, ShieldCheck, Sparkles, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFamaLocalAi } from '@/hooks/use-fama-local-ai';
import { buildAssistantWorkspace } from '@/lib/fama-ai';
import { restrictAssistantSettings } from '@/lib/fama-ai-settings';
export function FamaAiPreparation() {
    const local = useFamaLocalAi();
    const downloading = local.models.speech.status === 'loading' ? local.models.speech : local.models.language.status === 'loading' ? local.models.language : null;
    const failure = [local.models.speech, local.models.language].find(model => model.status === 'error');
    const saved = [local.models.speech, local.models.language].filter(model => model.saved).length;
    const title = downloading ? `${local.models.speech.status === 'loading' ? 'Preparando comandos de voz' : 'Preparando conversa local'}${downloading.progress === undefined ? '…' : ` · ${downloading.progress}%`}` : failure ? 'A preparação precisa de atenção' : local.models.language.status === 'unsupported' ? 'Fama IA em modo leve' : !local.automatic ? 'Preparação automática pausada' : saved ? 'IA salva neste aparelho' : local.preparingAutomatic ? 'Conferindo a IA deste aparelho…' : 'Preparação automática ao abrir';
    return <div className="fama-ai-preparation">
    <ShieldCheck size={18} aria-hidden="true"/>
    <div className="fama-ai-preparation-copy"><strong>{title}</strong>
      <p>{failure ? failure.error : downloading ? 'Você pode continuar usando o sistema. Os arquivos já salvos serão reutilizados.' : local.models.language.status === 'unsupported' ? local.models.language.error || 'Consultas pelo núcleo Fama. A conversa com modelo local exige um aparelho compatível.' : local.automatic ? 'Ao abrir, baixamos somente o que faltar. Voz: cerca de 70 MB; conversa local: cerca de 600 MB, em aparelhos compatíveis.' : 'Ative para baixar e salvar os modelos neste navegador. O download pode consumir dados móveis.'}</p>
      {downloading?.progress !== undefined && <progress value={downloading.progress} max="100" aria-label="Progresso do arquivo atual"/>}
    </div>
    {downloading ? <Button size="sm" variant="outline" onClick={() => local.setAutomatic(false)}><Square size={14}/>Pausar</Button> : failure ? <Button size="sm" variant="outline" onClick={() => void local.prepareAutomatically()}><Download size={14}/>Tentar novamente</Button> : !local.automatic ? <Button size="sm" variant="outline" onClick={() => local.setAutomatic(true)}><Download size={14}/>Permitir e preparar</Button> : null}
  </div>;
}
export function FamaAiStartup({ data, settings, allowedSources, scopeLabel, loading, error, onNavigate }) {
    const id = useId();
    const day = new Date().toLocaleDateString('pt-BR');
    const workspace = useMemo(() => settings ? buildAssistantWorkspace(loading || error ? {} : data, new Date(), restrictAssistantSettings(settings, allowedSources)) : null, [data, settings, allowedSources, loading, error, day]);
    if (settings && !settings.enabled)
        return null;
    return <section className="fama-ai-startup" aria-labelledby={id}>
    <div className="fama-ai-startup-heading"><div><span><Sparkles size={16} aria-hidden="true"/>{scopeLabel}</span><h2 id={id}>Resumo geral</h2></div>{settings && <Button size="sm" variant="outline" onClick={() => onNavigate('assistant')}>Fama IA<ArrowRight size={15}/></Button>}</div>
    {error ? <p className="fama-ai-startup-empty" role="status">{error}</p> : loading || !workspace ? <p className="fama-ai-startup-empty" role="status">Carregando o resumo dos seus registros…</p> : workspace.metrics.length ? <div className="fama-ai-startup-metrics">{workspace.metrics.map(metric => <div key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong><span>{metric.detail}</span></div>)}</div> : <p className="fama-ai-startup-empty">Os módulos autorizados ainda não têm dados disponíveis para o resumo.</p>}
    {!loading && !error && workspace && workspace.insights.length > 0 && <div className="fama-ai-startup-insights">{workspace.insights.slice(0, 3).map(insight => <button type="button" key={insight.id} disabled={!settings?.allowNavigation} onClick={() => onNavigate(insight.source)}><span><strong>{insight.title}</strong><small>{insight.detail}</small></span><b>{insight.value}</b><ArrowRight size={15} aria-hidden="true"/></button>)}</div>}
    <FamaAiPreparation />
  </section>;
}
