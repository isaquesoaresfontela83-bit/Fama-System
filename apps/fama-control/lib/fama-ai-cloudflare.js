import { env } from 'cloudflare:workers';
import { assistantProviderStatus } from './fama-ai-connection';
import { cleanLocalNarrative } from './fama-ai-local';

const defaultModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const text = value => typeof value === 'string' ? value.trim() : '';
const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) && Number(value) >= min ? Math.min(Math.floor(Number(value)), max) : fallback;
function configuration() {
  const token = text(env.FAMA_AI_PYTHON_TOKEN);
  const endpoint = text(env.FAMA_AI_PYTHON_URL);
  const model = text(env.FAMA_AI_MODEL) || defaultModel;
  let valid = /^@(?:cf|hf)\/[a-z0-9_-]+\/[a-z0-9._-]+$/.test(model) && (!token || token.length >= 32) && !/[\r\n\0]/.test(token);
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      valid &&= url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash;
    } catch { valid = false; }
  }
  const state = !valid ? 'invalid_configuration' : !token ? 'awaiting_key' : !endpoint ? 'awaiting_account' : env.FAMA_AI_GENERATIVE_ENABLED !== 'true' ? 'disabled' : 'ready';
  return { token, endpoint, model, state, maxTokens: bounded(env.FAMA_AI_MAX_TOKENS, 1024, 128, 2048), timeout: bounded(env.FAMA_AI_TIMEOUT_MS, 20_000, 1000, 30_000) };
}
/** Configuration only. Model prompts, inference and validation run in Python. */
export function cloudflareConnectionStatus() {
  const config = configuration();
  return assistantProviderStatus({ provider: 'cloudflare', state: config.state, model: config.state === 'invalid_configuration' ? defaultModel : config.model });
}
async function readBoundedJson(response) {
  if (!response.headers.get('content-type')?.startsWith('application/json') || !response.body) throw new Error('Invalid Python response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64_000) { await reader.cancel(); throw new Error('Python response too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function requestPython(config, path, body, signal) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeout);
  try {
    // Endpoint and credential are server configuration, never browser input.
    const send = env.FAMA_PYTHON_SERVICE?.fetch ? env.FAMA_PYTHON_SERVICE.fetch.bind(env.FAMA_PYTHON_SERVICE) : fetch;
    const response = await send(new URL(path, config.endpoint).href, {
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Fama-System/1.0', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify(body),
    });
    const payload = await readBoundedJson(response);
    if (!response.ok || payload?.state !== 'ready') return { state: payload?.state === 'invalid_response' ? 'invalid_response' : 'unavailable', httpStatus: response.status };
    if (typeof payload.response !== 'string' || !payload.response.trim() || payload.response.includes(config.token)) return { state: 'invalid_response' };
    return { state: 'ready', response: payload.response, httpStatus: response.status };
  } catch {
    return { state: 'unavailable', failure: timedOut ? 'timeout' : 'network' };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
/** Only authorized summaries cross the Python boundary. Records and actions remain in Fama. */
export async function enrichWithCloudflare(input, answer, signal) {
  const config = configuration();
  if (config.state !== 'ready' || signal?.aborted) return answer;
  const evidence = { source: answer.source, text: answer.text.slice(0, 12_000), ...(answer.note ? { note: answer.note.slice(0, 1000) } : {}) };
  const result = await requestPython(config, '/v1/generate', {
    question: input.question.slice(0, 2000), history: input.history.slice(-4).map(q => q.slice(0, 500)), evidence, maxTokens: config.maxTokens,
  }, signal);
  if (result.state !== 'ready') return { ...answer, cloudState: result.state };
  const narrative = cleanLocalNarrative(result.response, evidence.text);
  if (!narrative) return { ...answer, cloudState: 'invalid_response' };
  return { ...answer, cloudNarrative: narrative, cloudState: 'ready', engine: 'cloudflare' };
}
export async function testCloudflareConnection(signal) {
  const config = configuration();
  const metadata = { provider: 'cloudflare', model: config.state === 'invalid_configuration' ? defaultModel : config.model };
  if (config.state !== 'ready' || signal?.aborted) return { ...metadata, ok: false, state: config.state };
  const result = await requestPython(config, '/v1/connection-test', {}, signal);
  const sample = result.response ? cleanLocalNarrative(result.response, '').slice(0, 200) : '';
  return { ...metadata, ok: result.state === 'ready' && !!sample, state: result.state === 'ready' && !sample ? 'invalid_response' : result.state,
    httpStatus: result.httpStatus, ...(sample ? { sample } : {}), ...(result.failure ? { failure: result.failure } : {}) };
}
