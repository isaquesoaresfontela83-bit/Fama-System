'use client';
import { CircleCheck, Cpu, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssistantConnection } from '@/hooks/use-assistant-connection';
import { assistantConnectionLabels, assistantCloudLabels } from '@/lib/fama-ai-connection';
export function FamaAiConnectionCard({ internalEnabled }) {
    const connection = useAssistantConnection({ platform: true });
    const label = assistantConnectionLabels[connection.state];
    const cloudLabel = connection.cloud ? assistantCloudLabels[connection.cloud.state] : undefined;
    return <section className="fama-ai-settings-connection" aria-label="Disponibilidade da Fama IA">
    <div className="fama-ai-settings-connection-heading"><Cpu /><div><h3>Núcleo Fama e Workers AI</h3><p>Consultas internas e sugestões opcionais da IA em nuvem.</p></div><Button type="button" variant="outline" disabled={connection.checking} onClick={() => void connection.refresh()}>{connection.checking ? <LoaderCircle className="animate-spin"/> : <RotateCcw />}Verificar acesso</Button></div>
    <div className="fama-ai-settings-connection-details"><div><span>Consultas internas</span><strong><CircleCheck size={16}/>{internalEnabled ? 'Ativas' : 'Pausadas'}</strong></div><div><span>Núcleo Fama</span><strong data-ready={connection.configured}>{label.title}</strong><p>{label.description}</p></div>{cloudLabel && <div><span>Cloudflare · Workers AI</span><strong data-ready={connection.cloud?.state === 'ready'}>{cloudLabel.title}</strong><p>{cloudLabel.description}</p></div>}</div>
    <p className="fama-ai-settings-connection-note">Voz e modelo aberto são preparados em cada dispositivo na central da assistente. A prévia usa registros de demonstração.</p>
  </section>;
}
