import { isLocalModelDownload, localAiModels, localAiRuntimeRevision } from './fama-ai-local';
// Keep the library's original cache and pinned URLs so previous downloads are reused.
export const localAiModelCache = 'transformers-cache';
export const localAiAssetCache = 'fama-ai-assets-v1';
export { localAiRuntimeRevision } from './fama-ai-local';
const preferenceKey = 'fama-ai-local-enabled-v1';
const automaticKey = 'fama-ai-auto-prepare-v1';
export const localAiStorageWarning = 'O navegador não conseguiu salvar todos os arquivos. Libere espaço e prepare novamente para manter a IA ao reabrir.';
// Metadata inspections must not leave weight/runtime streams unread.
export function releaseLocalAiResponse(response) { if (response?.body && !response.bodyUsed)
    void response.body.cancel().catch(() => undefined); }
const modelPrefix = (kind) => `https://huggingface.co/${localAiModels[kind].id}/resolve/${localAiModels[kind].revision}/`;
const manifestUrl = (kind, origin) => `${origin}/fama-ai-cache/installed/${kind}/${localAiModels[kind].revision}.json`;
const runtimeKey = (url, origin) => `${origin}/fama-ai-cache/runtime/${localAiRuntimeRevision}/${new URL(url).pathname.split('/').at(-1)}`;
const requiredLegacyFiles = {
    language: ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_q4f16.onnx'],
    speech: ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'preprocessor_config.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'],
};
export function readLocalAiEnabled() {
    try {
        return window.localStorage.getItem(preferenceKey) === 'true';
    }
    catch {
        return false;
    }
}
export function writeLocalAiEnabled(value) {
    try {
        window.localStorage.setItem(preferenceKey, String(value));
    }
    catch { /* Model files remain independent of preferences. */ }
}
export function hasLocalAiEnabledPreference() {
    try {
        return window.localStorage.getItem(preferenceKey) !== null;
    }
    catch {
        return false;
    }
}
export function readLocalAiAutomatic() {
    try {
        return window.localStorage.getItem(automaticKey) !== 'false';
    }
    catch {
        return true;
    }
}
export function writeLocalAiAutomatic(value) {
    try {
        window.localStorage.setItem(automaticKey, String(value));
    }
    catch { /* Storage errors are reported when saving model files. */ }
}
export async function protectLocalAiStorage() {
    try {
        if (await navigator.storage?.persisted?.())
            return true;
        return await navigator.storage?.persist?.() ?? false;
    }
    catch {
        return false;
    }
}
async function openCaches() {
    if (typeof caches === 'undefined')
        throw new Error('Armazenamento indisponível.');
    const [models, assets] = await Promise.all([caches.open(localAiModelCache), caches.open(localAiAssetCache)]);
    return { models, assets };
}
export async function inspectLocalAiInstallation(kind, origin) {
    try {
        const { models, assets } = await openCaches();
        const manifest = await assets.match(manifestUrl(kind, origin));
        if (manifest) {
            const value = await manifest.json();
            const model = localAiModels[kind];
            if (value.version === 1 && value.model === model.id && value.revision === model.revision && value.runtime === localAiRuntimeRevision && Array.isArray(value.assets) && value.assets.length > 0 && value.assets.length < 100) {
                const valid = await Promise.all(value.assets.map(async (item) => {
                    if (![200, 404].includes(item.status) || !isLocalModelDownload(item.url, origin))
                        return false;
                    const runtime = new URL(item.url).origin === origin;
                    if (!runtime && !item.url.startsWith(modelPrefix(kind)))
                        return false;
                    const cache = runtime || item.status === 404 ? assets : models;
                    const response = await cache.match(runtime ? runtimeKey(item.url, origin) : item.url);
                    const valid = response?.status === item.status;
                    releaseLocalAiResponse(response);
                    return valid;
                }));
                // A marker alone is never proof of a complete installation.
                if (valid.every(Boolean) && value.assets.some(item => item.status === 200 && item.url.endsWith('.onnx')))
                    return { saved: true };
            }
            return { saved: false, partial: true };
        }
        // Downloads made before the installation manifest existed stay usable.
        const present = await Promise.all(requiredLegacyFiles[kind].map(file => models.match(modelPrefix(kind) + file)));
        for (const response of present)
            releaseLocalAiResponse(response);
        if (present.every(response => response?.status === 200))
            return { saved: true, legacy: true };
        const keys = await models.keys();
        return { saved: false, partial: keys.some(key => key.url.startsWith(modelPrefix(kind))) };
    }
    catch {
        return { saved: false, unavailable: true };
    }
}
/** Public model assets only. No prompts, audio, records, cookies or credentials. */
export function createLocalAiCache(origin, download) {
    let current = 'speech';
    let cacheOnly = false;
    let restoreRuntime = false;
    let failed = false;
    let observed = new Map();
    const track = (url, status) => { observed.set(url, { url, status }); };
    const validModelUrl = (url) => isLocalModelDownload(url, origin) && url.startsWith(modelPrefix(current));
    const modelCache = {
        async match(url) {
            if (!validModelUrl(url))
                return undefined;
            try {
                const response = await (await openCaches()).models.match(url);
                if (response?.status === 200) {
                    track(url, 200);
                    return response;
                }
            }
            catch {
                failed = true;
            }
            return undefined;
        },
        async put(url, response) {
            if (!validModelUrl(url) || response.status !== 200)
                throw new Error('Arquivo de modelo inválido.');
            try {
                await (await openCaches()).models.put(url, response);
                track(url, 200);
            }
            catch {
                failed = true;
            }
        },
    };
    return {
        modelCache,
        begin(kind, onlySaved = false, legacyRuntime = false) { current = kind; cacheOnly = onlySaved; restoreRuntime = legacyRuntime; failed = false; observed = new Map(); },
        async checkWritable() {
            try {
                await (await openCaches()).assets.put(`${origin}/fama-ai-cache/storage-check`, Response.json({ available: true }));
            }
            catch {
                throw new Error(localAiStorageWarning);
            }
        },
        async fetch(url, init) {
            const runtime = new URL(url).origin === origin;
            const key = runtime ? runtimeKey(url, origin) : url;
            if (init.method === 'HEAD') {
                if (cacheOnly)
                    throw new Error('Arquivo local indisponível.');
                return download(url, init);
            }
            // The model loader reads positive responses through modelCache. WASM and
            // immutable optional 404s need their own cache to avoid repeat downloads.
            try {
                const response = await (await openCaches()).assets.match(key);
                if (response && (runtime ? response.status === 200 : response.status === 404)) {
                    track(url, response.status);
                    return response;
                }
            }
            catch {
                failed = true;
            }
            if (cacheOnly && runtime && !restoreRuntime)
                throw new Error('Arquivo local indisponível.');
            // A miss during restoration must not poison the cache with a synthetic
            // 404. The loader may treat it as optional; a required miss fails loading.
            if (cacheOnly && !runtime)
                return new Response(null, { status: 404 });
            const response = await download(url, init);
            if (runtime && response.status === 200) {
                try {
                    const cache = (await openCaches()).assets;
                    // Consume the network stream once. clone() would buffer its entire
                    // unused branch while Cache.put reads a potentially large WASM file.
                    await cache.put(key, response);
                    track(url, 200);
                    const cached = await cache.match(key);
                    if (!cached)
                        throw new Error(localAiStorageWarning);
                    return cached;
                }
                catch {
                    failed = true;
                    if (response.bodyUsed)
                        throw new Error(localAiStorageWarning);
                }
            }
            else if (response.status === 404) {
                try {
                    await (await openCaches()).assets.put(key, new Response(null, { status: 404 }));
                    track(url, 404);
                }
                catch {
                    failed = true;
                }
            }
            return response;
        },
        async installFile(url, onProgress) {
            const runtime = new URL(url).origin === origin;
            if (!isLocalModelDownload(url, origin) || !runtime && !validModelUrl(url))
                throw new Error('Arquivo local inválido.');
            const cached = runtime ? await (await openCaches()).assets.match(runtimeKey(url, origin)) : await modelCache.match(url);
            if (cached?.status === 200) {
                track(url, 200);
                onProgress(100);
                return cached;
            }
            const response = await this.fetch(url, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer' });
            if (response.status === 404)
                return response;
            if (response.status !== 200 || !response.body)
                throw new Error('O download não foi concluído.');
            if (runtime) {
                onProgress(100);
                return response;
            }
            const total = Number(response.headers.get('Content-Length'));
            let loaded = 0;
            let reported;
            let reportedAt = 0;
            const stream = response.body.pipeThrough(new TransformStream({ transform(chunk, controller) {
                    loaded += chunk.byteLength;
                    const percent = total > 0 ? Math.min(100, Math.round(loaded / total * 100)) : null;
                    const now = Date.now();
                    if (percent !== reported || percent === null && now - reportedAt >= 500) {
                        reported = percent;
                        reportedAt = now;
                        onProgress(percent);
                    }
                    controller.enqueue(chunk);
                } }));
            await modelCache.put(url, new Response(stream, { status: response.status, headers: response.headers }));
            const saved = await modelCache.match(url);
            if (!saved || failed)
                throw new Error(localAiStorageWarning);
            onProgress(100);
            return saved;
        },
        async complete() {
            if (failed || ![...observed.values()].some(item => item.status === 200 && item.url.endsWith('.onnx')))
                return false;
            const model = localAiModels[current];
            const manifest = { version: 1, model: model.id, revision: model.revision, runtime: localAiRuntimeRevision, assets: [...observed.values()] };
            try {
                await (await openCaches()).assets.put(manifestUrl(current, origin), Response.json(manifest));
                return (await inspectLocalAiInstallation(current, origin)).saved;
            }
            catch {
                return false;
            }
        },
    };
}
