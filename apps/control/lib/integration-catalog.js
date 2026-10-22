// Shared public contract. Provider credentials are configured only in the backend.
export const integrationProviders = [
    { id: 'drive', statusKey: 'google_drive', name: 'Google Drive', scope: 'system', description: 'Cópia de documentos para a pasta configurada.', url: 'https://console.cloud.google.com/apis/credentials' },
    { id: 'sentry', statusKey: 'sentry', name: 'Sentry', scope: 'system', description: 'Registro técnico de falhas, sem dados dos clientes.', url: 'https://sentry.io/settings/' },
    { id: 'ocrspace', statusKey: 'ocr_space', name: 'OCR.space', scope: 'system', description: 'Leitura de texto de PDFs e imagens digitalizados.', url: 'https://ocr.space/ocrapi' },
    { id: 'ipinfo', statusKey: 'ipinfo_lite', name: 'IPinfo Lite', scope: 'control', description: 'Consulta administrativa do país e da rede de um IP.', url: 'https://ipinfo.io/dashboard/token' },
    { id: 'github', statusKey: 'github_rest', name: 'GitHub REST API', scope: 'control', description: 'Consulta administrativa das alterações do repositório.', url: 'https://github.com/isaquesoaresfontela83-bit/Fama-System' },
];
export const defaultFamaRepository = 'isaquesoaresfontela83-bit/Fama-System';
export function repositoryValid(value) {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value) && !value.includes('..');
}
