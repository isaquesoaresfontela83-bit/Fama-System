import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { VpsSQLite } from '../../server/vps-sqlite.mjs';
import { VpsBucket } from '../../server/vps-bucket.mjs';
import { localService } from '../../server/vps-env.mjs';
import { isTrustedMutation, requestPublicUrl } from '../../lib/request-security.js';

test('SQL writes persist, duplicate batches roll back, and application databases stay separate', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fama-vps-db-'));
    let first, second;
    try {
        assert.throws(() => new VpsSQLite(join(directory, 'absent.sqlite')), /backup/);
        first = new VpsSQLite(join(directory, 'system.sqlite'), { allowCreate: true });
        second = new VpsSQLite(join(directory, 'control.sqlite'), { allowCreate: true });
        for (const database of [first, second]) await database.exec('CREATE TABLE items(id TEXT PRIMARY KEY, value INTEGER NOT NULL);');
        await first.prepare('INSERT INTO items VALUES(?, ?)').bind('persisted', 125).run();
        await assert.rejects(first.batch([
            first.prepare('INSERT INTO items VALUES(?, ?)').bind('rolled-back', 20),
            first.prepare('INSERT INTO items VALUES(?, ?)').bind('persisted', 999),
        ]));
        assert.equal(await first.prepare('SELECT count(*) AS n FROM items').first('n'), 1);
        assert.equal(await second.prepare('SELECT count(*) AS n FROM items').first('n'), 0);
        assert.deepEqual(await first.prepare('SELECT id, value FROM items').raw({ columnNames: true }), [['id', 'value'], ['persisted', 125]]);
        first.close();
        first = new VpsSQLite(join(directory, 'system.sqlite'));
        assert.equal(await first.prepare('SELECT value FROM items WHERE id=?').bind('persisted').first('value'), 125);
    } finally { first?.close(); second?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('local backup objects retain bytes and metadata, paginate, and reject path traversal', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fama-vps-bucket-'));
    try {
        const bucket = new VpsBucket(directory);
        await bucket.put('backups/a.json', 'first', { httpMetadata: { contentType: 'application/json' } });
        await bucket.put('backups/b.json', new TextEncoder().encode('second'));
        const object = await new VpsBucket(directory).get('backups/a.json');
        assert.equal(await object.text(), 'first');
        assert.equal(object.httpMetadata.contentType, 'application/json');
        const page = await bucket.list({ prefix: 'backups/', limit: 1 });
        assert.equal(page.truncated, true);
        assert.deepEqual((await bucket.list({ prefix: 'backups/', cursor: page.cursor })).objects.map(item => item.key), ['backups/b.json']);
        assert.throws(() => bucket.path('../secrets'), /inválido/);
        await bucket.delete(['backups/a.json', 'backups/b.json']);
        assert.equal((await bucket.list()).objects.length, 0);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('internal bridge preserves authenticated requests and never follows redirects', async () => {
    const received = [];
    const server = createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        received.push({ url: request.url, host: request.headers['x-forwarded-host'], authorization: request.headers.authorization, body: Buffer.concat(chunks).toString() });
        response.writeHead(302, { Location: 'http://untrusted.invalid/' });
        response.end();
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const bridge = localService('http://127.0.0.1:' + server.address().port, 'https://control.famasystem.online');
        const result = await bridge.fetch('https://control.famasystem.online/api/internal/data?part=one', { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: '{"operation":"read"}' });
        assert.equal(result.status, 302);
        assert.deepEqual(received, [{ url: '/api/internal/data?part=one', host: 'control.famasystem.online', authorization: 'Bearer test-token', body: '{"operation":"read"}' }]);
        await bridge.fetch('https://control.famasystem.online//untrusted.invalid/escape');
        assert.equal(received[1].url, '//untrusted.invalid/escape');
        assert.throws(() => localService('http://user:secret@localhost/'), /inválido/);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTPS public origins work behind the proxy and forged forwarded origins stay blocked', () => {
    const before = { runtime: process.env.FAMA_RUNTIME, origin: process.env.FAMA_PUBLIC_URL };
    try {
        process.env.FAMA_RUNTIME = 'vps';
        process.env.FAMA_PUBLIC_URL = 'https://fama.example';
        const request = new Request('http://system:3000/api/auth/recover?part=one', {
            method: 'POST', headers: { origin: 'https://fama.example', 'sec-fetch-site': 'same-origin' },
        });
        assert.equal(isTrustedMutation(request), true);
        assert.equal(requestPublicUrl(request).href, 'https://fama.example/api/auth/recover?part=one');
        const forged = new Request(request.url, { method: 'POST', headers: {
            origin: 'https://untrusted.invalid', 'x-forwarded-host': 'untrusted.invalid', 'x-forwarded-proto': 'https',
        } });
        assert.equal(isTrustedMutation(forged), false);
        process.env.FAMA_RUNTIME = 'cloudflare';
        assert.equal(isTrustedMutation(request), false);
        assert.equal(requestPublicUrl(request).origin, 'http://system:3000');
    } finally {
        for (const [name, value] of [['FAMA_RUNTIME', before.runtime], ['FAMA_PUBLIC_URL', before.origin]]) {
            if (value === undefined) delete process.env[name]; else process.env[name] = value;
        }
    }
});
