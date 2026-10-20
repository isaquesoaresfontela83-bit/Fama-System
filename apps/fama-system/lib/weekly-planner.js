const stamp = (date, minutes) => `${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00-03:00`;
const overlaps = (a, b, c, d) => a < d && b > c;
export function validateWeeklyRules(value) {
    const v = value;
    const integer = (n, min, max) => Number.isInteger(n) && Number(n) >= min && Number(n) <= max;
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.week) || !Number.isFinite(Date.parse(v.week + 'T12:00:00Z')) || new Date(v.week + 'T12:00:00Z').toISOString().slice(0, 10) !== v.week || new Date(v.week + 'T12:00:00Z').getUTCDay() !== 1 || !integer(v.start, 0, 1439) || !integer(v.end, 1, 1440) || v.end <= v.start || !integer(v.lunchStart, v.start, v.end) || !integer(v.lunchEnd, v.lunchStart, v.end) || !integer(v.buffer, 0, 120) || !integer(v.fixedDuration, 15, 480) || !integer(v.fixedTravel, 0, 180) || !Array.isArray(v.jobs) || !v.jobs.length || v.jobs.length > 25 || new Set(v.jobs.map(j => j?.id)).size !== v.jobs.length)
        throw new Error('Confira a semana (segunda-feira), jornada, almoço e até 25 serviços.');
    for (const j of v.jobs)
        if (!j || typeof j.id !== 'string' || !integer(j.duration, 15, 480) || !integer(j.travel, 0, 180) || typeof j.outdoor !== 'boolean' || !integer(j.earliest, 0, 1439) || !integer(j.latest, 1, 1440) || j.latest <= j.earliest || !integer(j.priority, 1, 3))
            throw new Error('Confira duração, deslocamento e disponibilidade de cada serviço.');
    if (v.weatherPoint && (!Number.isFinite(v.weatherPoint.latitude) || Math.abs(v.weatherPoint.latitude) > 90 || !Number.isFinite(v.weatherPoint.longitude) || Math.abs(v.weatherPoint.longitude) > 180))
        throw new Error('Local de previsão inválido.');
    if (v.googleBusy) {
        const g = v.googleBusy;
        if (g.week !== v.week || typeof g.technician !== 'string' || !g.technician.trim() || g.technician.length > 200 || !Number.isFinite(g.checkedAt) || g.checkedAt > Date.now() + 30000 || Date.now() - g.checkedAt > 300000 || !Array.isArray(g.intervals) || g.intervals.length > 500 || g.intervals.some(b => !b || typeof b.from !== 'string' || typeof b.to !== 'string' || !Number.isFinite(Date.parse(b.from)) || !Number.isFinite(Date.parse(b.to)) || Date.parse(b.to) <= Date.parse(b.from)))
            throw new Error('Consulte novamente a disponibilidade do Google Calendar.');
    }
    return v;
}
export function proposeWeek(appointments, input, forecast = null, now = new Date()) {
    const rules = validateWeeklyRules(input), selected = new Set(rules.jobs.map(j => j.id)), byId = new Map(appointments.map(a => [a.id, a]));
    const result = { suggestions: [], unplaced: [], warnings: ['Nesta proposta, deslocamentos são estimativas manuais; não incluem trânsito em tempo real.', 'Compromissos não selecionados permanecem fixos. A duração deles usa o parâmetro informado.', 'O retorno à base e folgas individuais ainda precisam de conferência manual.'], fixedCount: 0 };
    if (!forecast)
        result.warnings.push('Sem previsão do tempo disponível: nenhuma condição climática foi presumida.');
    else
        result.warnings.push('Clima do ponto de referência; confirme o local do cliente antes de reagendar.');
    const busy = [];
    for (const a of appointments) {
        if (selected.has(a.id) || ['cancelado', 'concluido'].includes(a.status))
            continue;
        const from = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(a.startAt) ? a.startAt + '-03:00' : a.startAt);
        if (Number.isFinite(from) && from < Date.parse(stamp(new Date(Date.parse(rules.week + 'T12:00:00Z') + 7 * 86400000).toISOString().slice(0, 10), 0)) && from + (rules.fixedDuration + rules.buffer) * 60000 > Date.parse(stamp(rules.week, 0))) {
            busy.push({ tech: a.technician, from: from - rules.fixedTravel * 60000, to: from + (rules.fixedDuration + rules.buffer) * 60000 });
            result.fixedCount++;
        }
    }
    if (rules.googleBusy) {
        for (const b of rules.googleBusy.intervals)
            busy.push({ tech: rules.googleBusy.technician, from: Date.parse(b.from), to: Date.parse(b.to) });
        result.warnings.push('Horários ocupados do Google considerados apenas para ' + rules.googleBusy.technician + '. Outros técnicos e agendas Google não foram consultados. Eventos já copiados ao Google também bloqueiam o horário.');
    }
    else
        result.warnings.push('Disponibilidade Google não consultada nesta proposta.');
    const jobs = [...rules.jobs].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const j of jobs) {
        const a = byId.get(j.id);
        if (!a || !['agendado', 'remarcado'].includes(a.status) || !a.technician?.trim()) {
            result.unplaced.push({ id: j.id, reason: 'Selecione um atendimento agendado ou remarcado com técnico definido.' });
            continue;
        }
        const candidates = [];
        for (let day = 0; day < 5; day++) {
            const date = new Date(rules.week + 'T12:00:00Z');
            date.setUTCDate(date.getUTCDate() + day);
            const key = date.toISOString().slice(0, 10);
            for (let minute = Math.max(rules.start + j.travel, j.earliest); minute + j.duration + rules.buffer <= Math.min(rules.end, j.latest); minute += 15) {
                const startAt = stamp(key, minute), from = Date.parse(startAt), to = from + j.duration * 60000, departure = from - j.travel * 60000, finish = to + rules.buffer * 60000;
                if (departure < now.getTime() || overlaps(departure, finish, Date.parse(stamp(key, rules.lunchStart)), Date.parse(stamp(key, rules.lunchEnd))) || busy.some(b => (!b.tech || b.tech === a.technician) && overlaps(departure, finish, b.from, b.to)))
                    continue;
                let weather = 'unknown';
                const slots = forecast?.slots.filter(s => { const at = Date.parse(s.at); return at <= to && at + (s.periodHours ?? 3) * 3600000 > from; }) || [];
                if (slots.length) {
                    let covered = from;
                    for (const s of [...slots].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
                        const t = Date.parse(s.at);
                        if (t <= covered)
                            covered = Math.max(covered, t + (s.periodHours ?? 3) * 3600000);
                    }
                    const risk = slots.some(s => s.storm || s.rainChance >= 60 || (s.precipitationMm ?? 0) >= .5 || s.windKmh >= 40);
                    weather = risk ? 'risk' : covered >= to && slots.every(s => s.rainChanceKnown !== false || typeof s.precipitationMm === 'number') ? 'favorable' : 'unknown';
                    if (j.outdoor && risk)
                        continue;
                }
                const load = busy.filter(b => b.tech === a.technician && b.from >= Date.parse(stamp(key, 0)) && b.from < Date.parse(stamp(key, 1440))).length;
                const score = (j.outdoor && weather === 'unknown' ? 1000 : 0) + load * 120 + day * 10 + minute / 1440;
                candidates.push({ score, from: departure, to: finish, item: { id: a.id, startAt, endAt: new Date(to).toISOString(), technician: a.technician, duration: j.duration, travel: j.travel, weather, reasons: [`${j.duration} min de execução, ${j.travel} min de deslocamento antes e ${rules.buffer} min de margem.`, weather === 'favorable' ? 'Sem risco elevado na previsão de referência.' : weather === 'risk' ? 'Atividade interna; previsão de referência com risco.' : 'Horário sem cobertura de previsão: confirmar clima.', `Disponibilidade do cliente: ${stamp(key, j.earliest).slice(11, 16)}–${stamp(key, j.latest).slice(11, 16)}.`] } });
            }
        }
        candidates.sort((a, b) => a.score - b.score || a.from - b.from);
        const best = candidates[0];
        if (!best) {
            result.unplaced.push({ id: a.id, reason: 'Nenhum horário atende jornada, almoço, compromissos fixos, clima disponível e janela do cliente.' });
            continue;
        }
        result.suggestions.push(best.item);
        busy.push({ tech: a.technician, from: best.from, to: best.to });
    }
    result.suggestions.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.technician.localeCompare(b.technician));
    return result;
}
