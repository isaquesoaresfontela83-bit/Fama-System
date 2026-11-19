(() => {
 const script = document.currentScript;
 const asset = new URL('icon.webp', script.src).pathname;
 const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
 if (installed && !location.hostname.startsWith('control.') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let firstLaunch = false;
  try {
   firstLaunch = !sessionStorage.getItem('water-opening-played');
   if (firstLaunch) sessionStorage.setItem('water-opening-played', '1');
  } catch {}
  if (firstLaunch) {
   const opening = document.createElement('div');
   opening.className = 'water-opening';
   opening.setAttribute('aria-hidden', 'true');
   const logo = document.createElement('img');
   logo.src = asset;
   logo.alt = '';
   const name = document.createElement('span');
   name.textContent = 'Water System';
   opening.append(logo, name);
   document.body.append(opening);
   opening.addEventListener('animationend', event => {
    if (event.target === opening) opening.remove();
   });
   setTimeout(() => opening.remove(), 2000);
  }
 }
 const legacyMark = '/fama-piscinas-mark.png';
 const attributes = ['alt', 'aria-label', 'title', 'placeholder'];
 const ignored = 'script,style,noscript,textarea,select,[contenteditable],pre,code';
 const brandSelectors = '.brand, .app-brand, .control-brand, .control-login-brand, .brand-lockup, .brand-text, .public-brand';

 function rename(value, brand) {
  return value.replace(/\bFama[ \t]+(System|Control)\b|\bFama(?=System\b|Control\b)/gi, (name, product) => {
   const prefix = name === name.toUpperCase() ? 'WATER' : 'Water';
   return product ? prefix + ' ' + (name === name.toUpperCase() ? product.toUpperCase() : product[0].toUpperCase() + product.slice(1).toLowerCase()) : prefix;
  }).replace(brand ? /\bFama\b/gi : /$^/, name => name === 'FAMA' ? 'WATER' : 'Water');
 }

 function update(node) {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!(element instanceof Element) || element.closest(ignored)) return;
  if (node.nodeType === Node.TEXT_NODE) {
   const next = rename(node.data, element.closest(brandSelectors));
   if (next !== node.data) node.data = next;
   return;
  }
  for (const attr of attributes) {
   const value = element.getAttribute(attr);
   if (value === null) continue;
   const next = rename(value, element.closest(brandSelectors));
   if (next !== value) element.setAttribute(attr, next);
  }
  if (element instanceof HTMLImageElement && element.hasAttribute('src')) {
   const src = new URL(element.getAttribute('src'), document.baseURI);
   if (src.origin === location.origin && src.pathname === legacyMark) {
    element.src = asset;
   }
  }
 }

 function scan(node) {
  update(node);
  if (!(node instanceof Element)) return;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
   acceptNode(candidate) {
    return candidate instanceof Element && candidate.matches(ignored) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
   },
  });
  while (walker.nextNode()) update(walker.currentNode);
 }

 function start() {
  const observer = new MutationObserver(records => {
   for (const record of records) {
    if (record.type === 'childList') record.addedNodes.forEach(scan);
    else update(record.target);
   }
  });
  const updateTitle = () => {
   const next = rename(document.title, false);
   if (next !== document.title) document.title = next;
  };
  new MutationObserver(updateTitle).observe(document.head, { subtree: true, childList: true, characterData: true });
  updateTitle();
  scan(document.body);
  observer.observe(document.body, {
   subtree: true, childList: true, characterData: true, attributes: true,
   attributeFilter: [...attributes, 'src'],
  });
 }
 if (document.readyState === 'complete') setTimeout(start, 0);
 else window.addEventListener('load', () => setTimeout(start, 0), { once: true });
})();
