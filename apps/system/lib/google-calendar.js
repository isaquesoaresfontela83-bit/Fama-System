export const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.freebusy';
export function calendarWeek(week) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isFinite(Date.parse(week + 'T12:00:00Z')) || new Date(week + 'T12:00:00Z').toISOString().slice(0, 10) !== week)
        throw new Error('Semana inválida.');
    return { timeMin: week + 'T00:00:00-03:00', timeMax: new Date(Date.parse(week + 'T00:00:00-03:00') + 7 * 86400000).toISOString() };
}
export function readGoogleBusy(raw, week, technician, now = Date.now()) {
    const calendar = raw?.calendars?.primary;
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy) || calendar.busy.length > 500)
        throw new Error('Não foi possível consultar todos os horários ocupados do Google.');
    const intervals = calendar.busy.map((b) => { if (typeof b.start !== 'string' || typeof b.end !== 'string' || !Number.isFinite(Date.parse(b.start)) || !Number.isFinite(Date.parse(b.end)) || Date.parse(b.end) <= Date.parse(b.start))
        throw new Error('O Google retornou um horário inválido.'); return { from: b.start, to: b.end }; });
    return { week, technician, checkedAt: now, intervals };
}
export function appointmentEvent(a, duration) {
    if (!Number.isInteger(duration) || duration < 15 || duration > 480)
        throw new Error('Informe uma duração de 15 a 480 minutos.');
    const start = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(a.startAt) ? a.startAt + '-03:00' : a.startAt;
    if (!Number.isFinite(Date.parse(start)))
        throw new Error('Atendimento com horário inválido.');
    return { summary: `Fama · ${a.title}`.slice(0, 300), location: a.address || '', description: `Cliente: ${a.clientName}\nTécnico: ${a.technician}\nEnviado pelo Fama System. Revise alterações e cancelamentos no Google Calendar.`, start: { dateTime: new Date(start).toISOString(), timeZone: 'America/Sao_Paulo' }, end: { dateTime: new Date(Date.parse(start) + duration * 60000).toISOString(), timeZone: 'America/Sao_Paulo' }, transparency: 'opaque', reminders: { useDefault: true } };
}
export async function calendarEventId(organizationId, appointmentId) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fama-calendar-v1:' + organizationId + ':' + appointmentId)); return 'fama' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); }
export function calendarIcs(appointments, organizationId, duration) {
    const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
    const stamp = (s) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fama System//Agenda//PT-BR', 'CALSCALE:GREGORIAN'];
    for (const a of appointments) {
        const e = appointmentEvent(a, duration);
        lines.push('BEGIN:VEVENT', `UID:${escape(encodeURIComponent(organizationId) + '.' + encodeURIComponent(a.id))}@famasystem.online`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(e.start.dateTime)}`, `DTEND:${stamp(e.end.dateTime)}`, `SUMMARY:${escape(e.summary)}`, `LOCATION:${escape(e.location)}`, `DESCRIPTION:${escape(e.description)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // Fold by UTF-8 octets, keeping Unicode characters intact (RFC 5545).
    return lines.map(line => { let out = '', size = 0; for (const char of line) {
        const n = new TextEncoder().encode(char).length;
        if (size + n > 73) {
            out += '\r\n ';
            size = 1;
        }
        out += char;
        size += n;
    } return out; }).join('\r\n') + '\r\n';
}
