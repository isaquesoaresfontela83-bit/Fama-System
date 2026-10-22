export const LOCATION_SEARCH_MS = 45_000;
const MAX_SAMPLE_AGE_MS = 10_000;
const TARGET_ACCURACY_METERS = 25;
export const MAX_ACCEPTED_ACCURACY_METERS = 100;
/** Collect fresh fixes briefly so a first network estimate can improve. */
export function searchDeviceLocation(geolocation, callbacks) {
    let active = true;
    let watchId = null;
    let best = null;
    let lastError = '';
    const stop = () => {
        active = false;
        globalThis.clearTimeout(timer);
        if (watchId !== null) {
            geolocation.clearWatch(watchId);
            watchId = null;
        }
    };
    const finish = (message) => {
        if (!active)
            return;
        stop();
        if (message)
            callbacks.onError(message);
        else
            callbacks.onComplete();
    };
    const timer = globalThis.setTimeout(() => finish(best && best.accuracy !== null && best.accuracy <= MAX_ACCEPTED_ACCURACY_METERS ? undefined : lastError || 'A localização demorou para responder. Verifique o GPS e tente novamente.'), LOCATION_SEARCH_MS);
    try {
        const id = geolocation.watchPosition(next => {
            if (!active)
                return;
            const { latitude, longitude, accuracy } = next.coords;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
                lastError = 'O dispositivo retornou uma localização inválida. Tente novamente.';
                return;
            }
            const age = Date.now() - next.timestamp;
            if (!Number.isFinite(next.timestamp) || next.timestamp <= 0 || age > MAX_SAMPLE_AGE_MS || age < -5_000) {
                lastError = 'O dispositivo retornou uma localização desatualizada. Verifique o GPS e tente novamente.';
                return;
            }
            const candidate = { latitude, longitude, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null, timestamp: next.timestamp };
            if (!best || candidate.timestamp >= best.timestamp && ((candidate.accuracy ?? Infinity) <= (best.accuracy ?? Infinity))) {
                best = candidate;
                if (candidate.accuracy !== null && candidate.accuracy <= MAX_ACCEPTED_ACCURACY_METERS)
                    callbacks.onPosition(candidate);
                else {
                    callbacks.onApproximate?.(candidate);
                    lastError = 'A posição do aparelho está imprecisa' + (candidate.accuracy !== null ? ' (margem de ' + Math.ceil(candidate.accuracy).toLocaleString('pt-BR') + ' m)' : '') + '. Ative a localização precisa do navegador e tente novamente em um local aberto.';
                }
            }
            if (best?.accuracy !== null && best?.accuracy !== undefined && best.accuracy <= TARGET_ACCURACY_METERS)
                finish();
        }, failure => {
            if (!active)
                return;
            if (failure.code === 1)
                finish('Permita a localização nas configurações do navegador e tente novamente.');
            else
                lastError = failure.code === 3 ? 'A localização demorou para responder. Tente novamente.' : 'Não foi possível obter a posição. Verifique o GPS e tente novamente.';
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
        // Also clean up implementations that call a callback synchronously.
        if (active)
            watchId = id;
        else
            geolocation.clearWatch(id);
    }
    catch {
        finish('Não foi possível acessar a localização. Verifique o GPS e tente novamente.');
    }
    return stop;
}
