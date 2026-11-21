// Bottom navigation delegates to the Control's existing menu and actions.
const shortcuts = [
  { id: 'overview', label: 'Início', accessible: 'Ir para visão geral' },
  { id: 'companies', label: 'Empresas', accessible: 'Ir para empresas e usuários' },
  { id: 'new', label: 'Novo', accessible: 'Criar nova empresa' },
  { id: 'finance', label: 'Financeiro', accessible: 'Ir para financeiro' },
  { id: 'more', label: 'Mais', accessible: 'Abrir menu de administração' },
];

export function installControlDock(doc, win) {
  if (win.__waterControlDockInstalled) return win.__waterControlDockInstalled;
  let shell = null, dock = null, frame = 0, timer = 0, statusTimer = 0, disposed = false, pendingNew = false;
  const buttons = new Map();
  const source = id => shell?.querySelector(`.control-sidebar .control-nav-item[href="#${id}"]`);
  const menuTrigger = () => shell?.querySelector('.control-menu-trigger[aria-label="Abrir menu"]');
  const setAttribute = (node, name, value) => {
    if (value == null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
    else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  };
  function icon(type) {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
    const path = doc.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', type === 'new' ? 'M12 5v14M5 12h14' : 'M5 12h.01M12 12h.01M19 12h.01');
    if (type === 'more') path.setAttribute('stroke-width', '4');
    svg.append(path);
    return svg;
  }
  function announce(message) {
    const status = dock?.querySelector('[role="status"]');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    win.clearTimeout(statusTimer);
    if (message) statusTimer = win.setTimeout(() => { status.textContent = ''; status.hidden = true; }, 5000);
  }
  function activate(id) {
    if (!shell?.isConnected) return;
    win.clearTimeout(timer);
    pendingNew = false;
    if (id === 'more') { menuTrigger()?.click(); return; }
    const target = source(id === 'new' ? 'companies' : id);
    if (!target || target.getAttribute('aria-disabled') === 'true') return;
    target.click();
    if (id !== 'new') return;
    pendingNew = true;
    const started = Date.now();
    function openCreate() {
      if (!shell?.isConnected || !pendingNew) return;
      const action = [...shell.querySelectorAll('#companies button')].find(button => button.textContent.trim() === 'Nova empresa');
      if (action && !action.disabled) { pendingNew = false; action.click(); return; }
      if (Date.now() - started < 8000) timer = win.setTimeout(openCreate, 100);
      else { pendingNew = false; announce('Não foi possível abrir o cadastro. Acesse Empresas e usuários para tentar novamente.'); }
    }
    openCreate();
  }
  function createDock() {
    const nav = doc.createElement('nav');
    nav.className = 'water-control-dock';
    nav.setAttribute('aria-label', 'Navegação rápida do Water Control');
    for (const item of shortcuts) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = item.id === 'new' ? 'water-control-dock-new' : '';
      button.setAttribute('aria-label', item.accessible);
      button.setAttribute('data-control-dock', item.id);
      const symbol = source(item.id)?.querySelector('svg')?.cloneNode(true) || icon(item.id === 'new' ? 'new' : 'more');
      symbol.setAttribute('aria-hidden', 'true');
      if (item.id === 'new') { const wrap = doc.createElement('span'); wrap.className = 'water-control-dock-plus'; wrap.append(symbol); button.append(wrap); }
      else button.append(symbol);
      const text = doc.createElement('span'); text.className = 'water-control-dock-label'; text.textContent = item.label; button.append(text);
      button.addEventListener('click', () => activate(item.id));
      buttons.set(item.id, button);
      nav.append(button);
    }
    const status = doc.createElement('span');
    status.className = 'water-control-dock-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    nav.append(status);
    doc.body.append(nav);
    return nav;
  }
  function sync() {
    frame = 0;
    const found = doc.querySelector('.control-shell');
    if (found !== shell) {
      shell = found;
      dock?.remove();
      dock = null;
      buttons.clear();
      win.clearTimeout(timer);
    }
    if (!shell) return;
    if (!dock?.isConnected) dock = createDock();
    for (const item of shortcuts) {
      const button = buttons.get(item.id);
      const target = item.id === 'more' ? menuTrigger() : source(item.id === 'new' ? 'companies' : item.id);
      button.hidden = !target;
      const selected = item.id !== 'new' && item.id !== 'more' && target?.getAttribute('aria-current') === 'page';
      setAttribute(button, 'aria-current', selected ? 'page' : null);
    }
    const expanded = doc.querySelector('.control-mobile-menu[data-state="open"]') ? 'true' : 'false';
    setAttribute(buttons.get('more'), 'aria-expanded', expanded);
  }
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(sync); };
  const observer = new win.MutationObserver(records => {
    if (records.some(record => !dock?.contains(record.target))) schedule();
  });
  const cancelPendingNavigation = event => {
    if (pendingNew && event.isTrusted && event.target?.closest?.('.control-nav-item')) {
      pendingNew = false;
      win.clearTimeout(timer);
    }
  };
  function start() {
    if (disposed) return;
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current', 'data-state'] });
    doc.addEventListener('click', cancelPendingNavigation, true);
    schedule();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  const api = { dispose() { disposed = true; pendingNew = false; observer.disconnect(); doc.removeEventListener('click', cancelPendingNavigation, true); win.cancelAnimationFrame(frame); win.clearTimeout(timer); win.clearTimeout(statusTimer); dock?.remove(); delete win.__waterControlDockInstalled; } };
  win.__waterControlDockInstalled = api;
  return api;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') installControlDock(document, window);
