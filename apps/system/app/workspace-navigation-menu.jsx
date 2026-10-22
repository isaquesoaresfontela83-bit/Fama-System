"use client";

import { useEffect, useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, useSidebar } from '@/components/ui/sidebar';

function WorkspaceMenuButton({ item, active, onNavigate, onPreload }) {
    const { isMobile, setOpenMobile } = useSidebar();
    const Icon = item.icon;
    return <SidebarMenuButton type="button" className="workspace-nav-link group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!" isActive={active} aria-label={item.label} aria-current={active ? 'page' : undefined} tooltip={item.label} onPointerEnter={() => onPreload?.(item.id)} onFocus={() => onPreload?.(item.id)} onClick={() => {
        onNavigate(item.id);
        if (isMobile) setOpenMobile(false);
    }}><Icon /><span>{item.label}</span></SidebarMenuButton>;
}

export function WorkspaceNavigationMenu({ groups, section, onNavigate, onPreload }) {
    const { isMobile, open, setOpen } = useSidebar();
    const prefix = useId();
    const primary = groups.filter(group => !group.collapsible);
    const secondary = groups.filter(group => group.collapsible);
    const activeGroup = secondary.find(group => group.items.some(item => item.id === section))?.id ?? null;
    const [expanded, setExpanded] = useState(activeGroup);

    useEffect(() => { setExpanded(activeGroup); }, [section, activeGroup]);

    return <nav className="workspace-navigation" aria-label="Módulos do Fama System">
        {primary.map(group => <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{group.items.map(item => <SidebarMenuItem key={item.id}>
                <WorkspaceMenuButton item={item} active={section === item.id} onNavigate={onNavigate} onPreload={onPreload} />
            </SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>)}
        {secondary.length > 0 && <SidebarGroup>
            <SidebarGroupLabel>Mais opções</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{secondary.map(group => {
                const Icon = group.icon;
                const visible = expanded === group.id && (isMobile || open);
                const submenuId = `${prefix}-${group.id}`;
                return <SidebarMenuItem key={group.id} className="workspace-nav-folder">
                    <SidebarMenuButton type="button" className="workspace-nav-toggle group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!" isActive={activeGroup === group.id} aria-label={group.label} aria-expanded={visible} aria-controls={visible ? submenuId : undefined} tooltip={group.label} onClick={() => {
                        if (!isMobile && !open) { setOpen(true); setExpanded(group.id); }
                        else setExpanded(current => current === group.id ? null : group.id);
                    }}><Icon /><span className="workspace-nav-label">{group.label}</span><ChevronRight className="workspace-nav-chevron" aria-hidden="true" /></SidebarMenuButton>
                    {visible && <SidebarMenuSub id={submenuId} className="workspace-submenu" aria-label={group.label}>{group.items.map(item => <SidebarMenuSubItem key={item.id}>
                        <WorkspaceMenuButton item={item} active={section === item.id} onNavigate={onNavigate} onPreload={onPreload} />
                    </SidebarMenuSubItem>)}</SidebarMenuSub>}
                </SidebarMenuItem>;
            })}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>}
    </nav>;
}
