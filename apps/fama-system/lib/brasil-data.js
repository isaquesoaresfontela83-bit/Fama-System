import catalog from './brasil-api-catalog.json';
export const brasilCatalog = catalog;
export function brasilEndpoint(id, parameters) {
    const entry = catalog.find(e => e.id === id);
    if (!entry)
        throw new Error('Escolha uma consulta disponível.');
    if (Object.keys(parameters).some(key => !entry.parameters.some(p => p.name === key)))
        throw new Error('Parâmetro de consulta não permitido.');
    let path = entry.path;
    const query = new URLSearchParams();
    for (const p of entry.parameters) {
        const value = String(parameters[p.name] ?? '').trim();
        if (!value) {
            if (p.required)
                throw new Error('Preencha ' + p.name + '.');
            continue;
        }
        if (value.length > 180 || /[\u0000-\u001f]/.test(value))
            throw new Error('Valor de consulta inválido.');
        if (p.options.length && !p.options.map(String).includes(value))
            throw new Error('Selecione uma opção válida.');
        if (p.where === 'path') {
            if (value === '.' || value === '..' || /[\\/#?]/.test(value))
                throw new Error('Valor de consulta inválido.');
            path = path.replace('{' + p.name + '}', encodeURIComponent(value));
        }
        else if (path.includes('?search={' + p.name + '}'))
            path = path.replace('{' + p.name + '}', encodeURIComponent(value));
        else
            query.set(p.name, value);
    }
    if (/\{/.test(path))
        throw new Error('Preencha os campos obrigatórios.');
    const url = new URL('https://brasilapi.com.br/api' + path);
    for (const [k, v] of query)
        url.searchParams.set(k, v);
    return { entry, url };
}
