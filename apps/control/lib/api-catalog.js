// Public inventory. Credentials, provider URLs supplied by users and customer data never belong here.
const both = ['system', 'control'], system = ['system'], control = ['control'];
export const apiCatalog = [
    { id: 'system-api', name: 'Fama System', category: 'Infraestrutura', scopes: system, usage: 'API dos módulos operacionais, documentos, agenda e financeiro.', endpoints: ['/api/health', '/api/records', '/api/finance'], management: 'health', probe: true },
    { id: 'control-api', name: 'Fama Control', category: 'Infraestrutura', scopes: control, usage: 'Administração de empresas, planos, permissões e integrações.', endpoints: ['/api/health', '/api/admin'], management: 'health', probe: true },
    { id: 'data-bridge', name: 'Conexão System ↔ Control', category: 'Infraestrutura', scopes: both, usage: 'Canal interno autenticado para dados, suporte e integrações.', endpoints: ['/api/internal/data', '/api/internal/integrations', '/api/internal/api-status'], management: 'health', probe: true },
    { id: 'supabase-auth', name: 'Supabase Auth', category: 'Infraestrutura', scopes: both, usage: 'Login, sessão, recuperação de acesso e autenticação.', endpoints: ['/auth/v1'], management: 'security' },
    { id: 'supabase-database', name: 'Supabase REST', category: 'Infraestrutura', scopes: both, usage: 'Dados das empresas e políticas de acesso.', endpoints: ['/rest/v1'], management: 'health', probe: true },
    { id: 'supabase-storage', name: 'Supabase Storage', category: 'Documentos', scopes: system, usage: 'Anexos e arquivos autorizados das empresas.', endpoints: ['/storage/v1'], management: 'health' },
    { id: 'supabase-functions', name: 'Supabase Edge Functions', category: 'Infraestrutura', scopes: both, usage: 'Compatibilidade com as conexões anteriores da plataforma.', endpoints: ['/functions/v1/fama-system-integrations', '/functions/v1/fama-control-admin'], management: 'integrations' },
    { id: 'cloudflare-d1', name: 'Cloudflare D1', category: 'Infraestrutura', scopes: both, usage: 'Configurações, operações locais e registros de segurança.', endpoints: ['Binding DB'], management: 'health', probe: true },
    { id: 'cloudflare-r2', name: 'Cloudflare R2', category: 'Infraestrutura', scopes: control, usage: 'Arquivos de backup da plataforma.', endpoints: ['Binding BUCKET'], management: 'security' },
    { id: 'drive', name: 'Google Drive', category: 'Documentos', scopes: control, usage: 'Cópia e consulta de documentos do System e da central do Control.', endpoints: ['/api/admin/integrations/documents', '/api/integrations/documents'], management: 'integrations', probe: true },
    { id: 'resend', name: 'Resend', category: 'Comunicação', scopes: control, usage: 'Envio de documentos por e-mail, com confirmação do destinatário.', endpoints: ['/api/integrations/documents', '/api/admin/integrations/actions'], management: 'integrations', probe: true },
    { id: 'sentry', name: 'Sentry', category: 'Segurança', scopes: control, usage: 'Registro técnico de falhas e consulta de ocorrências.', endpoints: ['/api/integrations/sentry', '/api/admin/integrations/actions'], management: 'integrations' },
    { id: 'ocrspace', name: 'OCR.space', category: 'Documentos', scopes: control, usage: 'Extração de texto de PDFs e imagens para revisão no sistema.', endpoints: ['/api/integrations/documents', '/api/admin/integrations/actions'], management: 'integrations' },
    { id: 'ipinfo', name: 'IPinfo', category: 'Segurança', scopes: control, usage: 'Consulta administrativa de país e rede de um IP; Lite ou modo público.', endpoints: ['/api/admin/integrations'], management: 'integrations', probe: true },
    { id: 'github', name: 'GitHub REST API', category: 'Administração', scopes: control, usage: 'Consulta de commits e versões do repositório no Control.', endpoints: ['/api/admin/integrations'], management: 'integrations', probe: true },
    { id: 'baileys', name: 'WhatsApp Baileys', category: 'Comunicação', scopes: control, usage: 'Servidor de WhatsApp e conexão por QR Code das empresas.', endpoints: ['/api/admin/baileys', '/api/internal/baileys', '/api/whatsapp/baileys'], management: 'integrations', probe: true },
    { id: 'meta-whatsapp', name: 'WhatsApp Cloud API (Meta)', category: 'Comunicação', scopes: system, usage: 'Conexão oficial cadastrada por empresa e recebimento de webhooks.', endpoints: ['/api/whatsapp', '/api/whatsapp/webhook'], management: 'companies' },
    { id: 'firebase', name: 'Firebase Cloud Messaging', category: 'Comunicação', scopes: system, usage: 'Notificações dos módulos nos dispositivos autorizados.', endpoints: ['/api/push'], management: 'health' },
    { id: 'google-calendar', name: 'Google Calendar', category: 'Agenda', scopes: system, usage: 'Disponibilidade e eventos da agenda da conta Google conectada pelo usuário.', endpoints: ['/api/agenda/google-calendar', 'calendar/v3'], management: 'companies' },
    { id: 'asaas-billing', name: 'Asaas · assinaturas', category: 'Financeiro', scopes: system, usage: 'Pagamento dos planos e confirmação das mensalidades da plataforma.', endpoints: ['/api/billing', '/api/billing/asaas-webhook'], management: 'finance', probe: true },
    { id: 'asaas-finance', name: 'Asaas · contas das empresas', category: 'Financeiro', scopes: system, usage: 'Saldos, extratos e conciliação das conexões financeiras de cada empresa.', endpoints: ['/api/asaas'], management: 'companies' },
    { id: 'asaas-fiscal', name: 'Asaas · NFS-e', category: 'Financeiro', scopes: system, usage: 'Emissão e atualização de notas com API fiscal configurada por empresa.', endpoints: ['/api/finance', '/api/finance/asaas-webhook'], management: 'companies' },
    { id: 'brasilapi', name: 'BrasilAPI', category: 'Consultas', scopes: system, usage: 'CEP, CNPJ, bancos e todas as consultas do catálogo de dados brasileiros.', endpoints: ['/api/brasil-data', '/api/registration-lookup'], management: 'health', probe: true },
    { id: 'receitaws', name: 'ReceitaWS', category: 'Consultas', scopes: system, usage: 'Consulta alternativa de CNPJ no cadastro.', endpoints: ['/api/registration-lookup'], management: 'health' },
    { id: 'awesomeapi', name: 'AwesomeAPI CEP', category: 'Mapas e rotas', scopes: system, usage: 'CEP e coordenadas para calcular frete, com alternativa pela BrasilAPI.', endpoints: ['/api/freight'], management: 'health' },
    { id: 'met-norway', name: 'MET Norway', category: 'Clima', scopes: system, usage: 'Previsão do tempo padrão para planejamento das operações.', endpoints: ['/api/operation-weather'], management: 'companies', probe: true },
    { id: 'open-meteo', name: 'Open-Meteo', category: 'Clima', scopes: system, usage: 'Previsão alternativa com conta comercial ou avaliação escolhida pela empresa.', endpoints: ['/api/operation-weather'], management: 'companies' },
    { id: 'openweather', name: 'OpenWeather', category: 'Clima', scopes: system, usage: 'Previsão alternativa com chave global ou da empresa.', endpoints: ['/api/operation-weather'], management: 'companies' },
    { id: 'openrouteservice', name: 'openrouteservice', category: 'Mapas e rotas', scopes: system, usage: 'Cálculo prioritário de rotas e fretes quando a chave está cadastrada.', endpoints: ['/api/freight'], management: 'health' },
    { id: 'brouter', name: 'BRouter', category: 'Mapas e rotas', scopes: system, usage: 'Rotas rodoviárias quando não há serviço de rotas dedicado.', endpoints: ['/api/freight'], management: 'health' },
    { id: 'osrm', name: 'OSRM dedicado', category: 'Mapas e rotas', scopes: system, usage: 'Alternativa de rotas em servidor próprio configurado pela plataforma.', endpoints: ['/api/freight'], management: 'health' },
    { id: 'overpass', name: 'OpenStreetMap Overpass', category: 'Mapas e rotas', scopes: system, usage: 'Busca de locais próximos no mapa das operações.', endpoints: ['/api/nearby-places'], management: 'health' },
    { id: 'osm-tiles', name: 'OpenStreetMap · mapas', category: 'Mapas e rotas', scopes: system, usage: 'Mapa padrão exibido dentro do sistema.', endpoints: ['tile.openstreetmap.org', 'openstreetmap.org/export/embed.html'], management: 'health' },
    { id: 'geoapify', name: 'Geoapify · mapas', category: 'Mapas e rotas', scopes: system, usage: 'Mapas alternativos quando a chave pública está cadastrada.', endpoints: ['/api/map-config'], management: 'health' },
    { id: 'waze', name: 'Waze · mapa integrado', category: 'Mapas e rotas', scopes: system, usage: 'Mapa incorporado; navegação depende do dispositivo.', endpoints: ['Embed e navegação Waze'], management: 'health' },
    { id: 'pwned-passwords', name: 'Pwned Passwords', category: 'Segurança', scopes: both, usage: 'Verificação de senhas expostas por prefixo de hash, sem enviar a senha.', endpoints: ['api.pwnedpasswords.com/range'], management: 'security' },
    { id: 'workers-ai', name: 'Fama IA · Python / Workers AI', category: 'IA', scopes: both, usage: 'Geração opcional de sugestões pelo serviço Python e Workers AI.', endpoints: ['Serviço FAMA_PYTHON_SERVICE', '/v1/generate'], management: 'ai-settings' },
    { id: 'local-ai', name: 'Fama IA local e voz', category: 'IA', scopes: both, usage: 'Modelos e recursos de voz executados no dispositivo do usuário.', endpoints: ['WebGPU / WASM / APIs do navegador'], management: 'ai-settings' },
    { id: 'model-downloads', name: 'Hugging Face · modelos', category: 'IA', scopes: both, usage: 'Download dos modelos públicos fixados para execução local.', endpoints: ['huggingface.co/{modelo}/resolve/{revisão}'], management: 'ai-settings' },
    { id: 'scanner', name: 'Ponte local de digitalização', category: 'Documentos', scopes: system, usage: 'Scanner instalado no computador, com autorização local do usuário.', endpoints: ['127.0.0.1:17843/status', '127.0.0.1:17843/scan'], management: 'companies' },
    { id: 'pool-bridge', name: 'Fama Pool · conexão de serviços', category: 'Infraestrutura', scopes: system, usage: 'Ponte de pagamentos e encaminhamento de webhooks para o serviço de piscinas.', endpoints: ['/api/pool-provider', '/api/pool-provider/webhook'], management: 'health' },
];
export const apiScopeLabels = { system: 'Fama System', control: 'Fama Control' };
export const apiStatusLabels = { verified: 'Conexão verificada', configured: 'Configurada · não testada', public: 'Sem chave · não testada', unconfigured: 'Não configurada', paused: 'Pausada', unavailable: 'Sem resposta', unknown: 'Não conferida', device: 'Depende do dispositivo', company: 'Conexão por empresa', standby: 'Em reserva', mixed: 'Status diferentes' };
export const apiCategories = [...new Set(apiCatalog.map(item => item.category))];

// Stable integration IDs keep saved settings compatible across hosting targets.
if (['vps','hybrid'].includes(process.env.NEXT_PUBLIC_FAMA_RUNTIME)) {
    const storage = apiCatalog.find(item => item.id === 'cloudflare-d1');
    storage.name = 'SQLite da VPS'; storage.endpoints = ['Banco persistente local'];
    const backup = apiCatalog.find(item => item.id === 'cloudflare-r2');
    backup.name = 'Backups na VPS'; backup.endpoints = ['Volume privado de backups'];
    const model = apiCatalog.find(item => item.id === 'workers-ai');
    model.name = 'Fama IA · Python na VPS'; model.usage = 'Geração opcional pelo serviço Python e modelo local.';
}

if (process.env.NEXT_PUBLIC_FAMA_RUNTIME === 'hybrid') {
    const storage=apiCatalog.find(item=>item.id==='cloudflare-d1');
    storage.name='Supabase · configurações persistentes';storage.endpoints=['PostgreSQL privado'];
    const backup=apiCatalog.find(item=>item.id==='cloudflare-r2');
    backup.name='Supabase · backups privados';backup.endpoints=['Storage privado'];
    const model=apiCatalog.find(item=>item.id==='workers-ai');
    model.name='Fama IA · serviço Python opcional';model.usage='A geração no servidor depende de um serviço Python configurado; o plano gratuito não inclui modelo contínuo.';
}
