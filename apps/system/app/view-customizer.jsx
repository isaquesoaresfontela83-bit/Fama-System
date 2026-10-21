'use client';
import { Children, cloneElement, isValidElement, useEffect, useState } from 'react';
import { Settings2, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
export function useViewPreferences(key, defaults, storage = 'local') {
    const [state, setState] = useState({ key: '', value: defaults });
    useEffect(() => { let value = defaults; try {
        const raw = JSON.parse((storage === 'session' ? sessionStorage : localStorage).getItem(key) || 'null');
        if (raw && typeof raw === 'object' && !Array.isArray(raw))
            value = { ...defaults, ...raw };
    }
    catch { } setState({ key, value }); }, [key, storage]);
    useEffect(() => { if (state.key === key)
        try {
            (storage === 'session' ? sessionStorage : localStorage).setItem(key, JSON.stringify(state.value));
        }
        catch { } }, [state, key, storage]);
    const value = state.key === key ? state.value : defaults;
    const setValue = next => setState(current => ({ key, value: typeof next === 'function' ? next(current.key === key ? current.value : defaults) : next }));
    return [value, setValue];
}
export function ViewCustomizer({ scope, children, labels, className, itemIds, enabled, defaultOrder = [] }) {
    const nodes = Children.toArray(children).filter(isValidElement);
    const [prefs, setPrefs] = useViewPreferences('fama-view:' + scope, { hidden: [], order: defaultOrder });
    const [open, setOpen] = useState(false);
    const fullIds = nodes.map((_, index) => itemIds?.[index] ?? String(index));
    const ids = fullIds.filter((_, index) => enabled?.[index] !== false);
    const nodeFor = (id) => nodes[fullIds.indexOf(id)];
    const labelFor = (id) => labels[fullIds.indexOf(id)] || id;
    const hidden = Array.isArray(prefs.hidden) ? [...new Set(prefs.hidden.filter(id => typeof id === "string"))] : [];
    const saved = Array.isArray(prefs.order) && prefs.order.length ? prefs.order : defaultOrder;
    const order = [...new Set([...saved.filter(id => ids.includes(id)), ...ids])];
    function move(id, delta) { const next = [...order], index = next.indexOf(id), other = index + delta; if (other < 0 || other >= next.length)
        return; [next[index], next[other]] = [next[other], next[index]]; setPrefs({ ...prefs, order: next }); }
    return <><div className="view-personalize-bar"><span>{ids.length - hidden.filter(id => ids.includes(id)).length} blocos visíveis</span><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Settings2 />Personalizar visão</Button></div><div className={className}>{order.filter(id => !hidden.includes(id)).map((id, index) => cloneElement(nodeFor(id), { key: id, style: { ...nodeFor(id).props.style, order: index } }))}</div>{ids.every(id => hidden.includes(id)) && <div className="surface management-empty">Seu painel está vazio. Use Personalizar visão para adicionar os blocos desejados.</div>}<Sheet open={open} onOpenChange={setOpen}><SheetContent className="view-customizer-sheet"><SheetHeader><SheetTitle>Personalizar visão</SheetTitle><SheetDescription>Escolha o que deseja ver e a ordem dos blocos. Suas escolhas ficam salvas neste navegador, por usuário e empresa.</SheetDescription></SheetHeader><div className="view-options">{order.map((id, index) => <div className="view-option" key={id}><label><input type="checkbox" checked={!hidden.includes(id)} onChange={event => setPrefs({ ...prefs, hidden: event.target.checked ? hidden.filter(item => item !== id) : [...hidden, id] })}/>{labelFor(id)}</label><Button size="icon-sm" variant="ghost" disabled={index === 0} aria-label={`Mover ${labelFor(id)} para cima`} onClick={() => move(id, -1)}><ArrowUp /></Button><Button size="icon-sm" variant="ghost" disabled={index === order.length - 1} aria-label={`Mover ${labelFor(id)} para baixo`} onClick={() => move(id, 1)}><ArrowDown /></Button></div>)}</div><Button variant="outline" onClick={() => setPrefs({ hidden: [], order: defaultOrder })}><RotateCcw />Restaurar padrão</Button><Button onClick={() => setOpen(false)}>Concluir</Button></SheetContent></Sheet></>;
}
