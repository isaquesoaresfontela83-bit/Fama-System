const signalKey = 'fama:account-change:v1';
const channelName = 'fama-account-session';
export function announceAccountChange(userId = null) {
    const message = { userId, at: Date.now(), nonce: Math.random().toString(36).slice(2) };
    try { window.localStorage.setItem(signalKey, JSON.stringify(message)); } catch { /* Storage may be disabled. */ }
    try { const channel = new BroadcastChannel(channelName); channel.postMessage(message); channel.close(); } catch { /* Other tabs also check on focus. */ }
}
export function installAccountSessionGuard(browser, userId, onChanged = () => browser.location.replace('/')) {
    const original = browser.fetch;
    let disposed = false, changing = false, checkingRevision = 0, pendingChanges = 0;
    const changed = () => { if (!disposed && !changing) { changing = true; onChanged(); } };
    const receive = message => { if (message && Object.hasOwn(message, 'userId') && message.userId !== userId) void check(); };
    const storage = event => { if (event.key === signalKey) { try { receive(JSON.parse(event.newValue)); } catch { /* Ignore unrelated storage values. */ } } };
    const guarded = function(input, init = {}) {
        let requestHeaders, accountMutation = false;
        try {
            const isRequest = typeof Request !== 'undefined' && input instanceof Request;
            const url = new URL(isRequest ? input.url : String(input), browser.location.href);
            if (url.origin === browser.location.origin && url.pathname.startsWith('/api/')) {
                requestHeaders = new Headers(isRequest ? input.headers : undefined);
                new Headers(init.headers).forEach((value, key) => requestHeaders.set(key, value));
                requestHeaders.set('X-Fama-Account', userId);
                const method = String(init.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
                accountMutation = method === 'POST' && url.pathname.startsWith('/api/auth/');
            }
        } catch { /* fetch handles invalid URLs in its normal way. */ }
        if (!requestHeaders) return original.call(browser, input, init);
        if (accountMutation) { pendingChanges++; checkingRevision++; }
        let operation;
        try { operation = original.call(browser, input, { ...init, headers: requestHeaders }); }
        catch (error) { if (accountMutation) pendingChanges--; throw error; }
        return accountMutation ? Promise.resolve(operation).finally(() => { pendingChanges--; }) : operation;
    };
    const check = async () => {
        if (disposed || changing || pendingChanges) return;
        const revision = ++checkingRevision;
        try {
            const response = await original.call(browser, '/api/auth/accounts', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (response.ok) {
                const data = await response.json();
                if (disposed || revision !== checkingRevision || pendingChanges) return;
                if (Object.hasOwn(data ?? {}, 'activeId') && (data.activeId === null || typeof data.activeId === 'string') && data.activeId !== userId) changed();
            }
        } catch { /* A connection failure must not sign the user out. */ }
    };
    const visibility = () => { if (browser.document?.visibilityState === 'visible') void check(); };
    browser.fetch = guarded;
    browser.addEventListener('storage', storage);
    browser.addEventListener('focus', check);
    browser.document?.addEventListener('visibilitychange', visibility);
    let channel;
    try { channel = new browser.BroadcastChannel(channelName); channel.onmessage = event => receive(event.data); } catch { /* Storage/focus remain available. */ }
    void check();
    return () => {
        disposed = true;
        checkingRevision++;
        if (browser.fetch === guarded) browser.fetch = original;
        browser.removeEventListener('storage', storage);
        browser.removeEventListener('focus', check);
        browser.document?.removeEventListener('visibilitychange', visibility);
        channel?.close();
    };
}
