const signalKey = 'fama:account-change:v1';
const channelName = 'fama-account-session';
export function announceAccountChange(userId = null) {
    const message = { userId, at: Date.now(), nonce: Math.random().toString(36).slice(2) };
    try { window.localStorage.setItem(signalKey, JSON.stringify(message)); } catch { /* Storage may be disabled. */ }
    try { const channel = new BroadcastChannel(channelName); channel.postMessage(message); channel.close(); } catch { /* Other tabs also check on focus. */ }
}
export function installAccountSessionGuard(browser, userId, onChanged = () => browser.location.replace('/')) {
    const original = browser.fetch;
    let disposed = false, changing = false;
    const changed = () => { if (!disposed && !changing) { changing = true; onChanged(); } };
    const receive = message => { if (message && message.userId !== userId) changed(); };
    const storage = event => { if (event.key === signalKey) { try { receive(JSON.parse(event.newValue)); } catch { /* Ignore unrelated storage values. */ } } };
    const guarded = function(input, init = {}) {
        try {
            const isRequest = typeof Request !== 'undefined' && input instanceof Request;
            const url = new URL(isRequest ? input.url : String(input), browser.location.href);
            if (url.origin === browser.location.origin && url.pathname.startsWith('/api/')) {
                const requestHeaders = new Headers(isRequest ? input.headers : undefined);
                new Headers(init.headers).forEach((value, key) => requestHeaders.set(key, value));
                requestHeaders.set('X-Fama-Account', userId);
                return original.call(browser, input, { ...init, headers: requestHeaders });
            }
        } catch { /* fetch handles invalid URLs in its normal way. */ }
        return original.call(browser, input, init);
    };
    const check = async () => {
        try {
            const response = await original.call(browser, '/api/auth/accounts', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (response.ok) {
                const data = await response.json();
                if (data.activeId !== userId) changed();
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
        if (browser.fetch === guarded) browser.fetch = original;
        browser.removeEventListener('storage', storage);
        browser.removeEventListener('focus', check);
        browser.document?.removeEventListener('visibilitychange', visibility);
        channel?.close();
    };
}
