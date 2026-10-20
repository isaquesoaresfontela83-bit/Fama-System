'use client';
import { Cpu, Download, Mic, ShieldCheck, Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { localAiModels } from '@/lib/fama-ai-local';
export function FamaAiLocalSettings({ local, enabled, onEnable }) {
    return <div className="fama-ai-local-settings">
    <div className="fama-ai-local-privacy"><ShieldCheck /><div><strong>Processamento no dispositivo</strong><p>Os downloads contêm os modelos. Perguntas, registros e áudio não são enviados a um provedor de IA.</p></div></div>
    <label className="fama-ai-local-automatic"><input type="checkbox" checked={local.automatic} onChange={event => local.setAutomatic(event.target.checked)}/><span><strong>Preparar automaticamente ao abrir</strong><small>Baixa somente os arquivos que faltarem e mantém os modelos salvos neste aparelho. Pode consumir dados móveis.</small></span></label>
    {['speech', 'language'].map(kind => {
            const model = localAiModels[kind];
            const state = local.models[kind];
            const Icon = kind === 'speech' ? Mic : Cpu;
            return <section className="fama-ai-local-model" key={kind}>
        <div className="fama-ai-local-model-heading"><Icon /><div><h3>{kind === 'speech' ? 'Comandos de voz' : 'Conversa com modelo local'}</h3><p>{kind === 'speech' ? 'Dite em português e revise a transcrição antes de enviar.' : 'Explicações e sugestões escritas pelo modelo, junto aos resultados dos registros.'}</p></div></div>
        <div className="fama-ai-local-model-meta"><span>{model.download}</span><span>{kind === 'speech' ? 'CPU do dispositivo' : 'Dispositivo com WebGPU'}</span></div>
        {state.status === 'loading' ? <div role="status" className="fama-ai-local-progress"><span>{state.restoring ? 'Abrindo arquivos salvos…' : state.file ? `Preparando ${state.file}` : 'Baixando e preparando o modelo…'}</span>{state.progress !== undefined && <progress max="100" value={state.progress} aria-label="Progresso do arquivo atual"/>}<Button type="button" variant="outline" size="sm" onClick={() => local.terminate(kind)}><Square />Cancelar preparação</Button></div> : state.status === 'ready' || state.status === 'saved' ? <><div className="fama-ai-local-model-ready"><strong>{state.status === 'saved' ? 'Salvo neste aparelho' : state.saved ? 'Pronto e salvo neste aparelho' : 'Pronto nesta sessão'}</strong>{kind === 'language' && <Button type="button" variant="outline" size="sm" onClick={() => onEnable(!enabled)}>{enabled ? 'Usar somente o núcleo Fama' : 'Usar modelo local'}</Button>}</div>{state.status === 'saved' && <p className="fama-ai-local-note">{kind === 'speech' ? 'Use Ditar para abrir a voz salva automaticamente.' : enabled ? 'O modelo será aberto automaticamente ao perguntar.' : 'Ative o modelo para usar nas próximas perguntas.'} Os arquivos já baixados serão reutilizados.</p>}</> : state.status === 'unsupported' ? <p className="fama-ai-local-note">{state.error || 'A aceleração deste dispositivo não é compatível com o modelo. Use as consultas do núcleo Fama.'}{state.saved && ' Os arquivos do modelo continuam salvos neste aparelho.'}</p> : <><Button type="button" variant="outline" disabled={local.voice !== 'idle' || local.generating} onClick={async () => { if (await local.load(kind) && kind === 'language')
                onEnable(true); }}><Download />{state.status === 'error' ? 'Tentar preparar novamente' : state.partial ? 'Completar download' : 'Baixar e preparar'}</Button>{state.partial && <p className="fama-ai-local-note">Faltam arquivos para concluir. O que já foi salvo será reutilizado.</p>}</>}
        {state.status === 'error' && <p className="fama-ai-local-note" role="alert">{state.error}</p>}
        {state.warning && <p className="fama-ai-local-note" role="alert">{state.warning}</p>}
      </section>;
        })}
    <div className="fama-ai-local-reading"><Volume2 /><div><strong>Ouvir respostas</strong><p>{local.localVoiceAvailable ? 'Voz local em português disponível. Use “Ouvir resposta” na conversa.' : 'Instale uma voz local de português nas configurações do dispositivo para ouvir as respostas.'}</p></div></div>
    <p className="fama-ai-local-note">Modelos abertos: {localAiModels.language.name} e {localAiModels.speech.name}. Os arquivos e sua escolha de usar o modelo ficam salvos neste navegador ao fechar. Limpar os dados do site ou usar navegação privada pode remover os downloads. As conversas ficam apenas nesta sessão.</p>
  </div>;
}
