import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

for (const engine of ['svg', 'gpu']) {
 test(`repositioning the ${engine} lens preserves the selected thickness`, () => {
  const thickness = new EventTarget();
  thickness.value = '45';
  const reset = new EventTarget();
  const lens = { style: { removeProperty() {} }, offsetWidth: 200, offsetHeight: 100 };
  const target = { getBoundingClientRect: () => ({ left: 20, top: 200 }) };
  const status = {};
  const elements = {
   '#engine-status': status,
   '#lens-toggle': Object.assign(new EventTarget(), {
    setAttribute() {},
    querySelector: () => ({}),
   }),
   '#optical-lens': lens,
   '#thickness': thickness,
   '#reset-lens': reset,
   '#close-lens': new EventTarget(),
   '.price': target,
   '.specimen': target,
   main: {},
  };

  const created = [];
  function liquidGL(options) {
   const instance = { options, renderer: {}, destroy() {} };
   if (options.target === '#optical-lens') created.push(instance);
   return instance;
  }
  liquidGL.registerDynamic = () => {};
  const window = new EventTarget();
  const context = { getExtension() {} };
  runInNewContext(source, {
   document: {
    querySelector: selector => elements[selector],
    querySelectorAll: () => [],
    createElement: () => ({ getContext: () => engine === 'gpu' ? context : null }),
    body: { classList: { remove() {}, toggle() {} } },
    documentElement: { dataset: {} },
   },
   createSoftwareGlass({ strength, onReady }) {
    const instance = { strength, setStrength(value) { this.strength = value; }, destroy() {} };
    created.push(instance);
    onReady?.();
    return instance;
   },
   liquidGL,
   window,
   matchMedia: () => ({ matches: false }),
   requestAnimationFrame: callback => callback(),
   setTimeout() {},
   devicePixelRatio: 1,
   innerWidth: 390,
   innerHeight: 780,
  });

  window.dispatchEvent(new Event('load'));
  thickness.value = '100';
  thickness.dispatchEvent(new Event('input'));
  reset.dispatchEvent(new Event('click'));

  const [original, repositioned] = created;
  assert.equal(created.length, 2);
  if (engine === 'svg') {
   assert.equal(repositioned.strength, 1);
   assert.equal(repositioned.strength, original.strength);
  } else {
   for (const property of ['refraction', 'bevelDepth', 'magnify']) {
    assert.equal(repositioned.options[property], original.options[property], property);
   }
  }
 });
}
