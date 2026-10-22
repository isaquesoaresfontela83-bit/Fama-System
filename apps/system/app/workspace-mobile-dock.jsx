"use client";
import { useState } from 'react';
import { CalendarDays, FileText, Home, MoreHorizontal, Package, Plus, UsersRound, Wrench } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
export function WorkspaceMobileDock({ section, allowed, onNavigate, onCreate }) {
    const { toggleSidebar, isMobile, open: sidebarOpen, openMobile } = useSidebar();
    const menuOpen = isMobile ? openMobile : sidebarOpen;
    const [open, setOpen] = useState(false);
    const actions = [{ section: 'agenda', entity: 'appointments', label: 'Agendamento', description: 'Organizar uma visita ou serviço', icon: CalendarDays }, { section: 'quotes', entity: 'quotes', label: 'Orçamento', description: 'Preparar uma nova proposta', icon: FileText }, { section: 'customers', entity: 'customers', label: 'Cliente', description: 'Cadastrar contato e piscina', icon: UsersRound }, { section: 'inventory', entity: 'inventory', label: 'Produto', description: 'Adicionar um item ao estoque', icon: Package }, { section: 'orders', entity: 'workOrders', label: 'Ordem de serviço', description: 'Registrar uma execução', icon: Wrench }].filter(item => allowed.includes(item.section));
    return <><nav className="workspace-mobile-dock" aria-label="Navegação principal">
 {allowed.includes('dashboard') && <button type="button" aria-current={section === 'dashboard' ? 'page' : undefined} onClick={() => onNavigate('dashboard')}><Home /><span>Início</span></button>}
 {allowed.includes('agenda') && <button type="button" aria-current={section === 'agenda' ? 'page' : undefined} onClick={() => onNavigate('agenda')}><CalendarDays /><span>Agenda</span></button>}
 {actions.length > 0 && <button type="button" className="mobile-dock-new" onClick={() => setOpen(true)} aria-label="Criar novo registro"><span><Plus /></span><small>Novo</small></button>}
 {allowed.includes('customers') && <button type="button" aria-current={section === 'customers' ? 'page' : undefined} onClick={() => onNavigate('customers')}><UsersRound /><span>Clientes</span></button>}
 <button type="button" onClick={toggleSidebar} aria-label={menuOpen ? 'Recolher menu' : 'Abrir menu'} aria-expanded={menuOpen}><MoreHorizontal /><span>Mais</span></button>
 </nav><Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="ops-create-sheet"><SheetHeader><SheetTitle>O que vamos criar?</SheetTitle><SheetDescription>Escolha um registro para a sua empresa.</SheetDescription></SheetHeader><div className="ops-create-actions">{actions.map(({ entity, label, description, icon: Icon }) => <button type="button" key={entity} onClick={() => { setOpen(false); onCreate(entity); }}><span><Icon /></span><div><strong>{label}</strong><small>{description}</small></div><Plus /></button>)}</div></SheetContent></Sheet></>;
}
