import { decryptRecordFields, encryptedFieldsByEntity } from './crypto';
import { camelizeRow, selectRows } from './supabase';
import { hasFeaturePermission } from './permissions';
const collections = [
    ['leads', 'leads', 'crm'], ['quotes', 'quotes', 'quotes'], ['appointments', 'appointments', 'agenda'],
    ['workOrders', 'work_orders', 'orders'], ['customers', 'customers', 'customers'], ['inventory', 'inventory_items', 'inventory'],
    ['transactions', 'transactions', 'finance'], ['employees', 'employees', 'team'], ['warranties', 'warranties', 'warranties'], ['contracts', 'contracts', 'contracts'],
];
export async function whatsappAssistantData(organizationId, role, permissions, settings, moduleAccess) {
    const entries = await Promise.all(collections.filter(([, , source]) => hasFeaturePermission(role, permissions, source, moduleAccess) && settings.sources[source]).map(async ([entity, table]) => {
        const rows = await selectRows(table, { organization_id: organizationId });
        return [entity, await Promise.all(rows.map(row => decryptRecordFields(camelizeRow(row), encryptedFieldsByEntity[entity] || [])))];
    }));
    return Object.fromEntries(entries);
}
