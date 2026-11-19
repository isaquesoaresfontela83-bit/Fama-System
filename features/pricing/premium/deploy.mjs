import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildResources } from './build.mjs';
import { VERSION, RELEASE, PREFIX } from './entry.mjs';

const workers = ['fama-system-app', 'fama-control-app'];
const previousEntry = 'optical-preview-main.mjs';

export function fingerprint(parts) {
 const entries = parts.map(part => [part.name, createHash('sha256').update(part.bytes).digest('hex')]);
 entries.sort((left, right) => left[0].localeCompare(right[0]));
 return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

export async function readModules(response) {
 const form = await response.formData();
 const parts = [];
 for (const [name, value] of form) {
  if (name === 'metadata') continue;
  const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(await value.arrayBuffer());
  const type = typeof value === 'string' ? 'application/javascript+module' : value.type;
  if (parts.some(part => part.name === name)) throw new Error('Duplicate Worker module');
  parts.push({ name, bytes, type: type || 'application/javascript+module' });
 }
 if (!parts.length) throw new Error('Worker source is empty');
 return parts;
}

function workerMetadata(settings) {
 const metadata = {
  main_module: 'presentation-main.mjs',
  keep_assets: true,
  bindings: settings.bindings.map(binding => ({ name: binding.name, type: 'inherit' })),
 };
 for (const key of ['compatibility_date', 'compatibility_flags', 'observability', 'usage_model', 'logpush', 'tail_consumers', 'tags', 'placement', 'limits']) {
  if (settings[key] !== undefined) metadata[key] = settings[key];
 }
 if (settings.assets?.config) metadata.assets = { config: settings.assets.config };
 return metadata;
}

function uploadBody(parts, metadata) {
 const form = new FormData();
 form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
 for (const part of parts) form.append(part.name, new Blob([part.bytes], { type: part.type }), part.name);
 return form;
}

export async function deploy({ token, accountId, activate = false, http = fetch }) {
 if (!token || !accountId) throw new Error('Configure CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID nos segredos do repositório.');
 const base = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId);
 async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer ' + token);
  const attempts = !options.method || options.method === 'GET' ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
   let response;
   try {
    response = await http(base + path, { ...options, headers, signal: AbortSignal.timeout(30000) });
   } catch {
    if (attempt === attempts - 1) throw new Error('A conexão com a API Cloudflare falhou.');
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    continue;
   }
   let temporary = response.status >= 500 || response.status === 429;
   if (response.headers.get('content-type')?.includes('application/json')) {
    const data = await response.clone().json().catch(() => null);
    temporary ||= data?.errors?.some(error => error.code === 10222) === true;
   }
   if (temporary && attempts > 1) {
    if (attempt === attempts - 1) throw new Error('A leitura da API Cloudflare continuou indisponível após três tentativas.');
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    continue;
   }
   if (!response.ok) throw new Error('Cloudflare API HTTP ' + response.status);
   return response;
  }
 }
 async function json(path, options = {}) {
  const payload = await (await api(path, options)).json();
  if (!payload.success) throw new Error('Cloudflare API rejected operation');
  return payload.result;
 }
 async function active(path) {
  const data = await json(path + '/deployments');
  const version = data.deployments?.[0]?.versions;
  if (version?.length !== 1 || version[0].percentage !== 100) throw new Error('A produção precisa ter uma única versão ativa para esta publicação.');
  return version[0].version_id;
 }
 const resources = await buildResources();
 const core = (await readFile(new URL('entry.mjs', import.meta.url), 'utf8'))
  .replace('./catalog-runtime.mjs', './presentation-catalog.mjs');
 const catalog = await readFile(new URL('catalog-runtime.mjs', import.meta.url), 'utf8');
 const packages = [];
 for (const [index, name] of workers.entries()) {
  const path = '/workers/scripts/' + name;
  const kind = index === 0 ? 'system' : 'control';
  const [source, settings, version, versions] = await Promise.all([
   api(path),
   json(path + '/settings'),
   active(path),
   json(path + '/versions?page=1&per_page=1'),
  ]);
  if (versions.items?.[0]?.id !== version) throw new Error('Há uma versão ainda não publicada em ' + name + '. A fonte ativa precisa ser conferida.');
  const parts = await readModules(source);
  if (!parts.some(part => part.name === previousEntry) || parts.some(part => part.name.startsWith('presentation-'))) {
   throw new Error('A entrada de produção mudou em ' + name + '. Revise a fonte atual antes de publicar.');
  }
  const before = fingerprint(parts);
  const additional = [
   {
    name: 'presentation-main.mjs',
    bytes: Buffer.from([
     "import app from './" + previousEntry + "';",
     "export * from './" + previousEntry + "';",
     "import {withPresentation} from './presentation-core.mjs';",
     "import resources from './presentation-resources.mjs';",
     "export default withPresentation(app,'" + kind + "',resources);",
    ].join('\n')),
   },
   { name: 'presentation-core.mjs', bytes: Buffer.from(core) },
   { name: 'presentation-catalog.mjs', bytes: Buffer.from(catalog) },
   { name: 'presentation-resources.mjs', bytes: Buffer.from('export default ' + JSON.stringify(kind === 'system' ? resources : {}) + ';\n') },
  ].map(part => ({ ...part, type: 'application/javascript+module' }));
  const combined = [...parts, ...additional];
  packages.push({
   name, kind, path, version, before, expected: fingerprint(combined),
   originalCount: parts.length, bindings: settings.bindings.length, bindingNames: settings.bindings.map(binding => binding.name).sort(),
   form: uploadBody(combined, workerMetadata(settings)), attempted: false,
  });
 }
 const summary = packages.map(({ name, version, before, originalCount, bindings }) => ({ name, previousVersion: version, preservedHash: before, preservedModules: originalCount, bindings }));
 if (!activate) return { prepared: true, version: VERSION, release: RELEASE, applications: summary };

 async function assertBase(pkg) {
  const [version, versions] = await Promise.all([active(pkg.path), json(pkg.path + '/versions?page=1&per_page=1')]);
  if (version !== pkg.version || versions.items?.[0]?.id !== pkg.version) {
   throw new Error('A fonte ou a versão ativa mudou durante a preparação.');
  }
 }
 const rollback = [];
 try {
  for (const pkg of packages) await assertBase(pkg);
  for (const pkg of packages) {
   await assertBase(pkg);
   pkg.attempted = true;
   await json(pkg.path + '?bindings_inherit=strict', { method: 'PUT', body: pkg.form });
   pkg.newVersion = await active(pkg.path);
   const modules = await readModules(await api(pkg.path));
   const original = modules.filter(part => !part.name.startsWith('presentation-'));
   if (fingerprint(original) !== pkg.before || fingerprint(modules) !== pkg.expected) throw new Error('A verificação dos módulos publicados falhou em ' + pkg.name);
   const settings = await json(pkg.path + '/settings');
   if (JSON.stringify(settings.bindings.map(binding => binding.name).sort()) !== JSON.stringify(pkg.bindingNames)) throw new Error('A verificação dos bindings falhou em ' + pkg.name);
  }
  async function verifyResponse(url, valid) {
   for (let attempt = 0; attempt < 5; attempt++) {
    try {
     const response = await http(url, { signal: AbortSignal.timeout(20000) });
     if (response.ok && await valid(response)) return;
    } catch {}
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1500));
   }
   throw new Error('A publicação não foi confirmada em ' + url);
  }
  for (const origin of ['https://famasystem.online', 'https://control.famasystem.online']) {
   await verifyResponse(origin + '/api/health', async response => {
    const health = await response.json();
    return health.version === VERSION && health.release === RELEASE;
   });
  }
  await verifyResponse('https://famasystem.online/planos', async response => {
   const html = await response.text();
   return html.includes('id="theme-toggle"') && html.includes('id="fama-public-catalog"');
  });
  for (const file of ['app.js', 'catalog.js', 'theme.js', 'style.css']) {
   await verifyResponse('https://famasystem.online' + PREFIX + file, async response =>
    await response.text() === resources[PREFIX + file].body);
  }
  return { success: true, version: VERSION, release: RELEASE, applications: packages.map((pkg, index) => ({ ...summary[index], version: pkg.newVersion })) };
 } catch (error) {
  for (const pkg of [...packages].reverse()) {
   if (!pkg.attempted) continue;
   try {
    if (await active(pkg.path) === pkg.version) continue;
    const modules = await readModules(await api(pkg.path));
    if (fingerprint(modules) !== pkg.expected) {
     rollback.push({ name: pkg.name, restored: false, reason: 'A fonte atual mudou. Restauração automática suspensa para preservar a atualização externa.' });
     continue;
    }
    await json(pkg.path + '/deployments', {
     method: 'POST', headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ strategy: 'percentage', versions: [{ version_id: pkg.version, percentage: 100 }] }),
    });
    rollback.push({ name: pkg.name, restored: await active(pkg.path) === pkg.version });
   } catch {
    rollback.push({ name: pkg.name, restored: false });
   }
  }
  return { success: false, version: VERSION, error: error.message, rollback };
 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try {
  const result = await deploy({
   token: process.env.CLOUDFLARE_API_TOKEN,
   accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
   activate: process.argv.includes('--activate'),
  });
  await writeFile('deployment-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.success === false) process.exitCode = 1;
 } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
 }
}
