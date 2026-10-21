import { fileURLToPath } from 'node:url';

const hybrid = process.env.FAMA_DEPLOY_TARGET === 'hybrid';
const vps = hybrid || process.env.FAMA_DEPLOY_TARGET === 'vps';
const runtime = fileURLToPath(new URL(hybrid ? './server/hybrid-env.mjs' : './server/vps-env.mjs', import.meta.url));
const headers = [
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
    ['Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
    ['Cross-Origin-Resource-Policy', 'same-origin'],
    ['Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; frame-src 'self' https://www.openstreetmap.org https://accounts.google.com https://embed.waze.com; object-src 'none'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client; worker-src 'self'; connect-src 'self' http://127.0.0.1:17843 https://accounts.google.com https://www.googleapis.com https://cep.awesomeapi.com.br https://brasilapi.com.br https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://*.supabase.co https://huggingface.co https://*.hf.co https://*.huggingface.co; form-action 'self'"],
].map(([key, value]) => ({ key, value }));

export const securityHeaders = headers;

export default vps ? {
    output: 'standalone',
    poweredByHeader: false,
    experimental: { cpus: 2 },
    webpack(configuration, { isServer, webpack }) {
        if (isServer) configuration.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, runtime));
        return configuration;
    },
    async headers() { return [{ source: '/:path*', headers }]; },
} : {};
