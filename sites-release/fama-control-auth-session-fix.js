// Fama Control — patch de sessão para ChatGPT Sites/WebView
// Substitui apenas o bloco antigo:
// function tok(){return sessionStorage.getItem('fc_access')||''}
// function ref(){return sessionStorage.getItem('fc_refresh')||''}
// function setSession(a='',r=''){...}
//
// Objetivo: o login NÃO pode depender de sessionStorage para continuar.

let fcAccessToken = '';
let fcRefreshToken = '';

function safeSessionRead(key) {
  try {
    return window.sessionStorage?.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSessionWrite(key, value) {
  try {
    if (!window.sessionStorage) return;
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // WebViews podem bloquear storage. A sessão em memória continua válida.
  }
}

function tok() {
  return fcAccessToken || safeSessionRead('fc_access');
}

function ref() {
  return fcRefreshToken || safeSessionRead('fc_refresh');
}

function setSession(access = '', refresh = '') {
  fcAccessToken = access || '';
  fcRefreshToken = refresh || '';
  safeSessionWrite('fc_access', fcAccessToken);
  safeSessionWrite('fc_refresh', fcRefreshToken);
}

async function refreshToken() {
  const currentRefresh = ref();
  if (!currentRefresh) return false;

  try {
    const response = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        apikey: KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: currentRefresh })
    });

    let json = {};
    try { json = await response.json(); } catch {}

    if (!response.ok || !json.access_token) return false;
    setSession(json.access_token, json.refresh_token || currentRefresh);
    return true;
  } catch {
    return false;
  }
}

async function api(action, data = {}, retry = true) {
  const access = tok();
  if (!access) throw new Error('Sessão ausente. Entre novamente.');

  let response;
  try {
    response = await fetch(API, {
      method: 'POST',
      headers: {
        apikey: KEY,
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + access
      },
      body: JSON.stringify({ action, ...data })
    });
  } catch {
    throw new Error('Não foi possível conectar à API do Fama Control.');
  }

  let json = {};
  try { json = await response.json(); } catch {}

  if (response.status === 401 && retry && await refreshToken()) {
    return api(action, data, false);
  }

  if (response.status === 401) {
    showLogin();
    throw new Error(json.message || 'Sessão expirada. Entre novamente.');
  }

  if (!response.ok || !json.ok) {
    throw new Error(json.message || ('Falha no Fama Control (' + response.status + ').'));
  }

  return json.data ?? json;
}

async function login(email, password) {
  let response;
  try {
    response = await fetch(SUPA + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        apikey: KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
  } catch {
    throw new Error('Não foi possível conectar ao Supabase Auth.');
  }

  let json = {};
  try { json = await response.json(); } catch {}

  if (!response.ok || !json.access_token) {
    if (response.status === 429) {
      throw new Error('Muitas tentativas. Aguarde alguns minutos.');
    }
    throw new Error(json.msg || json.message || json.error_description || 'E-mail ou senha inválidos.');
  }

  // Mantém o token em memória imediatamente; storage é apenas fallback opcional.
  setSession(json.access_token, json.refresh_token || '');

  // Chama o backend antes de qualquer dependência adicional de storage.
  await loadBootstrap();
  showApp();
}
