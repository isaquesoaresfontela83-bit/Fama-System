'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Send, Sparkles, ArrowRight, BookOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { findHelp, helpTopics } from '@/lib/internal-help';
export function InternalHelp({ section, onNavigate, canNavigate }) {
    const [open, setOpen] = useState(false), [question, setQuestion] = useState(''), [messages, setMessages] = useState([]);
    const next = useRef(0), end = useRef(null), input = useRef(null);
    useEffect(() => { if (open)
        end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, open]);
    const suggestions = helpTopics.filter(topic => topic.section === section && canNavigate(topic.section)).slice(0, 3);
    if (!suggestions.length) {
        suggestions.push(...helpTopics.filter(topic => canNavigate(topic.section)).slice(0, 3));
    }
    function ask(value) { const text = value.trim().slice(0, 800); if (!text)
        return; setMessages(current => [...current.slice(-19), { id: ++next.current, question: text, topic: findHelp(text, section, current.at(-1)?.topic?.id) }]); setQuestion(''); input.current?.focus(); }
    function submit(event) { event.preventDefault(); ask(question); }
    function navigate(target) { if (!canNavigate(target))
        return; setOpen(false); onNavigate(target); }
    return <><Button type="button" className="internal-help-trigger" size="sm" onClick={() => setOpen(true)} aria-label="Abrir assistente de ajuda do Fama System" aria-expanded={open} aria-haspopup="dialog"><CircleHelp /><span>Ajuda</span></Button><Sheet open={open} onOpenChange={setOpen}><SheetContent className="internal-help-panel"><SheetHeader className="internal-help-header"><span className="internal-help-mark"><Sparkles /></span><SheetTitle>Assistente interno</SheetTitle><SheetDescription>Orientações e atalhos para sua rotina</SheetDescription></SheetHeader><div className="internal-help-tools">{canNavigate('manual') && <Button size="sm" variant="ghost" onClick={() => navigate('manual')}><BookOpen />Manual</Button>}<Button size="sm" variant="ghost" onClick={() => { setMessages([]); setQuestion(''); }} disabled={!messages.length}><Trash2 />Limpar conversa</Button></div><div className="internal-help-messages" aria-live="polite" aria-relevant="additions"><div className="internal-help-welcome"><strong>Como posso ajudar?</strong><p>Pergunte, por exemplo: “Como cadastrar clientes?” ou “Como criar um orçamento?”.</p><small>Guia de uso do sistema. Para consultar agenda, financeiro e outros registros, abra a Fama IA.</small>{canNavigate('assistant') && <Button className="internal-help-full-ai" variant="outline" size="sm" onClick={() => navigate('assistant')}><Sparkles />Abrir Fama IA</Button>}</div>{messages.map(message => <div className="internal-help-exchange" key={message.id}><p className="internal-help-question">{message.question}</p><article className="internal-help-answer">{message.topic ? <><h3>{message.topic.title}</h3><ol>{message.topic.steps.map(step => <li key={step}>{step}</li>)}</ol>{message.topic.note && <p className="internal-help-note">{message.topic.note}</p>}<small>Fonte: orientações de uso do Fama System</small>{canNavigate(message.topic.section) && <Button type="button" variant="outline" size="sm" onClick={() => navigate(message.topic.section)}>Abrir área relacionada<ArrowRight /></Button>}</> : <><h3>Preciso de mais detalhes</h3><p>Informe a função que você quer usar, como clientes, orçamento, agenda ou financeiro. Para um erro específico, descreva a mensagem na área Suporte.</p>{canNavigate('support') && <Button variant="outline" size="sm" onClick={() => navigate('support')}>Abrir suporte<ArrowRight /></Button>}</>}</article></div>)}<div ref={end}/></div><div className="internal-help-bottom"><div className="internal-help-suggestions">{suggestions.map(topic => <button type="button" key={topic.id} onClick={() => ask(topic.title)}>{topic.title}</button>)}</div><form onSubmit={submit} className="internal-help-form"><Input ref={input} aria-label="Sua dúvida sobre o sistema" placeholder="Como faço para…" maxLength={800} value={question} onChange={event => setQuestion(event.target.value)}/><Button type="submit" size="icon" disabled={!question.trim()} aria-label="Enviar dúvida"><Send /></Button></form><small>Não envie senhas ou chaves de integração.</small></div></SheetContent></Sheet></>;
}
