export function normalizeOperationForecast(raw, now = new Date()) {
    const value = raw;
    if (!value || !Array.isArray(value.list) || !value.city || !Number.isFinite(value.city.coord?.lat) || !Number.isFinite(value.city.coord?.lon))
        throw new Error('Previsão inválida.');
    const offset = Number.isFinite(value.city.timezone) ? value.city.timezone : 0;
    const slots = value.list.filter((item) => Number.isFinite(item.dt) && Number.isFinite(item.main?.temp) && item.dt * 1000 >= now.getTime() - 3 * 3600000).slice(0, 40).map((item) => ({
        periodHours: 3, at: new Date(item.dt * 1000).toISOString(), date: new Date((item.dt + offset) * 1000).toISOString().slice(0, 10), temperature: item.main.temp,
        rainChance: Math.round(Math.max(0, Math.min(1, Number(item.pop) || 0)) * 100), windKmh: Math.round(Math.max(0, Number(item.wind?.speed) || 0) * 3.6),
        description: typeof item.weather?.[0]?.description === 'string' ? item.weather[0].description.slice(0, 120) : 'Condição não informada', storm: item.weather?.some((weather) => weather.id >= 200 && weather.id < 300) ?? false,
    }));
    if (!slots.length)
        throw new Error('Previsão sem dados recentes.');
    const days = [...new Set(slots.map(slot => slot.date))].slice(0, 5).map(date => { const daily = slots.filter(slot => slot.date === date); return { date, min: Math.min(...daily.map(slot => slot.temperature)), max: Math.max(...daily.map(slot => slot.temperature)), rainChance: Math.max(...daily.map(slot => slot.rainChance)), windKmh: Math.max(...daily.map(slot => slot.windKmh)), storm: daily.some(slot => slot.storm) }; });
    return { city: String(value.city.name ?? 'Local selecionado').slice(0, 100), latitude: value.city.coord.lat, longitude: value.city.coord.lon, updatedAt: now.toISOString(), slots, days };
}
export function appointmentWeatherRisk(startAt, forecast) {
    const time = new Date(startAt).getTime();
    if (!Number.isFinite(time))
        return null;
    const nearest = [...forecast.slots].sort((a, b) => Math.abs(new Date(a.at).getTime() - time) - Math.abs(new Date(b.at).getTime() - time))[0];
    if (!nearest || Math.abs(new Date(nearest.at).getTime() - time) > 3 * 3600000)
        return null;
    return { ...nearest, risk: nearest.rainChanceKnown === false && nearest.precipitationMm === undefined ? 'unknown' : nearest.storm ? 'storm' : nearest.rainChance >= 60 || (nearest.precipitationMm ?? 0) >= .5 ? 'rain' : nearest.windKmh >= 40 ? 'wind' : 'normal' };
}
