import test from 'node:test';
import assert from 'node:assert/strict';
import { installControlDock } from '../../apps/control/app/control-dock.mjs';

function environment() {
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.hidden = false; this.isConnected = true; this.textContent = ''; this.listeners = {}; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    removeAttribute(name) { delete this.attrs[name]; }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parent = this; node.isConnected = true; } }
    remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    click() { this.clicks = (this.clicks || 0) + 1; this.listeners.click?.({ target: this, isTrusted: false }); }
    querySelector(selector) { if (selector === '[role="status"]') return this.children.find(node => node.getAttribute('role') === 'status') ?? null; return null; }
  }
  const frames = new Map(), timers = new Map(), handlers = new Map();
  let next = 1, observer = null, liveShell = null, menuOpen = false, showCreate = true;
  const links = new Map(['overview','companies','finance'].map(id => { const node = new Element('a'); node.setAttribute('href', '#' + id); return [id, node]; }));
  links.get('overview').setAttribute('aria-current','page');
  const menu = new Element('button');
  const create = new Element('button'); create.textContent = 'Nova empresa';
  const shell = new Element();
  shell.querySelector = selector => {
    if (selector.startsWith('.control-sidebar ')) { const id = selector.match(/href="#([^"]+)"/)?.[1]; return links.get(id) || null; }
    if (selector.startsWith('.control-menu-trigger')) return menu;
    return null;
  };
  shell.querySelectorAll = selector => selector === '#companies button' && showCreate ? [create] : [];
  const body = new Element('body');
  const document = {
    readyState: 'complete', body, documentElement: new Element('html'),
    createElement: tag => new Element(tag),
    createElementNS: (ns, tag) => { const node = new Element(tag); node.namespaceURI = ns; return node; },
    querySelector: selector => selector === '.control-shell' ? liveShell : selector.startsWith('.control-mobile-menu') && menuOpen ? new Element() : null,
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: name => handlers.delete(name),
  };
  const window = {
    requestAnimationFrame(fn) { const id = next++; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn) { const id = next++; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    MutationObserver: class { constructor(fn) { this.fn = fn; observer = this; } observe() {} disconnect() { this.disconnected = true; } },
  };
  const flush = () => { const jobs = [...frames.values()]; frames.clear(); for (const fn of jobs) fn(); };
  const change = () => { observer.fn([{target: body}]); flush(); };
  return { document, window, body, shell, links, menu, create, timers, handlers, flush, change,
    setShell(value) { liveShell = value; }, setMenu(value) { menuOpen = value; }, setShowCreate(value) { showCreate = value; } };
}

test('dock appears only with a Control session and follows the current section', () => {
  const e = environment(); const controller = installControlDock(e.document, e.window); e.flush();
  assert.equal(e.body.children.length, 0);
  e.setShell(e.shell); e.change();
  const dock = e.body.children[0];
  assert.equal(dock.getAttribute('aria-label'), 'Navegação rápida do Water Control');
  const buttons = dock.children.filter(child => child.tagName === 'BUTTON');
  assert.deepEqual(buttons.map(button => button.getAttribute('data-control-dock')), ['overview','companies','new','finance','more']);
  assert.equal(buttons[0].getAttribute('aria-current'), 'page');
  e.links.get('overview').removeAttribute('aria-current'); e.links.get('finance').setAttribute('aria-current','page'); e.change();
  assert.equal(buttons[0].getAttribute('aria-current'), null); assert.equal(buttons[3].getAttribute('aria-current'), 'page');
  e.links.delete('finance'); e.change(); assert.equal(buttons[3].hidden, true);
  e.setShell(null); e.change(); assert.equal(e.body.children.length, 0);
  controller.dispose();
});

test('shortcuts invoke existing navigation and cancel a pending new-company action', () => {
  const e = environment(); e.setShell(e.shell); const controller = installControlDock(e.document,e.window); e.flush();
  const buttons = e.body.children[0].children.filter(child => child.tagName === 'BUTTON');
  buttons[1].click(); assert.equal(e.links.get('companies').clicks, 1);
  buttons[2].click(); assert.equal(e.links.get('companies').clicks, 2); assert.equal(e.create.clicks, 1);
  buttons[4].click(); assert.equal(e.menu.clicks, 1);
  e.setMenu(true); e.change(); assert.equal(buttons[4].getAttribute('aria-expanded'), 'true');
  e.setShowCreate(false); buttons[2].click(); assert.equal(e.timers.size, 1);
  e.handlers.get('click')({ isTrusted: true, target: { closest: () => ({}) } });
  assert.equal(e.timers.size, 0); assert.equal(e.create.clicks, 1);
  controller.dispose(); assert.equal(e.body.children.length, 0);
});
