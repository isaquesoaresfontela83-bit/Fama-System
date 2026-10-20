import { Sparkles } from 'lucide-react';
/** Decorative motion only. The panel announces its real activity as text. */
export function FamaAiOrb({ activity = 'idle', large = false }) {
    return <span className={`fama-ai-orb${large ? ' fama-ai-orb-large' : ''}`} data-state={activity} aria-hidden="true">
    <span className="fama-ai-orb-aura"/>
    <span className="fama-ai-orb-ring"/>
    <span className="fama-ai-orb-core"><Sparkles className="fama-ai-orb-symbol"/><span className="fama-ai-orb-wave"><i /><i /><i /><i /><i /></span></span>
  </span>;
}
