function description(code) { if (code === 0)
    return 'Céu limpo'; if (code <= 3)
    return 'Parcialmente nublado'; if (code === 45 || code === 48)
    return 'Nevoeiro'; if (code >= 95)
    return 'Trovoadas'; if (code >= 71 && code <= 77 || code === 85 || code === 86)
    return 'Neve'; if (code >= 80)
    return 'Pancadas de chuva'; if (code >= 51)
    return 'Chuva'; return 'Condição não informada'; }
export function normalizeOpenMeteo(raw, label = 'Local selecionado', now = new Date()) {
    const v = raw, h = v?.hourly;
    if (!v || !Number.isFinite(v.latitude) || !Number.isFinite(v.longitude) || !Array.isArray(h?.time))
        throw new Error('Previsão inválida.');
    const offset = Number.isFinite(v.utc_offset_seconds) ? v.utc_offset_seconds : 0;
    const slots = h.time.flatMap((time, i) => {
        const temp = h.temperature_2m?.[i], rain = h.precipitation_probability?.[i], wind = h.wind_speed_10m?.[i], code = h.weather_code?.[i];
        if (!Number.isFinite(time) || !Number.isFinite(temp) || !Number.isFinite(rain) || !Number.isFinite(wind) || time * 1000 < now.getTime())
            return [];
        return [{ periodHours: 1, at: new Date(time * 1000).toISOString(), date: new Date((time + offset) * 1000).toISOString().slice(0, 10), temperature: temp, rainChance: Math.round(Math.max(0, Math.min(100, rain))), windKmh: Math.round(Math.max(0, wind)), description: description(code), storm: [95, 96, 99].includes(code) }];
    }).slice(0, 120);
    if (!slots.length)
        throw new Error('Previsão sem dados recentes.');
    const days = [...new Set(slots.map(s => s.date))].slice(0, 5).map(date => { const day = slots.filter(s => s.date === date); return { date, min: Math.min(...day.map(s => s.temperature)), max: Math.max(...day.map(s => s.temperature)), rainChance: Math.max(...day.map(s => s.rainChance)), windKmh: Math.max(...day.map(s => s.windKmh)), storm: day.some(s => s.storm) }; });
    return { city: label.slice(0, 100), latitude: v.latitude, longitude: v.longitude, updatedAt: now.toISOString(), slots, days };
}
