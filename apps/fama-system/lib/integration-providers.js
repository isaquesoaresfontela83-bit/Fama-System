export const fiscalProviders = [
    { id: "asaas", label: "Asaas - NFS-e automática" },
    { id: "portal_nacional", label: "Portal nacional NFS-e — sem API" },
    { id: "portal_municipal", label: "Emissor da prefeitura — sem API" },
    { id: "portal_estadual", label: "Emissor da SEFAZ (NF-e) — sem API" },
    { id: "none", label: "Não conectado" },
];
export function isFiscalProvider(value) {
    return fiscalProviders.some(provider => provider.id === value);
}
