const prefix = 'fama-confirmed-map-v1:';
export function readConfirmedPoint(storage, organizationId, appointmentId = '') {
    try {
        const point = JSON.parse(storage?.getItem(prefix + organizationId + ':' + appointmentId) || 'null');
        if (!point || point.source !== 'manual' || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 85 || Math.abs(point.longitude) > 180 || point.appointmentId !== (appointmentId || undefined))
            return null;
        return { latitude: point.latitude, longitude: point.longitude, source: 'manual', address: 'Ponto confirmado por você no mapa', ...(appointmentId ? { appointmentId } : {}) };
    }
    catch {
        return null;
    }
}
export function saveConfirmedPoint(storage, organizationId, point) { try {
    storage?.setItem(prefix + organizationId + ':' + (point.appointmentId || ''), JSON.stringify({ latitude: point.latitude, longitude: point.longitude, source: 'manual', ...(point.appointmentId ? { appointmentId: point.appointmentId } : {}) }));
}
catch { /* A full or unavailable browser store must not block confirmation. */ } }
