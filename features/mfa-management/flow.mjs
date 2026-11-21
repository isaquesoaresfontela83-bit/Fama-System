const endpoint = '/api/auth/mfa';
const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(id);

async function request(body) {
 const response = await fetch(endpoint, body === undefined
  ? { credentials: 'same-origin', cache: 'no-store' }
  : { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 const data = await response.json().catch(() => ({}));
 if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível alterar a verificação em duas etapas.');
 return data;
}

export async function verifiedFactors() {
 const result = await request();
 if (!result.available || !Array.isArray(result.factors)) throw new Error('Não foi possível conferir os autenticadores desta conta.');
 const factors = result.factors.filter(factor => factor.status === 'verified');
 if (factors.some(factor => !safeId(factor.id)) || new Set(factors.map(factor => factor.id)).size !== factors.length) {
  throw new Error('Não foi possível identificar os autenticadores desta conta.');
 }
 return factors.map(factor => ({ id: factor.id, type: factor.type, name: typeof factor.name === 'string' ? factor.name : 'Autenticador' }));
}

const fingerprint = factors => JSON.stringify(factors.map(({ id, type }) => [id, type]).sort((a, b) => a[0].localeCompare(b[0])));

export async function disableVerification({ factors, factorId, code }) {
 if (!Array.isArray(factors) || !factors.length || factors.some(factor => factor.type !== 'totp')) {
  throw new Error('Esta conta possui um método que não pode ser desativado por esta tela.');
 }
 if (!safeId(factorId) || !factors.some(factor => factor.id === factorId)) throw new Error('Selecione um autenticador válido.');
 const cleaned = String(code ?? '').replace(/\s/g, '');
 if (!/^\d{6,10}$/.test(cleaned)) throw new Error('Informe o código do aplicativo autenticador.');
 const current = await verifiedFactors();
 if (fingerprint(current) !== fingerprint(factors)) throw new Error('Os autenticadores foram alterados. Feche a janela e tente novamente.');
 const challenge = await request({ action: 'challenge', factorId });
 if (!safeId(challenge.challengeId)) throw new Error('Não foi possível confirmar o autenticador.');
 const verified = await request({ action: 'verify', factorId, challengeId: challenge.challengeId, code: cleaned });
 if (verified.verified !== true) throw new Error('O código não foi confirmado.');
 const beforeRemoval = await verifiedFactors();
 if (fingerprint(beforeRemoval) !== fingerprint(current)) throw new Error('Os autenticadores foram alterados. Feche a janela e tente novamente.');
 try {
  for (const factor of beforeRemoval) {
   const result = await request({ action: 'unenroll', factorId: factor.id });
   if (result.removed !== true) throw new Error('Não foi possível remover o autenticador.');
  }
  const remaining = await verifiedFactors();
  if (remaining.length) throw new Error('Ainda há autenticadores ativos.');
 } catch {
  throw new Error('A desativação não terminou como esperado. Feche esta janela e confira o status antes de tentar novamente.');
 }
}
