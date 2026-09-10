/*
 * Fama Control — autenticação nativa do ChatGPT Sites
 *
 * Este patch substitui o login por e-mail/senha do Supabase no frontend.
 * Pré-requisito: o Site deve proteger a página com /signin-with-chatgpt e publicar
 * app/api/fama-control/chatgpt-session/route.ts na mesma origem.
 *
 * O endpoint server-side valida o e-mail autenticado pelo ChatGPT contra
 * fama_control_admins / owner ativo e cria uma sessão Supabase sem expor a chave
 * administrativa ao navegador. O restante do painel continua usando as mesmas
 * funções Supabase Edge existentes.
 */

let fcAccessToken = "";
let fcRefreshToken = "";

function safeSessionGet(key) {
  try { return sessionStorage.getItem(key) || ""; } catch { return ""; }
}

function safeSessionSet(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {}
}

function tok() {
  return fcAccessToken || safeSessionGet("fc_access");
}

function ref() {
  return fcRefreshToken || safeSessionGet("fc_refresh");
}

function setSession(access = "", refresh = "") {
  fcAccessToken = access || "";
  fcRefreshToken = refresh || "";
  safeSessionSet("fc_access", fcAccessToken);
  safeSessionSet("fc_refresh", fcRefreshToken);
}

async function getChatGPTSupabaseSession() {
  let response;
  try {
    response = await fetch("/api/fama-control/chatgpt-session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new Error("Não foi possível iniciar a sessão do Fama Control.");
  }

  let json = {};
  try { json = await response.json(); } catch {}

  if (response.status === 401) {
    window.location.assign("/signin-with-chatgpt?return_to=%2F");
    throw new Error("Entrando com ChatGPT...");
  }

  if (!response.ok || !json.access_token) {
    throw new Error(json.message || "A conta do ChatGPT não está autorizada para o Fama Control.");
  }

  setSession(json.access_token, json.refresh_token || "");
  return json;
}

async function refreshToken() {
  try {
    await getChatGPTSupabaseSession();
    return true;
  } catch {
    return false;
  }
}

async function api(action, data = {}, retry = true) {
  if (!tok()) await getChatGPTSupabaseSession();

  let response;
  try {
    response = await fetch(API, {
      method: "POST",
      headers: {
        apikey: KEY,
        "Content-Type": "application/json",
        Authorization: "Bearer " + tok(),
        "x-access-token": tok(),
      },
      body: JSON.stringify({ action, ...data, access_token: tok() }),
    });
  } catch {
    throw new Error("Não foi possível conectar à API do Fama Control.");
  }

  let json = {};
  try { json = await response.json(); } catch {}

  if (response.status === 401 && retry && await refreshToken()) {
    return api(action, data, false);
  }

  if (!response.ok || !(json.ok || json.success || json.authorized)) {
    throw new Error(json.message || `Falha no Fama Control (${response.status}).`);
  }

  return json.data || json;
}

async function loginWithChatGPT() {
  const button = document.querySelector("#loginBtn");
  const message = document.querySelector("#loginMsg");
  if (message) message.textContent = "";
  if (button) {
    button.disabled = true;
    button.textContent = "Conectando com ChatGPT...";
  }

  try {
    await getChatGPTSupabaseSession();
    await loadBootstrap();
    showApp();
  } catch (error) {
    if (message) message.textContent = error?.message || "Não foi possível entrar.";
    if (button) {
      button.disabled = false;
      button.textContent = "Entrar com ChatGPT →";
    }
  }
}

function installChatGPTLoginUI() {
  const login = document.querySelector("#login");
  if (!login) return;

  const lead = login.querySelector(".lead");
  if (lead) {
    lead.textContent = "Use sua conta do ChatGPT. O acesso ao painel continua restrito ao proprietário autorizado.";
  }

  login.querySelectorAll(".field, #eye, #firstAccess").forEach((node) => {
    node.style.display = "none";
  });

  const button = document.querySelector("#loginBtn");
  if (button) {
    button.type = "button";
    button.textContent = "Entrar com ChatGPT →";
    button.onclick = loginWithChatGPT;
  }

  const note = login.querySelector(".security-note, .security");
  if (note) {
    note.textContent = "Sessão autenticada pelo ChatGPT Sites e autorização administrativa confirmada no Supabase.";
  }
}

installChatGPTLoginUI();
loginWithChatGPT();
