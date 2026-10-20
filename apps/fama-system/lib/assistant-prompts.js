import { assistantSources } from './fama-ai-settings';
export function safePrompts(value, allowed) { if (!Array.isArray(value))
    return []; return value.filter((row) => Boolean(row && typeof row === 'object' && typeof row.question === 'string' && row.question.length >= 3 && row.question.length <= 2000 && typeof row.source === 'string' && Object.hasOwn(assistantSources, row.source) && allowed.includes(row.source) && typeof row.at === 'string' && Number.isFinite(Date.parse(row.at)))).slice(0, 12); }
export function rememberPrompt(previous, question, source) { return [{ question, source, at: new Date().toISOString() }, ...previous.filter(item => item.question !== question || item.source !== source)].slice(0, 12); }
