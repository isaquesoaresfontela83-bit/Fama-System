export const emptyData = {
    leads: [],
    quotes: [],
    appointments: [],
    workOrders: [],
    customers: [],
    inventory: [],
    transactions: [],
    employees: [],
    warranties: [],
    contracts: [],
};
/** Validate both server snapshots and browser snapshots before rendering. */
export function parseBootstrapData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Os registros não puderam ser conferidos.');
    const input = value;
    const collections = Object.keys(emptyData).map(key => {
        const rows = input[key];
        if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
            throw new Error('Os registros não puderam ser conferidos.');
        return [key, rows];
    });
    return Object.fromEntries(collections);
}
