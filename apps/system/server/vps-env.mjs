import { resolve } from 'node:path';
import { VpsSQLite } from './vps-sqlite.mjs';
import { VpsBucket } from './vps-bucket.mjs';

const databases = new Map();

export function localService(target, publicOrigin) {
    const base = new URL(target);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
        throw new Error('Endereço interno do serviço inválido.');
    }
    return {
        async fetch(input, init) {
            const request = new Request(input, init);
            const source = new URL(request.url);
            const destination = new URL(base);
            destination.pathname = source.pathname;
            destination.search = source.search;
            const headers = new Headers(request.headers);
            const publicUrl = new URL(publicOrigin || source.origin);
            headers.set('Host', publicUrl.host);
            headers.set('X-Forwarded-Host', publicUrl.host);
            headers.set('X-Forwarded-Proto', publicUrl.protocol.slice(0, -1));
            const options = { method: request.method, headers, redirect: 'manual', signal: request.signal };
            if (!['GET', 'HEAD'].includes(request.method)) { options.body = request.body; options.duplex = 'half'; }
            return fetch(destination, options);
        },
    };
}

export function createEnvironment(configuration = process.env) {
    const services = {};
    const specifications = {
        FAMA_SYSTEM: ['FAMA_INTERNAL_SYSTEM_URL', 'FAMA_SYSTEM_PUBLIC_URL'],
        FAMA_CONTROL: ['FAMA_INTERNAL_CONTROL_URL', 'FAMA_CONTROL_PUBLIC_URL'],
        FAMA_PYTHON_SERVICE: ['FAMA_INTERNAL_PYTHON_URL', 'FAMA_AI_PYTHON_URL'],
        BAILEYS_SERVICE: ['FAMA_INTERNAL_BAILEYS_URL', 'BAILEYS_SERVICE_URL'],
    };
    let bucket;
    return new Proxy({}, {
        get(_object, name) {
            if (name === 'DB') {
                const filename = resolve(configuration.FAMA_SQLITE_PATH || './data/fama.sqlite');
                if (!databases.has(filename)) databases.set(filename, new VpsSQLite(filename, { allowCreate: configuration.FAMA_ALLOW_EMPTY_DATABASE === 'true' }));
                return databases.get(filename);
            }
            if (name === 'BUCKET') {
                if (!configuration.FAMA_BACKUP_DIRECTORY) return undefined;
                bucket ??= new VpsBucket(configuration.FAMA_BACKUP_DIRECTORY);
                return bucket;
            }
            if (Object.hasOwn(specifications, name)) {
                const [internal, external] = specifications[name];
                if (!configuration[internal]) return undefined;
                services[name] ??= localService(configuration[internal], configuration[external]);
                return services[name];
            }
            return typeof name === 'string' ? configuration[name] : undefined;
        },
    });
}

export const env = createEnvironment();
