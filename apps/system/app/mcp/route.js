import { metNorwayForecast } from '@/lib/met-norway';
import { openRouteConfigured } from '@/lib/openroute-service';
import { cloudflareConnectionStatus } from '@/lib/fama-ai-cloudflare';
import { env } from 'cloudflare:workers';
import { readJsonObject } from '@/lib/request-body';
import { firebaseConfiguration } from '@/lib/firebase-push';
import { runPushReminderBatch } from '@/lib/push-reminders';
import { isBackupRequest } from '@/lib/backup-auth';
const tools = [
    { name: 'integration_status', description: 'Read central Firebase, AI, free weather and route configuration. Owner only; returns no secrets or customer records.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
    { name: 'check_weather_connection', description: 'Verify free MET Norway forecast using public Brasilia coordinates, returning only connection status and forecast coverage. Does not use customer locations.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
    { name: 'reminder_status', description: 'Check whether Fama automatic push reminders are configured. Returns no customer data.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
    { name: 'dispatch_due_reminders', description: 'Send due Fama push reminders to subscribed devices. Server enforces membership, plans, permissions, categories, quiet hours and deduplication. Only the Site owner can call this tool.', inputSchema: { type: 'object', properties: { cursor: { type: 'string', maxLength: 250 } }, additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
];
export async function POST(request) {
    let id = null;
    const reply = (value) => Response.json({ jsonrpc: '2.0', id, result: value }, { headers: { 'Cache-Control': 'private, no-store' } });
    const fail = (code, message) => Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { headers: { 'Cache-Control': 'private, no-store' } });
    try {
        const input = await readJsonObject(request, 4096);
        id = input.id ?? null;
        if (input.method === 'server/discover')
            return reply({ supportedVersions: ['2026-07-28'], capabilities: { tools: {} } });
        if (input.method === 'tools/list')
            return reply({ tools });
        if (input.method !== 'tools/call')
            return fail(-32601, 'Method not found');
        if (!await isBackupRequest(request))
            return fail(-32001, 'Server authentication is required.');
        const params = input.params;
        if (params?.name === 'integration_status')
            return reply({ content: [{ type: 'text', text: JSON.stringify({ firebase: !!firebaseConfiguration(), ai: cloudflareConnectionStatus().cloud?.state, weather: { provider: 'MET Norway', configured: true, keyRequired: false }, openrouteservice: { configured: openRouteConfigured(), keyRequired: true }, overpass: { configured: true, keyRequired: false }, googleCalendar: { configured: /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(String(env.FAMA_GOOGLE_CALENDAR_CLIENT_ID || '').trim()), perUserConsent: true } }) }] });
        if (params?.name === 'check_weather_connection') {
            const forecast = await metNorwayForecast(-15.7939, -47.8828, 'Brasília · teste público');
            return reply({ content: [{ type: 'text', text: JSON.stringify({ provider: 'MET Norway', connected: true, updatedAt: forecast.updatedAt, days: forecast.days.length, slots: forecast.slots.length }) }] });
        }
        if (params?.name === 'reminder_status')
            return reply({ content: [{ type: 'text', text: JSON.stringify({ configured: !!firebaseConfiguration() }) }] });
        if (params?.name !== 'dispatch_due_reminders')
            return fail(-32602, 'Unknown tool');
        const args = params.arguments || {};
        const cursor = args.cursor ?? '';
        if (typeof cursor !== 'string' || cursor.length > 250 || /[\u0000-\u001f]/.test(cursor) || Object.keys(args).some(key => key !== 'cursor'))
            return fail(-32602, 'Invalid cursor');
        const result = await runPushReminderBatch(cursor);
        return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: 'failed' in result && Number(result.failed) > 0 });
    }
    catch {
        return reply({ content: [{ type: 'text', text: 'The reminder batch could not complete.' }], isError: true });
    }
}
