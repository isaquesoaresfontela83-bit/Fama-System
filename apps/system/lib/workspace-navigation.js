export const workspaceHistoryLimit = 32;
export function workspaceSnapshot(value, allowed, fallback) {
    const data = value && typeof value === 'object' ? value : {};
    const valid = (view) => typeof view === 'string' && allowed.includes(view);
    const current = valid(data.current) ? data.current : fallback;
    const history = Array.isArray(data.history) ? data.history.filter(valid).slice(-workspaceHistoryLimit) : [];
    return { current, history };
}
export function advanceWorkspace(snapshot, next) {
    return next === snapshot.current ? snapshot : { current: next, history: [...snapshot.history, snapshot.current].slice(-workspaceHistoryLimit) };
}
