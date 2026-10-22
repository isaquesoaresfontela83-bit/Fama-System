// Public form definitions only. Credential values never belong in this module.
export const integrationFields = {
    drive: [
        { id: 'clientId', label: 'Identificador do aplicativo Google', secret: false },
        { id: 'clientSecret', label: 'Segredo do aplicativo Google', secret: true },
        { id: 'refreshToken', label: 'Autorização salva do Google (opcional ao conectar)', secret: true },
        { id: 'folderId', label: 'Identificador da pasta de documentos', secret: false },
    ],
    sentry: [{ id: 'dsn', label: 'Conexão de monitoramento (DSN)', secret: true }, { id: 'apiToken', label: 'Token de leitura de erros (opcional)', secret: true }, { id: 'organization', label: 'Organização no Sentry (opcional)', secret: false }, { id: 'projectId', label: 'Número do projeto no Sentry (opcional)', secret: false }],
    ocrspace: [{ id: 'apiKey', label: 'Chave de leitura de documentos', secret: true }],
    ipinfo: [{ id: 'token', label: 'Token IPinfo Lite (opcional)', secret: true }],
    github: [{ id: 'token', label: 'Token GitHub (opcional para repositório público)', secret: true }, { id: 'repository', label: 'Proprietário/repositório', secret: false }],
};
export const integrationRequirements = {
    drive: ['clientId', 'clientSecret', 'refreshToken', 'folderId'],
    sentry: ['dsn'], ocrspace: ['apiKey'], ipinfo: [], github: [],
};
export const integrationActions = {
    drive_upload: 'drive', drive_list: 'drive',
    ocr_extract: 'ocrspace', sentry_capture: 'sentry', sentry_issues: 'sentry',
    ipinfo_lookup: 'ipinfo', ipinfo_lite_lookup: 'ipinfo', github_rest_get: 'github',
};
