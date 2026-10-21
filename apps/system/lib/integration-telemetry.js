// Only positions in our compiled code are sent; error messages and page URLs are excluded.
export function integrationErrorFrames(error, origin) {
    return String(error?.stack || '').split('\n').slice(-20).flatMap(line => {
        const match = line.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
        if (!match) return [];
        try {
            const url = new URL(match[1]);
            if (url.origin !== origin || !/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(url.pathname)) return [];
            return [{ filename: url.pathname, lineno: Number(match[2]), colno: Number(match[3]) }];
        } catch { return []; }
    }).reverse().slice(-15);
}
