'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceWorkspace, workspaceSnapshot } from '@/lib/workspace-navigation';
/** Navigation contains view IDs only. Records and search terms never enter the URL. */
export function useWorkspaceNavigation({ scope, initial, allowed }) {
    const allowedKey = allowed.join('|');
    const [stored, setStored] = useState({ scope, snapshot: { current: initial, history: [] } });
    const current = stored.scope === scope ? workspaceSnapshot(stored.snapshot, allowed, initial) : { current: initial, history: [] };
    const live = useRef({ scope, snapshot: current });
    const positions = useRef(new Map());
    const initialization = useRef('');
    const valid = useRef({ allowed, initial });
    valid.current = { allowed, initial };
    const storageKey = `fama:navigation:v2:${scope}`;
    const apply = useCallback((snapshot) => {
        live.current = { scope, snapshot };
        setStored({ scope, snapshot });
        try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
        }
        catch { /* Navigation works when storage is disabled. */ }
    }, [scope, storageKey]);
    const write = useCallback((snapshot, push, browserBack) => {
        const marker = { scope, snapshot, browserBack };
        const base = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
        try {
            window.history[push ? 'pushState' : 'replaceState']({ ...base, famaWorkspace: marker }, '', `#${snapshot.current}`);
        }
        catch { /* Keep in-app navigation available. */ }
        apply(snapshot);
    }, [scope, apply]);
    const rememberScroll = useCallback(() => {
        if (live.current.scope === scope)
            positions.current.set(`${scope}:${live.current.snapshot.current}`, window.scrollY || 0);
    }, [scope]);
    const navigate = useCallback((next) => {
        if (!valid.current.allowed.includes(next))
            return;
        const base = live.current.scope === scope ? live.current.snapshot : { current: valid.current.initial, history: [] };
        const snapshot = advanceWorkspace(base, next);
        if (snapshot === base)
            return;
        rememberScroll();
        write(snapshot, true, true);
    }, [scope, rememberScroll, write]);
    const replace = useCallback((next) => {
        if (!valid.current.allowed.includes(next))
            return;
        rememberScroll();
        const base = live.current.scope === scope ? live.current.snapshot : { current: valid.current.initial, history: [] };
        const marker = window.history.state?.famaWorkspace;
        write({ ...base, current: next }, false, marker?.scope === scope && marker.browserBack);
    }, [scope, rememberScroll, write]);
    const back = useCallback(() => {
        const base = live.current.scope === scope ? workspaceSnapshot(live.current.snapshot, valid.current.allowed, valid.current.initial) : null;
        const previous = base?.history.at(-1);
        if (!previous || !base)
            return;
        rememberScroll();
        const marker = window.history.state?.famaWorkspace;
        if (marker?.scope === scope && marker.browserBack)
            window.history.back();
        else
            write({ current: previous, history: base.history.slice(0, -1) }, false, false);
    }, [scope, rememberScroll, write]);
    useEffect(() => {
        const page = window.location.pathname + window.location.search;
        const first = initialization.current !== scope;
        let candidate = live.current.scope === scope ? live.current.snapshot : null;
        const marker = window.history.state?.famaWorkspace;
        if (first) {
            positions.current.clear();
            try {
                candidate = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null');
            }
            catch {
                candidate = null;
            }
            if (marker?.scope === scope)
                candidate = marker.snapshot;
            const hash = window.location.hash.slice(1);
            // A previous tenant's URL must not select a view in the next tenant.
            if ((!marker || marker.scope === scope) && valid.current.allowed.includes(hash))
                candidate = { ...(candidate && typeof candidate === 'object' ? candidate : {}), current: hash };
            initialization.current = scope;
        }
        const snapshot = workspaceSnapshot(candidate, valid.current.allowed, valid.current.initial);
        write(snapshot, false, marker?.scope === scope && marker.browserBack);
        const pop = () => {
            rememberScroll();
            const state = window.history.state?.famaWorkspace;
            const hash = window.location.hash.slice(1);
            const value = state?.scope === scope ? state.snapshot : valid.current.allowed.includes(hash) && !state ? { current: hash, history: live.current.snapshot.history } : live.current.snapshot;
            const next = workspaceSnapshot(value, valid.current.allowed, valid.current.initial);
            write(next, false, state?.scope === scope && state.browserBack);
        };
        // The framework otherwise fetches a new server tree for every popstate,
        // including changes between local module hashes. Own only our same-page
        // entries; login, logout and real route changes keep the framework handler.
        const traverse = (event) => {
            if (window.location.pathname + window.location.search !== page)
                return;
            const state = window.history.state?.famaWorkspace;
            if (!state || typeof state.scope !== 'string' || state.scope.split(':')[0] !== scope.split(':')[0])
                return;
            event.stopImmediatePropagation();
            pop();
        };
        const hash = () => { if (window.location.pathname + window.location.search === page && window.location.hash.slice(1) !== live.current.snapshot.current)
            pop(); };
        const restoration = window.history.scrollRestoration;
        window.history.scrollRestoration = 'manual';
        window.addEventListener('popstate', traverse, true);
        window.addEventListener('hashchange', hash);
        return () => { window.removeEventListener('popstate', traverse, true); window.removeEventListener('hashchange', hash); window.history.scrollRestoration = restoration; };
    }, [scope, storageKey, allowedKey, initial, write, rememberScroll]);
    const restoreScroll = useCallback(() => {
        window.scrollTo({ top: positions.current.get(`${scope}:${live.current.snapshot.current}`) ?? 0, behavior: 'instant' });
    }, [scope]);
    return { ...current, navigate, replace, back, canBack: current.history.length > 0, restoreScroll };
}
