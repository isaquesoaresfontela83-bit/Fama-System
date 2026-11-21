// Incremental paired release for the authenticated Cloudflare connection.
// Existing Worker modules and bindings stay in the connector; no credentials are exported.
export async function deployControlLayout(cloudflare, accountId, input) {
 const encode = value => new TextEncoder().encode(value);
 const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
 const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
 const fingerprint = async parts => {
  const entries = await Promise.all(parts.map(async part => [part.name, await sha(part.bytes)]));
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return sha(encode(JSON.stringify(entries)));
 };
 const api = (path, options = {}) => cloudflare.request({ method: 'GET', path, ...options });
 const json = async (path, options) => (await api(path, options)).result;
 const current = async path => {
  const deployment = (await json(path + '/deployments')).deployments?.[0];
  if (deployment?.versions?.length !== 1 || deployment.versions[0].percentage !== 100) throw new Error('Expected a single active version at ' + path);
  return { version: deployment.versions[0].version_id, deployment: deployment.id };
 };
 async function readModules(raw) {
  const isText = typeof raw === 'string';
  if (isText && raw.includes('\ufffd')) throw new Error('Source download is not lossless');
  const prefix = isText ? raw.slice(0, 512) : new TextDecoder().decode(raw.slice(0, 512));
  const boundary = prefix.split('\r\n')[0];
  if (!boundary.startsWith('--')) throw new Error('Missing multipart boundary');
  const form = await new Response(raw, { headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary.slice(2) } }).formData();
  const parts = [];
  for (const [name, value] of form) {
   if (name === 'metadata') continue;
   if (parts.some(part => part.name === name)) throw new Error('Duplicate module: ' + name);
   if (isText && !/\.(?:mjs|js)$/.test(name)) throw new Error('Binary module needs a lossless byte download');
   parts.push({ name, bytes: typeof value === 'string' ? encode(value) : new Uint8Array(await value.arrayBuffer()), type: typeof value === 'string' ? 'application/javascript+module' : value.type || 'application/javascript+module' });
  }
  return parts;
 }
 function resourcesFrom(part) {
  const source = decode(part.bytes).trim();
  const prefix = 'export default ';
  if (!source.startsWith(prefix) || !source.endsWith(';')) throw new Error('Unexpected resource module');
  return JSON.parse(source.slice(prefix.length, -1));
 }
 const summary = pkg => ({ name: pkg.name, previousVersion: pkg.active.version, previousDeployment: pkg.active.deployment,
  baselineHash: pkg.baselineHash, candidateHash: pkg.candidateHash, preservedHash: pkg.preservedHash,
  modules: pkg.parts.length, bindings: pkg.bindingNames.length, bindingHash: pkg.bindingHash, changedModules: pkg.changed });
 async function prepare() {
  const packages = [];
  for (const role of ['system', 'control']) {
   const name = 'fama-' + role + '-app';
   const path = '/accounts/' + accountId + '/workers/scripts/' + name;
   const [raw, settings, active] = await Promise.all([api(path), json(path + '/settings'), current(path)]);
   const parts = await readModules(raw);
   const baselineHash = await fingerprint(parts);
   const baseline = input.baseline?.[role];
   if (!baseline || active.version !== baseline.version || parts.length !== baseline.modules || (baseline.hash && baseline.hash !== baselineHash)) throw new Error('Production changed in ' + name);
   const core = parts.find(part => part.name === 'water-brand-core.mjs');
   const assetModule = parts.find(part => part.name === 'water-brand-resources.mjs');
   if (!core || !assetModule || await sha(core.bytes) !== input.expectedCoreHash) throw new Error('Unexpected brand source in ' + name);
   const resources = resourcesFrom(assetModule);
   for (const key of ['mfa-management-15.23.28.mjs','mfa-flow-15.23.28.mjs','mfa-management-15.23.28.css']) {
    if (!Object.hasOwn(resources, key)) throw new Error('Missing existing authentication resource in ' + name);
   }
   const changed = ['water-brand-core.mjs'];
   if (role === 'control') {
    if (Object.hasOwn(resources, input.layoutName)) throw new Error('Layout resource already exists');
    resources[input.layoutName] = { body: input.layoutCss, type: 'text/css; charset=utf-8' };
    changed.push('water-brand-resources.mjs');
   }
   const preserved = parts.filter(part => !changed.includes(part.name));
   const replacements = parts.map(part => part.name === 'water-brand-core.mjs' ? { ...part, bytes: encode(input.core) }
    : role === 'control' && part.name === 'water-brand-resources.mjs' ? { ...part, bytes: encode('export default ' + JSON.stringify(resources) + ';\n') } : part);
   const candidateHash = await fingerprint(replacements);
   if (baseline.candidateHash && baseline.candidateHash !== candidateHash) throw new Error('Prepared content changed in ' + name);
   const metadata = { main_module: 'water-brand-main.mjs', keep_assets: true, bindings: settings.bindings.map(binding => ({ name: binding.name, type: 'inherit' })) };
   for (const key of ['compatibility_date','compatibility_flags','observability','usage_model','logpush','tail_consumers','tags','placement','limits']) if (settings[key] !== undefined) metadata[key] = settings[key];
   if (settings.assets?.config) metadata.assets = { config: settings.assets.config };
   const form = new FormData();
   form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
   for (const part of replacements) form.append(part.name, new Blob([part.bytes], { type: part.type }), part.name);
   const bindingNames = settings.bindings.map(binding => [binding.name, binding.type]).sort((a,b) => a[0].localeCompare(b[0]));
   packages.push({ role, name, path, active, parts: replacements, form, changed, baselineHash, candidateHash,
    preservedHash: await fingerprint(preserved), bindingNames, bindingHash: await sha(encode(JSON.stringify(bindingNames))) });
  }
  return packages;
 }
 if (input.phase === 'prepare') return { prepared: true, applications: (await prepare()).map(summary) };
 if (input.phase === 'stage') {
  if (['system','control'].some(role => !input.baseline?.[role]?.hash || !input.baseline?.[role]?.candidateHash)) throw new Error('Prepared hashes required');
  const packages = await prepare();
  const staged = [];
  try {
   for (const pkg of packages) {
    if ((await current(pkg.path)).version !== pkg.active.version) throw new Error('Concurrent change in ' + pkg.name);
    const version = await json(pkg.path + '/versions', { method: 'POST', query: { bindings_inherit: 'strict' }, body: pkg.form });
    if (!version?.id || version.id === pkg.active.version) throw new Error('Missing staged version for ' + pkg.name);
    staged.push({ ...summary(pkg), versionId: version.id });
   }
   return { staged: true, applications: staged };
  } catch (error) { return { staged: false, applications: staged, error: String(error) }; }
 }
 if (input.phase === 'activate') {
  const targets = input.targets;
  if (!Array.isArray(targets) || targets.length !== 2) throw new Error('Both staged versions are required');
  const activated = [];
  try {
   for (const target of targets) {
    const path = '/accounts/' + accountId + '/workers/scripts/' + target.name;
    const active = await current(path);
    const versions = await json(path + '/versions', { query: { page: 1, per_page: 1 } });
    if (active.version !== target.previousVersion || versions.items?.[0]?.id !== target.versionId) throw new Error('Concurrent change in ' + target.name);
   }
   for (const target of targets) {
    const path = '/accounts/' + accountId + '/workers/scripts/' + target.name;
    if ((await current(path)).version !== target.previousVersion) throw new Error('Concurrent deployment in ' + target.name);
    activated.push(target);
    await api(path + '/deployments', { method: 'POST', body: { strategy: 'percentage', versions: [{ version_id: target.versionId, percentage: 100 }] } });
    const [active, raw, settings] = await Promise.all([current(path), api(path), json(path + '/settings')]);
    const parts = await readModules(raw);
    const bindingNames = settings.bindings.map(binding => [binding.name, binding.type]).sort((a,b) => a[0].localeCompare(b[0]));
    if (active.version !== target.versionId || await fingerprint(parts) !== target.candidateHash || parts.length !== target.modules || bindingNames.length !== target.bindings || await sha(encode(JSON.stringify(bindingNames))) !== target.bindingHash) throw new Error('Published integrity mismatch in ' + target.name);
    if (await fingerprint(parts.filter(part => !target.changedModules.includes(part.name))) !== target.preservedHash) throw new Error('Unexpected changed module in ' + target.name);
    target.deploymentId = active.deployment;
   }
   return { success: true, applications: targets };
  } catch (error) {
   const rollback = [];
   for (const target of activated.reverse()) {
    const path = '/accounts/' + accountId + '/workers/scripts/' + target.name;
    try {
     const activeVersion = (await current(path)).version;
     if (activeVersion === target.previousVersion) { rollback.push({ name: target.name, restored: true, reason: 'Previous version remained active' }); continue; }
     if (activeVersion !== target.versionId) { rollback.push({ name: target.name, restored: false, reason: 'External deployment detected' }); continue; }
     await api(path + '/deployments', { method: 'POST', body: { strategy: 'percentage', versions: [{ version_id: target.previousVersion, percentage: 100 }] } });
     rollback.push({ name: target.name, restored: (await current(path)).version === target.previousVersion });
    } catch { rollback.push({ name: target.name, restored: false }); }
   }
   return { success: false, error: String(error), rollback };
  }
 }
 throw new Error('Invalid phase');
}
