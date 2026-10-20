/** Display FCM data messages while the page is visible; Firebase only displays background messages. */
export async function displayForegroundPush(data, organizationId, environment = {
    permission: () => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    registration: () => navigator.serviceWorker.getRegistration('/fama-notifications/'),
}) {
    if (!data || data.organizationId !== organizationId)
        return false;
    if (environment.permission() !== 'granted')
        throw new Error('Mensagem recebida, mas as notificações deste navegador não estão permitidas.');
    const registration = await environment.registration();
    if (!registration)
        throw new Error('Mensagem recebida, mas o serviço de notificações não está ativo. Ative novamente neste aparelho.');
    await registration.showNotification(data.title || 'Fama System', { body: data.body || 'Você tem uma atualização no Fama.', icon: '/fama-piscinas-mark.png', tag: data.eventId || 'fama-update', data: { url: '/' } });
    return true;
}
