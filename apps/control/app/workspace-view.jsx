'use client';
import { Component, Suspense, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
export function WorkspaceLoading({ label = 'módulo' }) {
    return <div className="workspace-loading" role="status" aria-live="polite"><p>Abrindo {label}…</p><Skeleton className="h-10 w-2/3"/><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/></div>;
}
class WorkspaceError extends Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        return this.state.failed ? <div className="workspace-loading" role="alert"><p>Não foi possível abrir esta tela. Confira a conexão e tente novamente.</p><Button variant="outline" onClick={() => window.location.reload()}>Recarregar esta tela</Button></div> : this.props.children;
    }
}
function Ready({ children, restoreScroll, viewKey }) {
    useLayoutEffect(() => { restoreScroll?.(); }, [restoreScroll, viewKey]);
    return <>{children}</>;
}
export function WorkspaceView({ children, label, restoreScroll, viewKey }) {
    return <WorkspaceError><Suspense fallback={<WorkspaceLoading label={label}/>}><Ready restoreScroll={restoreScroll} viewKey={viewKey}>{children}</Ready></Suspense></WorkspaceError>;
}
