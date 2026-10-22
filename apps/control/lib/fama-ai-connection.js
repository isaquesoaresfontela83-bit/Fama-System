export function assistantProviderStatus(cloud) { return { configured: true, state: 'ready', engine: 'internal', ...(cloud ? { cloud } : {}) }; }
export function parseAssistantConnectionStatus(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Consulta indisponível.');
    const input = value;
    if (input.state !== 'ready' || input.configured !== true || input.engine !== 'internal')
        throw new Error('Consulta indisponível.');
    if (input.cloud === undefined)
        return assistantProviderStatus();
    const cloud = input.cloud;
    if (!cloud || Array.isArray(cloud) || !['cloudflare', 'local-python'].includes(cloud.provider) || !['awaiting_key', 'awaiting_account', 'disabled', 'ready', 'invalid_configuration'].includes(String(cloud.state))
        || typeof cloud.model !== 'string' || !/^@(?:cf|hf|local)\/[a-z0-9_-]+\/[a-z0-9._-]+$/.test(cloud.model))
        throw new Error('Consulta indisponível.');
    return assistantProviderStatus({ provider: cloud.provider, state: cloud.state, model: cloud.model });
}
const workersCloudLabels = {
    awaiting_key: { title: 'Workers AI aguardando configuração', description: 'A integração está preparada. O administrador da plataforma precisa configurar a chave no servidor.' },
    awaiting_account: { title: 'Workers AI aguardando conta', description: 'O administrador da plataforma precisa concluir a conexão da assistente no servidor.' },
    disabled: { title: 'Workers AI pausada', description: 'A conexão em nuvem está desativada. As consultas internas continuam disponíveis.' },
    ready: { title: 'Workers AI configurada', description: 'As perguntas e um resumo dos resultados autorizados são enviados ao Cloudflare para gerar sugestões. Confira as sugestões nos registros.' },
    invalid_configuration: { title: 'Configuração da Workers AI incompleta', description: 'O administrador da plataforma precisa revisar a configuração no servidor. As consultas internas continuam disponíveis.' },
};
export const assistantConnectionLabels = {
    ready: { title: 'Núcleo Fama disponível', description: 'Consultas aos registros autorizados pelo próprio sistema, sem provedor de IA externo.' },
    checking: { title: 'Verificando acesso…', description: 'Verificando as consultas da área atual.' },
    unavailable: { title: 'Consulta ao servidor indisponível', description: 'Confira sua conexão e tente novamente. Os registros já carregados continuam disponíveis.' },
};

export const assistantCloudLabels = ['vps','hybrid'].includes(process.env.NEXT_PUBLIC_FAMA_RUNTIME) ? {
    awaiting_key: { title: 'Fama IA aguardando configuração', description: 'Configure a conexão interna com o serviço Python no servidor.' },
    awaiting_account: { title: 'Fama IA aguardando servidor', description: 'Configure o endereço interno do serviço Python.' },
    disabled: { title: 'Geração de texto pausada', description: 'As consultas internas estão disponíveis. Ative o modelo local quando o servidor estiver preparado.' },
    ready: { title: 'Fama IA configurada na VPS', description: 'A geração usa o serviço Python e um modelo local. Confira as sugestões nos registros.' },
    invalid_configuration: { title: 'Configuração da Fama IA incompleta', description: 'Revise a conexão interna e o modelo instalado no servidor.' },
} : workersCloudLabels;
