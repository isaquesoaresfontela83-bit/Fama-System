'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Hash, LockKeyhole, MessageSquare, Plus, RefreshCw, Reply, Send, Pin, UsersRound, X, Search, CheckCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { requestJson } from '@/lib/client-request';
import { internalRoles } from '@/lib/internal-chat';
import './chat-workspace.css';
import { BaileysPanel } from './baileys-panel';
const initial = { selfId: '', members: [], threads: [], messages: [], pinned: [], threadId: null, hasMore: false };
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stamp = (value) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export function ChatWorkspace({ organizationId, canManage }) {
    const [tab,setTab]=useState('team');
    return <div><div className="fama-chat-tabs" aria-label="Área de comunicação"><Button variant={tab==='team'?'default':'outline'} onClick={()=>setTab('team')}>Equipe</Button><Button variant={tab==='whatsapp'?'default':'outline'} onClick={()=>setTab('whatsapp')}>WhatsApp</Button></div>{tab==='team'?<InternalChatWorkspace organizationId={organizationId} canManage={canManage}/>:<BaileysPanel key={organizationId} organizationId={organizationId} canManage={canManage}/>}</div>;
}
function InternalChatWorkspace({ organizationId, canManage }) {
    const [inbox, setInbox] = useState(initial), [activeId, setActiveId] = useState(null), [filter, setFilter] = useState(''), [messageSearch, setMessageSearch] = useState(''), [draft, setDraft] = useState(''), [urgent, setUrgent] = useState(false), [reply, setReply] = useState(null), [dialog, setDialog] = useState(null), [channelName, setChannelName] = useState(''), [announcements, setAnnouncements] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [olderBusy, setOlderBusy] = useState(false), [creating, setCreating] = useState(false);
    const active = useRef(null), generation = useRef(0), mounted = useRef(true), draftIds = useRef(null), bottom = useRef(null), stream = useRef(null), sendLock = useRef(false), jumpPending = useRef(false), readProgress = useRef(new Map());
    const headers = { 'x-organization-id': organizationId };
    async function post(body) { const result = await requestJson('/api/internal-chat', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (['send', 'read'].includes(String(body.action)) && typeof window !== 'undefined' && window.dispatchEvent)
        window.dispatchEvent(new Event('fama:chat-updated')); return result; }
    function markRead(thread, sequence) { const previous = readProgress.current.get(thread) || 0; if (sequence <= previous)
        return; readProgress.current.set(thread, sequence); void post({ action: 'read', threadId: thread, sequence }).catch(() => { if (readProgress.current.get(thread) === sequence)
        readProgress.current.set(thread, previous); }); }
    async function load(thread = active.current, background = false) { const seq = ++generation.current; if (!background)
        setLoading(true); try {
        const result = await requestJson('/api/internal-chat' + (thread ? '?thread=' + thread : ''), { headers });
        if (!mounted.current || seq !== generation.current || thread !== active.current)
            return;
        setInbox(previous => ({ ...result, messages: thread && previous.threadId === thread ? [...new Map([...previous.messages, ...result.messages].map(message => [message.id, message])).values()].sort((a, b) => a.sequence - b.sequence) : result.messages, hasMore: previous.threadId === thread && previous.messages.length > 80 ? previous.hasMore : result.hasMore }));
        setError('');
        if (thread && document.visibilityState === 'visible' && result.messages.length) {
            const atBottom = !stream.current || stream.current.scrollHeight - stream.current.scrollTop - stream.current.clientHeight < 140;
            if (!background || atBottom)
                markRead(thread, result.messages.at(-1).sequence);
        }
    }
    catch (e) {
        if (mounted.current && seq === generation.current) {
            setError(e instanceof Error ? e.message : 'Não foi possível atualizar o Chat.');
            if ([401, 402, 403].includes(Number(e?.status))) {
                setInbox(initial);
                active.current = null;
                setActiveId(null);
                setDraft('');
                setReply(null);
            }
        }
    }
    finally {
        if (mounted.current && seq === generation.current)
            setLoading(false);
    } }
    useEffect(() => { mounted.current = true; void load(null); let timer; let stopped = false; const tick = async () => { if (stopped)
        return; if (document.visibilityState === 'visible' && !sendLock.current)
        await load(active.current, true); if (!stopped)
        timer = setTimeout(tick, 6000); }; timer = setTimeout(tick, 6000); return () => { stopped = true; mounted.current = false; generation.current++; clearTimeout(timer); }; }, [organizationId]);
    useEffect(() => { const element = stream.current; if (element && (jumpPending.current || sending || element.scrollHeight - element.scrollTop - element.clientHeight < 220)) {
        bottom.current?.scrollIntoView({ block: 'nearest' });
        jumpPending.current = false;
    } }, [inbox.messages.length, inbox.threadId, sending]);
    function choose(id) { jumpPending.current = true; active.current = id; setActiveId(id); setDraft(''); setReply(null); setUrgent(false); setMessageSearch(''); draftIds.current = null; void load(id); }
    const thread = inbox.threads.find(item => item.id === activeId);
    function title(item) { if (item.kind === 'channel')
        return item.title; return inbox.members.find(person => item.participantIds.includes(person.id) && person.id !== inbox.selfId)?.name || 'Conversa privada'; }
    async function create(body) { if (creating)
        return; setCreating(true); try {
        const result = await post(body);
        if (!mounted.current)
            return;
        setDialog(null);
        setChannelName('');
        choose(result.id);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível iniciar a conversa.');
    }
    finally {
        setCreating(false);
    } }
    async function send() { if (sendLock.current || !draft.trim() || !activeId)
        return; sendLock.current = true; setSending(true); setError(''); const text = draft.trim(), threadId = activeId, replyId = reply?.id || null; let entry = draftIds.current; if (!entry || entry.text !== text || entry.thread !== threadId || entry.reply !== replyId || entry.urgent !== urgent) {
        entry = { text, thread: threadId, reply: replyId, urgent, id: crypto.randomUUID() };
        draftIds.current = entry;
    } try {
        await post({ action: 'send', threadId, text, replyId, urgent, clientId: entry.id });
        if (!mounted.current)
            return;
        if (active.current === threadId) {
            setDraft('');
            setReply(null);
            setUrgent(false);
            draftIds.current = null;
            await load(threadId, true);
            bottom.current?.scrollIntoView({ block: 'nearest' });
        }
    }
    catch (e) {
        if (mounted.current)
            setError(e instanceof Error ? e.message : 'Mensagem não enviada. Seu texto foi mantido.');
    }
    finally {
        sendLock.current = false;
        if (mounted.current)
            setSending(false);
    } }
    async function older() { if (!activeId || olderBusy || !inbox.messages.length)
        return; setOlderBusy(true); const target = activeId; try {
        const result = await requestJson(`/api/internal-chat?thread=${target}&before=${inbox.messages[0].sequence}`, { headers });
        if (mounted.current && active.current === target)
            setInbox(previous => ({ ...previous, messages: [...new Map([...result.messages, ...previous.messages].map(message => [message.id, message])).values()].sort((a, b) => a.sequence - b.sequence), hasMore: result.hasMore }));
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível carregar mensagens anteriores.');
    }
    finally {
        setOlderBusy(false);
    } }
    async function pin(message) { try {
        await post({ action: 'pin', threadId: activeId, messageId: message.id, pinned: !message.pinned });
        await load(active.current, true);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível fixar.');
    } }
    const canSend = thread && (!thread.announcements || canManage) && (thread.kind === 'channel' || thread.participantIds.some(id => id !== inbox.selfId && inbox.members.some(member => member.id === id)));
    const messages = inbox.threadId === activeId ? inbox.messages.filter(message => normalize(message.text + ' ' + message.author).includes(normalize(messageSearch))) : [];
    return <div className="internal-chat-workspace"><section className="internal-chat-summary"><span className="internal-chat-logo"><MessageSquare /></span><div><h2>Conexão da equipe</h2><p>Alinhe atendimentos, compartilhe orientações e acompanhe as conversas.</p></div><div className="internal-chat-summary-stats"><span><strong>{inbox.members.length}</strong> usuários</span><span><strong>{inbox.threads.reduce((sum, item) => sum + item.unread, 0)}</strong> não lidas</span></div><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw />Atualizar</Button></section>{error && <div className="chat-error" role="alert">{error}</div>}<section className={`surface internal-chat-inbox ${activeId ? 'has-thread' : ''}`}><aside className="internal-chat-sidebar"><header><h3>Conversas</h3><Button size="icon-sm" variant="outline" aria-label="Nova conversa" onClick={() => setDialog('direct')}><Plus /></Button></header><div className="internal-chat-search"><Search /><Input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas"/></div><div className="internal-chat-lists">{['channel', 'direct'].map(kind => <div key={kind}><div className="internal-chat-list-heading"><strong>{kind === 'channel' ? 'Canais da empresa' : 'Mensagens diretas'}</strong>{kind === 'channel' && canManage && <Button size="icon-sm" variant="ghost" aria-label="Criar canal" onClick={() => setDialog('channel')}><Plus /></Button>}</div>{inbox.threads.filter(item => item.kind === kind && normalize(title(item) + ' ' + item.preview).includes(normalize(filter))).map(item => <button className={'internal-chat-contact ' + (activeId === item.id ? 'active' : '')} key={item.id} onClick={() => choose(item.id)}><span className={'internal-chat-avatar ' + item.kind}>{item.kind === 'channel' ? <Hash /> : title(item).slice(0, 2).toUpperCase()}</span><span><strong>{title(item)}{item.announcements && <LockKeyhole size={13}/>}</strong><small>{item.preview || 'Comece a conversa'}</small><time>{stamp(item.lastAt)}</time></span>{item.unread > 0 && <b>{item.unread > 99 ? '99+' : item.unread}</b>}</button>)}</div>)}{!inbox.threads.length && !loading && <p className="internal-chat-list-empty">Inicie uma conversa com alguém da equipe{canManage ? ' ou crie um canal' : ''}.</p>}{loading && !inbox.selfId && <p className="internal-chat-list-empty">Carregando equipe…</p>}</div><footer><UsersRound /><span>Somente usuários ativos da sua empresa</span></footer></aside><div className="internal-chat-thread">{thread ? <><header className="internal-chat-thread-header"><Button className="internal-chat-back" size="icon-sm" variant="ghost" aria-label="Voltar às conversas" onClick={() => { active.current = null; setActiveId(null); generation.current++; }}><ArrowLeft /></Button><span className="internal-chat-avatar">{thread.kind === 'channel' ? <Hash /> : <MessageSquare />}</span><div><h3>{title(thread)}</h3><p>{thread.kind === 'direct' ? 'Conversa privada entre os participantes' : thread.announcements ? 'Avisos · envio restrito à administração' : 'Canal compartilhado com a equipe'}</p></div></header><Input className="internal-chat-message-search" value={messageSearch} onChange={event => setMessageSearch(event.target.value)} placeholder="Buscar nas mensagens carregadas" aria-label="Buscar nas mensagens carregadas"/>{inbox.pinned.length > 0 && <details className="internal-chat-pinned"><summary><Pin size={14}/>{inbox.pinned.length} mensagem(ns) fixada(s)</summary>{inbox.pinned.map(item => <div key={item.id}><strong>{item.author}</strong><p>{item.text}</p>{(canManage || thread.kind === 'direct') && <Button size="sm" variant="ghost" onClick={() => void pin(item)}>Desafixar</Button>}</div>)}</details>}<div className="internal-chat-stream" ref={stream} role="log" aria-live="polite" aria-relevant="additions" onScroll={() => { const el = stream.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 50 && document.visibilityState === 'visible' && inbox.messages.length)
        activeId && markRead(activeId, inbox.messages.at(-1).sequence); }}>{inbox.hasMore && <Button size="sm" variant="outline" onClick={() => void older()} disabled={olderBusy}>{olderBusy ? 'Carregando…' : 'Mensagens anteriores'}</Button>}{loading && inbox.threadId !== activeId ? <p>Carregando conversa…</p> : messages.map(item => <article className={`internal-chat-bubble ${item.senderId === inbox.selfId ? 'own' : ''} ${item.urgent ? 'urgent' : ''}`} key={item.id}><header><strong>{item.senderId === inbox.selfId ? 'Você' : item.author}</strong>{item.urgent && <span><AlertTriangle size={13}/>Urgente</span>}{item.pinned && <Pin size={13}/>}</header>{item.replyId && <blockquote>{inbox.messages.find(other => other.id === item.replyId)?.text.slice(0, 180) || 'Resposta a uma mensagem anterior'}</blockquote>}<p>{item.text}</p><footer><time>{stamp(item.createdAt)}</time>{item.senderId === inbox.selfId && <span title={item.readCount ? `Vista por ${item.readCount} usuário(s)` : 'Salva no sistema'}><CheckCheck size={14}/>{item.readCount ? 'Lida' : 'Enviada'}</span>}<button type="button" aria-label={`Responder mensagem de ${item.author}`} onClick={() => setReply(item)}><Reply size={15}/></button>{(canManage || thread.kind === 'direct') && <button type="button" aria-label={item.pinned ? 'Desafixar mensagem' : 'Fixar mensagem'} onClick={() => void pin(item)}><Pin size={15}/></button>}</footer></article>)}{!messages.length && !loading && <div className="internal-chat-empty"><MessageSquare /><p>{messageSearch ? 'Nenhuma mensagem corresponde à busca.' : 'A conversa começa aqui.'}</p></div>}<div ref={bottom}/></div>{canSend ? <form className="internal-chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>{reply && <div className="internal-chat-reply"><Reply size={15}/><span>Respondendo a {reply.author}: {reply.text.slice(0, 100)}</span><button type="button" aria-label="Cancelar resposta" onClick={() => setReply(null)}><X size={15}/></button></div>}<textarea rows={2} maxLength={4000} value={draft} onChange={event => setDraft(event.target.value)} disabled={sending} placeholder="Escreva para sua equipe…" aria-label="Mensagem para a equipe" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void send();
    } }}/><div><label><input type="checkbox" checked={urgent} onChange={event => setUrgent(event.target.checked)} disabled={sending}/>Marcar urgente</label><span>Enter envia · Shift + Enter quebra linha</span><Button type="submit" disabled={sending || !draft.trim()}><Send />{sending ? 'Enviando…' : 'Enviar'}</Button></div></form> : <p className="internal-chat-readonly">{thread.kind === 'channel' ? 'Este canal recebe avisos da administração.' : 'O outro participante está sem acesso ao Chat. O histórico continua disponível.'}</p>}</> : <div className="internal-chat-empty welcome"><span className="internal-chat-welcome-icon"><UsersRound /></span><h3>Sua equipe, mais próxima</h3><p>Converse diretamente com um colega ou reúna a operação em canais da empresa.</p><div><span><LockKeyhole />Conversas privadas</span><span><Hash />Canais da equipe</span><span><Pin />Orientações fixadas</span></div><Button onClick={() => setDialog('direct')}><Plus />Iniciar conversa</Button></div>}</div></section><Dialog open={dialog !== null} onOpenChange={open => !open && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>{dialog === 'direct' ? 'Conversar com a equipe' : 'Criar canal'}</DialogTitle><DialogDescription>{dialog === 'direct' ? 'Escolha um usuário ativo da empresa com permissão para o Chat. A conversa fica visível apenas para vocês.' : 'Canais são compartilhados com os usuários que têm acesso ao Chat.'}</DialogDescription></DialogHeader>{error && <p role="alert" className="chat-error">{error}</p>}{dialog === 'direct' ? <div className="internal-chat-member-picker">{inbox.members.filter(member => member.id !== inbox.selfId).map(member => <button disabled={creating} key={member.id} onClick={() => void create({ action: 'direct', recipientId: member.id })}><span className="internal-chat-avatar">{member.name.slice(0, 2).toUpperCase()}</span><span><strong>{member.name}</strong><small>{internalRoles[member.role] || 'Equipe'}</small></span><MessageSquare /></button>)}{inbox.members.length <= 1 && <p>Cadastre outros usuários e libere o acesso ao Chat nas permissões da empresa.</p>}</div> : <form className="internal-chat-channel-form" onSubmit={event => { event.preventDefault(); void create({ action: 'channel', title: channelName, announcements }); }}><label>Nome do canal<Input required minLength={2} maxLength={60} value={channelName} onChange={event => setChannelName(event.target.value)} placeholder="Ex.: Operação, Técnicos, Avisos"/></label><label><input type="checkbox" checked={announcements} onChange={event => setAnnouncements(event.target.checked)}/>Somente administradores podem enviar avisos</label><Button type="submit" disabled={creating || channelName.trim().length < 2}>{creating ? 'Criando…' : 'Criar canal'}</Button></form>}</DialogContent></Dialog></div>;
}
