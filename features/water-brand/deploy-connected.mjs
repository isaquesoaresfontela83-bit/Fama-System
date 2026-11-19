// Portable publisher for the authenticated Cloudflare connector. No credentials
// leave the connection. The input contains only the new public source files.
export async function deployWaterBrand(cloudflare, accountId, input, activate = false) {
 const encode = value => new TextEncoder().encode(value);
 const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(value => value.toString(16).padStart(2, '0')).join('');
 const fingerprint = async parts => {
  const entries = await Promise.all(parts.map(async part => [part.name, await sha(part.bytes)]));
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return sha(encode(JSON.stringify(entries)));
 };
 async function api(path, options = {}) {
  const method = options.method || 'GET';
  for (let attempt = 0; ; attempt++) {
   try {
    const result = await cloudflare.request({ method, path, ...options });
    if (result?.success === false) throw new Error('Cloudflare rejected the operation');
    return result;
   } catch (error) {
    if (method !== 'GET' || attempt >= 2 || !/10222|429|5\d\d|network|fetch|timeout/i.test(String(error))) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
   }
  }
 }
 const json = async (path, options) => (await api(path, options)).result;
 async function current(path) {
  const deployment = (await json(path + '/deployments')).deployments?.[0];
  const versions = deployment?.versions;
  if (versions?.length !== 1 || versions[0].percentage !== 100) throw new Error('Production must have one active version');
  return { version: versions[0].version_id, deployment: deployment.id };
 }
 async function readModules(raw) {
  const isText = typeof raw === 'string';
  if (isText && raw.includes('\ufffd')) throw new Error('Source decoding is not lossless');
  const prefix = isText ? raw.slice(0, 512) : new TextDecoder().decode(raw.slice(0, 512));
  const boundary = prefix.split('\r\n')[0];
  if (!boundary.startsWith('--')) throw new Error('Missing multipart source boundary');
  const form = await new Response(raw, { headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary.slice(2) } }).formData();
  const parts = [];
  for (const [name, value] of form) {
   if (name === 'metadata') continue;
   if (parts.some(part => part.name === name)) throw new Error('Duplicate source module');
   if (isText && !/\.(?:mjs|js)$/.test(name)) throw new Error('Binary source requires byte-preserving download');
   parts.push({ name, bytes: typeof value === 'string' ? encode(value) : new Uint8Array(await value.arrayBuffer()),
    type: typeof value === 'string' ? 'application/javascript+module' : value.type || 'application/javascript+module' });
  }
  if (!parts.length) throw new Error('Empty Worker source');
  return parts;
 }
 if (activate && Object.values(input.baseline).some(base => !base.hash)) throw new Error('Run preparation and pin both hashes before activation');
 const packages = [];
 for (const kind of ['system', 'control']) {
  const name = 'fama-' + kind + '-app';
  const path = '/accounts/' + accountId + '/workers/scripts/' + name;
  const [raw, settings, active, versions] = await Promise.all([
   api(path), json(path + '/settings'), current(path), json(path + '/versions', { query: { page: 1, per_page: 1 } }),
  ]);
  const currentParts = await readModules(raw);
  const baseHash = await fingerprint(currentParts);
  const baseline = input.baseline[kind];
  if (active.version !== baseline.version || versions.items?.[0]?.id !== active.version || (baseline.hash && baseHash !== baseline.hash) || currentParts.length !== baseline.modules) {
   throw new Error('Production changed in ' + name);
  }
  const owned = new Set(['water-brand-main.mjs', 'water-brand-core.mjs', 'water-brand-resources.mjs']);
  const installed = currentParts.filter(part => part.name.startsWith('water-brand-'));
  if (!currentParts.some(part => part.name === 'motion-main.mjs') ||
      installed.some(part => !owned.has(part.name)) || (installed.length !== 0 && installed.length !== owned.size)) {
   throw new Error('Unexpected production entry');
  }
  const parts = currentParts.filter(part => !owned.has(part.name));
  const before = await fingerprint(parts);
  const added = [
   { name: 'water-brand-main.mjs', body: "import app from './motion-main.mjs';\nexport * from './motion-main.mjs';\nimport {withWaterBrand} from './water-brand-core.mjs';\nimport resources from './water-brand-resources.mjs';\nexport default withWaterBrand(app,resources);" },
   { name: 'water-brand-core.mjs', body: input.core },
   { name: 'water-brand-resources.mjs', body: 'export default ' + JSON.stringify(input.resources) + ';\n' },
  ].map(part => ({ name: part.name, bytes: encode(part.body), type: 'application/javascript+module' }));
  const combined = [...parts, ...added];
  const metadata = { main_module: 'water-brand-main.mjs', keep_assets: true,
   bindings: settings.bindings.map(binding => ({ name: binding.name, type: 'inherit' })) };
  for (const key of ['compatibility_date', 'compatibility_flags', 'observability', 'usage_model', 'logpush', 'tail_consumers', 'tags', 'placement', 'limits']) {
   if (settings[key] !== undefined) metadata[key] = settings[key];
  }
  if (settings.assets?.config) metadata.assets = { config: settings.assets.config };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  for (const part of combined) form.append(part.name, new Blob([part.bytes], { type: part.type }), part.name);
  packages.push({ kind, name, path, before, baseHash, expected: await fingerprint(combined), form, active,
   preservedModules: parts.length, modules: combined.length,
   bindingNames: settings.bindings.map(binding => binding.name).sort(), attempted: false });
 }
 const summarize = pkg => ({ name: pkg.name, previousVersion: pkg.active.version, previousDeployment: pkg.active.deployment,
  preservedHash: pkg.before, publishedHash: pkg.expected, preservedModules: pkg.preservedModules, modules: pkg.modules, bindings: pkg.bindingNames.length });
 if (!activate) return { prepared: true, version: input.version, release: input.release, applications: packages.map(summarize) };
 async function assertBase(pkg) {
  const [active, latest, raw] = await Promise.all([current(pkg.path), json(pkg.path + '/versions', { query: { page: 1, per_page: 1 } }), api(pkg.path)]);
  if (active.version !== pkg.active.version || latest.items?.[0]?.id !== pkg.active.version || await fingerprint(await readModules(raw)) !== pkg.baseHash) throw new Error('Concurrent production change');
 }
 try {
  for (const pkg of packages) await assertBase(pkg);
  for (const pkg of packages) {
   await assertBase(pkg);
   pkg.attempted = true;
   await api(pkg.path, { method: 'PUT', query: { bindings_inherit: 'strict' }, body: pkg.form });
   pkg.published = await current(pkg.path);
   const modules = await readModules(await api(pkg.path));
   if (await fingerprint(modules) !== pkg.expected || await fingerprint(modules.filter(part => !part.name.startsWith('water-brand-'))) !== pkg.before) throw new Error('Published module integrity mismatch');
   const settings = await json(pkg.path + '/settings');
   if (JSON.stringify(settings.bindings.map(binding => binding.name).sort()) !== JSON.stringify(pkg.bindingNames)) throw new Error('Published binding mismatch');
  }
  async function verify(url, valid) {
   for (let attempt = 0; attempt < 5; attempt++) {
    try {
     const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
     if (response.ok && await valid(response)) return;
    } catch {}
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1500));
   }
   throw new Error('Public verification failed: ' + url);
  }
  // Connector environments can restrict fetch to the provider API. In that
  // case the caller must finish the public checks in the live browser.
  if (input.verifyPublic !== false) {
  for (const origin of ['https://famasystem.online', 'https://control.famasystem.online']) {
   await verify(origin + '/api/health', async response => {
    const health = await response.json();
    return health.version === input.version && health.release === input.release;
   });
  }
  for (const [origin, path] of [['https://famasystem.online', '/entrar'], ['https://control.famasystem.online', '/']]) {
   await verify(origin + path, async response => (await response.text()).includes(input.prefix + 'brand.js'));
   await verify(origin + input.prefix + 'icon.webp', async response => response.headers.get('Content-Type') === 'image/webp');
  }
  }
  return { success: true, version: input.version, release: input.release, verifiedAt: new Date().toISOString(),
   publicVerification: input.verifyPublic === false ? 'pending_browser' : 'passed',
   applications: packages.map(pkg => ({ ...summarize(pkg), version: pkg.published.version, deployment: pkg.published.deployment, integrity: true })) };
 } catch (error) {
  const rollback = [];
  for (const pkg of [...packages].reverse()) {
   if (!pkg.attempted) continue;
   try {
    if ((await current(pkg.path)).version === pkg.active.version) continue;
    if (await fingerprint(await readModules(await api(pkg.path))) !== pkg.expected) {
     rollback.push({ name: pkg.name, restored: false, reason: 'External source change' });
     continue;
    }
    await api(pkg.path + '/deployments', { method: 'POST', body: { strategy: 'percentage', versions: [{ version_id: pkg.active.version, percentage: 100 }] } });
    rollback.push({ name: pkg.name, restored: (await current(pkg.path)).version === pkg.active.version });
   } catch { rollback.push({ name: pkg.name, restored: false }); }
  }
  return { success: false, version: input.version, error: String(error), rollback };
 }
}
