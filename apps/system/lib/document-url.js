export function documentUrl(entity, id, organizationId) {
    const query = new URLSearchParams({ entity, organization_id: organizationId });
    return `/api/documents/${encodeURIComponent(id)}?${query}`;
}
