import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';
const root = new URL('..', import.meta.url).pathname;
const vite = await createServer({ configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false, ws: false } });
const blocks = await vite.ssrLoadModule('/lib/fama-blocks.js');
const permissions = await vite.ssrLoadModule('/lib/permissions.js');
after(() => vite.close());
const rules = () => Object.fromEntries(['global','organization','member'].map(scope => [scope, blocks.emptyBlockRule()]));

test('purchased tiers bound even owner and individual additions while preserving removals', () => {
  const current = rules();
  current.member.overrides = Object.fromEntries(blocks.famaBlocks.map(block => [block.id, true]));
  assert.equal(blocks.resolveBlockAccess('owner', [], current, 'inicial').length, 6);
  assert.equal(blocks.resolveBlockAccess('owner', [], current, 'intermediario').length, 13);
  assert.equal(blocks.resolveBlockAccess('owner', [], current, 'profissional').length, 14);
  assert.equal(blocks.resolveBlockAccess('owner', [], current, 'invalid').length, 6);
  assert.equal(blocks.resolveBlockAccess('owner', [], current, 'inicial').includes('finance'), false);
  assert.equal(blocks.resolveBlockAccess('owner', [], current, 'intermediario').includes('finance'), true);
  current.member.overrides.finance = false;
  assert.equal(blocks.resolveBlockAccess('owner', [], current, 'profissional').includes('finance'), false);
});

test('inherited rules preserve owner, administrator, member and explicit empty profiles', () => {
  assert.equal(blocks.resolveBlockAccess('owner', [], rules()).length, 14);
  assert.deepEqual(blocks.resolveBlockAccess('admin', ['crm'], rules()), ['crm','assistant']);
  assert.deepEqual(blocks.resolveBlockAccess('member', [], rules()), ['assistant']);
  assert.equal(blocks.resolveBlockAccess('member', null, rules()).length, 14);
});
test('global removals also constrain owners and do not silently reopen removed modules', () => {
  const current = rules(); current.global.overrides = { finance: false, mobile: false, assistant: false };
  const access = blocks.resolveBlockAccess('owner', [], current);
  assert.equal(permissions.hasFeaturePermission('owner', [], 'finance', access), false);
  assert.equal(permissions.hasFeaturePermission('owner', [], 'crm', access), true);
  assert.equal(blocks.hasBlockAccess(access, 'assistant'), false);
  assert.equal(permissions.hasFeaturePermission('owner', [], 'crm', []), false);
});
test('company and person exceptions take precedence and allow intentional additions', () => {
  const current = rules(); current.global.overrides = { finance: false, crm: true };
  current.organization.overrides = { finance: true, crm: false };
  current.member.overrides = { finance: false, crm: true, orders: true };
  assert.deepEqual(blocks.resolveBlockAccess('member', [], current), ['crm','orders','assistant']);
  current.member.overrides = {};
  assert.deepEqual(blocks.resolveBlockAccess('member', [], current), ['finance','assistant']);
  current.organization.overrides = {};
  assert.deepEqual(blocks.resolveBlockAccess('member', [], current), ['crm','assistant']);
});
test('removing and adding all blocks is reversible without changing stored profiles', () => {
  const current = rules(), profile = ['crm'];
  current.organization.overrides = Object.fromEntries(blocks.famaBlocks.map(block => [block.id, false]));
  assert.deepEqual(blocks.resolveBlockAccess('owner', profile, current), []);
  current.organization.overrides = Object.fromEntries(blocks.famaBlocks.map(block => [block.id, true]));
  assert.equal(blocks.resolveBlockAccess('member', [], current).length, 14);
  current.organization.overrides = {};
  assert.deepEqual(blocks.resolveBlockAccess('member', profile, current), ['crm','assistant']);
  assert.deepEqual(profile, ['crm']);
});
test('invalid blocks, executable content, nonbooleans and malformed revisions fail closed', () => {
  for (const value of [null, [], {finance:'true'}, {custom:'<script>'}, JSON.parse('{"__proto__":true}')]) assert.throws(() => blocks.parseBlockOverrides(value));
  for (const value of [null, {}, {...rules(),global:{overrides:{},revision:-1,updatedAt:null}}, {...rules(),member:{overrides:{},revision:0,updatedAt:'invalid'}}]) assert.throws(() => blocks.parseBlockRules(value));
  assert.deepEqual(blocks.parseBlockRules(rules()), rules());
});


test('Chat follows explicit permissions and global, company and individual block rules', () => {
  const current = rules();
  assert.deepEqual(blocks.parseBlockOverrides({chat:false}), {chat:false});
  assert.equal(permissions.hasFeaturePermission('admin', ['crm'], 'chat'), false);
  assert.equal(permissions.hasFeaturePermission('member', ['chat'], 'chat'), true);
  current.global.overrides = {chat:false};
  assert.equal(blocks.hasBlockAccess(blocks.resolveBlockAccess('owner', [], current), 'chat'), false);
  current.organization.overrides = {chat:true};
  assert.equal(blocks.hasBlockAccess(blocks.resolveBlockAccess('member', [], current), 'chat'), true);
  current.member.overrides = {chat:false};
  assert.equal(blocks.hasBlockAccess(blocks.resolveBlockAccess('member', ['chat'], current), 'chat'), false);
});
