import { OrderError } from './model.mjs';

/** Bound both bytes and elapsed time, including bodies sent without Content-Length. */
export async function readBoundedText(request, limit, timeoutMs = 10_000) {
  const announced = request.headers.get('content-length');
  if (announced !== null && (!/^\d+$/.test(announced) || !Number.isSafeInteger(Number(announced)))) {
    throw new OrderError('Tamanho da solicitação inválido.');
  }
  if (Number(announced || 0) > limit) throw new OrderError('Arquivo ou pedido muito grande.', 413);
  if (!request.body) throw new OrderError('Dados ausentes.');
  const reader = request.body.getReader();
  let timer, abort;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new OrderError('Tempo excedido ao receber a solicitação.', 408)), timeoutMs);
    abort = () => reject(new OrderError('A solicitação foi interrompida.', 400));
    request.signal.addEventListener('abort', abort, {once:true});
    if (request.signal.aborted) abort();
  });
  try {
    const chunks = []; let size = 0;
    for (;;) {
      const {done, value} = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new OrderError('Arquivo ou pedido muito grande.', 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
    catch { throw new OrderError('O texto enviado não é UTF-8 válido.'); }
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof OrderError) throw error;
    throw new OrderError('Não foi possível ler a solicitação.');
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

export async function readJsonObject(request, limit = 70_000) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new OrderError('Envie os dados em JSON.', 415);
  }
  const raw = await readBoundedText(request, limit);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new OrderError('Os dados enviados são inválidos.'); }
}
