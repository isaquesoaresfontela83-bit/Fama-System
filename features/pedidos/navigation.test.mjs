import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {STAGES,today,isOverdue,policyDefaults} from './model.mjs';

test('navigation inserts exactly one shortcut in flat and list menus without cloning observer roots',async()=>{
  const source=(await readFile(new URL('client.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'').replace('import.meta.url',JSON.stringify('https://fixture.test/client.mjs'));
  for(const markup of ['<button>Orçamentos</button>','<ul><li class="item"><button>Orçamentos</button></li></ul>']){
    const {window,document}=parseHTML(`<html><body><nav class="workspace-navigation"><div class="workspace-navigation-content">${markup}</div></nav><main class="workspace"></main></body></html>`);
    let notify;const sandbox={window,document,URL,Intl,STAGES,today,isOverdue,policyDefaults,crypto,Element:window.Element,location:{href:'https://fixture.test/'},history:{state:{},replaceState(){}},MutationObserver:class{constructor(fn){notify=fn;}observe(){}},queueMicrotask:fn=>fn()};
    vm.runInNewContext(source,sandbox);
    for(let i=0;i<10;i++)notify();
    assert.equal(document.querySelectorAll('.workspace-navigation-content').length,1);
    assert.equal(document.querySelectorAll('[data-pedidos-nav]').length,1);
    assert.equal(document.querySelector('.workspace-navigation-content').contains(document.querySelector('[data-pedidos-nav]')),true);
  }
});
