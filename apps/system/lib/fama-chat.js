export const chatStatusLabels = { received: 'Recebida', sending: 'Enviando', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Não enviada', uncertain: 'Confirmação pendente' };
export function chatReplyWindow(lastInboundAt, now = Date.now()) {
    const received = lastInboundAt ? Date.parse(lastInboundAt) : NaN;
    return Number.isFinite(received) && received <= now + 300_000 && now - received < 24 * 3600_000;
}
