import { disableVerification, verifiedFactors } from './mfa-flow-15.23.28.mjs';

const buttonClass = 'water-mfa-disable-button';
let activeTarget = null;
let loadingTarget = null;
let displayedFactors = [];
let dialog = null;
let targetSignature = '';

function findTarget() {
 const control = document.querySelector('section.control-panel[aria-label="Verificação em duas etapas"]');
 if (control) return control;
 return [...document.querySelectorAll('.privacy-security-card .privacy-actions article')]
  .find(article => article.querySelector('strong')?.textContent.trim() === 'Verificação em duas etapas') ?? null;
}

function statusText(target) {
 return target.querySelector('p')?.textContent.trim() ?? '';
}

function ensureButton() {
 if (!activeTarget?.isConnected || !displayedFactors.length || activeTarget.querySelector('.' + buttonClass)) return;
 const button = document.createElement('button');
 button.type = 'button';
 button.className = buttonClass;
 button.textContent = 'Desativar';
 button.setAttribute('aria-label', 'Desativar verificação em duas etapas');
 button.addEventListener('click', () => void openDialog());
 activeTarget.append(button);
}

async function refreshTarget(target) {
 loadingTarget = target;
 try {
  const factors = await verifiedFactors();
  if (findTarget() !== target) return;
  activeTarget = target;
  targetSignature = statusText(target);
  displayedFactors = factors;
  const oldButton = target.querySelector('.' + buttonClass);
  if (!factors.length) oldButton?.remove();
  else ensureButton();
 } catch {
  // The existing account-security panel reports its own loading/auth errors.
  if (findTarget() === target) {
   activeTarget = target;
   targetSignature = statusText(target);
   displayedFactors = [];
  }
 } finally {
  if (loadingTarget === target) loadingTarget = null;
 }
}

function scan() {
 const target = findTarget();
 if (!target) {
  activeTarget = null;
  targetSignature = '';
  displayedFactors = [];
  return;
 }
 if (target !== activeTarget || statusText(target) !== targetSignature) {
  if (target !== loadingTarget) void refreshTarget(target);
 } else ensureButton();
}

function closeDialog() {
 if (!dialog) return;
 const closing = dialog;
 dialog = null;
 const previous = document.querySelector('.' + buttonClass);
 if (closing.open && typeof closing.close === 'function') closing.close();
 closing.remove();
 if (closing.dataset.refreshOnClose) window.location.reload();
 else previous?.focus();
}

async function openDialog() {
 if (dialog) return;
 const trigger = activeTarget?.querySelector('.' + buttonClass);
 if (trigger) trigger.disabled = true;
 let factors;
 try {
  factors = await verifiedFactors();
  displayedFactors = factors;
  if (!factors.length) {
   trigger?.remove();
   window.location.reload();
   return;
  }
 } catch {
  window.alert('Não foi possível conferir os autenticadores. Tente novamente.');
  return;
 } finally {
  if (trigger?.isConnected) trigger.disabled = false;
 }
 dialog = document.createElement('dialog');
 dialog.className = 'water-mfa-dialog';
 dialog.setAttribute('aria-labelledby', 'water-mfa-title');
 dialog.innerHTML = `<form class="water-mfa-form"><h2 id="water-mfa-title">Desativar verificação em duas etapas?</h2>
  <p>Depois da desativação, sua conta deixará de pedir o código do autenticador ao entrar. Se a mesma conta for usada no Water System e no Water Control, a mudança valerá nos dois.</p>
  <div class="water-mfa-factor" hidden><label for="water-mfa-factor">Autenticador para confirmar</label><select id="water-mfa-factor" name="factor"></select></div>
  <label for="water-mfa-code">Código do aplicativo autenticador</label><input id="water-mfa-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required placeholder="000000">
  <p class="water-mfa-error" role="alert" hidden></p><div class="water-mfa-actions"><button type="button" data-cancel>Cancelar</button><button type="submit" data-submit>Confirmar desativação</button></div></form>`;
 const form = dialog.querySelector('form');
 const select = dialog.querySelector('select');
 const error = dialog.querySelector('.water-mfa-error');
 const input = dialog.querySelector('input');
 const cancel = dialog.querySelector('[data-cancel]');
 const submit = dialog.querySelector('[data-submit]');
 const supported = factors.every(factor => factor.type === 'totp');
 for (const [index, factor] of factors.entries()) {
  const option = document.createElement('option');
  option.value = factor.id;
  option.textContent = factors.length > 1 ? `${factor.name || 'Autenticador'} ${index + 1}` : factor.name || 'Autenticador';
  if (index === 0) option.selected = true;
  select.append(option);
 }
 if (factors.length > 1) dialog.querySelector('.water-mfa-factor').hidden = false;
 if (!supported) {
  error.textContent = 'Esta conta possui outro tipo de verificação. Procure o suporte para alterar esses métodos com segurança.';
  error.hidden = false;
  input.disabled = true;
  submit.disabled = true;
 }
 let busy = false;
 const openedDialog = dialog;
 dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) closeDialog(); });
 dialog.addEventListener('close', () => { if (dialog === openedDialog) closeDialog(); });
 cancel.addEventListener('click', () => { if (!busy) closeDialog(); });
 form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !supported) return;
  busy = true;
  error.hidden = true;
  input.disabled = true;
  select.disabled = true;
  submit.disabled = true;
  cancel.disabled = true;
  submit.textContent = 'Confirmando…';
  try {
   await disableVerification({ factors, factorId: select.value, code: input.value });
   input.value = '';
   form.querySelector('h2').textContent = 'Verificação em duas etapas desativada';
   form.querySelector('p').textContent = 'A alteração foi salva nesta conta.';
   form.querySelector('.water-mfa-factor').hidden = true;
   form.querySelector('label[for="water-mfa-code"]').hidden = true;
   input.hidden = true;
   submit.hidden = true;
   cancel.disabled = false;
   cancel.textContent = 'Concluir';
   displayedFactors = [];
   activeTarget?.querySelector('.' + buttonClass)?.remove();
   dialog.dataset.refreshOnClose = 'true';
  } catch (cause) {
   error.textContent = cause instanceof Error ? cause.message : 'Não foi possível desativar a verificação. Tente novamente.';
   error.hidden = false;
   input.value = '';
   input.disabled = false;
   select.disabled = false;
   submit.disabled = false;
   cancel.disabled = false;
   input.focus();
  } finally {
   busy = false;
   submit.textContent = 'Confirmar desativação';
  }
 });
 document.body.append(dialog);
 if (typeof dialog.showModal === 'function') dialog.showModal();
 else dialog.setAttribute('open', '');
 if (supported) input.focus();
 else cancel.focus();
}

function start() {
 scan();
 let queued = false;
 new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; scan(); });
 }).observe(document.body, { childList: true, characterData: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
