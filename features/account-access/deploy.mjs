export const baseline = {
  system: { version: 'b9d6df1c-94e2-4a8a-892f-ccd5b75aa2bd', count: 127, sha256: 'd6a97a3a816e53224a026db834b4d8f532c12dcf6c48c144b4004a0f29f674e4' },
  control: { version: '5cff2387-f835-46c6-9a7b-26d1fa36b5d5', count: 60, sha256: '6a38d81ce5bdc7ed1cbfa4f9a1d4572f9dc37f1b49c7ea82560e477b404256ef' },
};

export async function prepareAccountAccess(cloudflare, accountId, source, activate = false) {
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const prepared = [];
  const additions = [
    ['account-access-entry.mjs', source.entry],
    ['account-access-system-page.mjs', source.systemPage],
    ['account-access-control-page.mjs', source.controlPage],
  ];
  if (additions.some(([, body]) => typeof body !== 'string' || !body)) throw Error('Missing account access module');
  for (const kind of ['system', 'control']) {
    const worker = `fama-${kind}-app`;
    const path = `/accounts/${accountId}/workers/scripts/${worker}`;
    const [script, settings, deployments] = await Promise.all([
      cloudflare.request({ method: 'GET', path: path + '/content/v2', query: { module: 'index.js' } }),
      cloudflare.request({ method: 'GET', path: path + '/settings' }),
      cloudflare.request({ method: 'GET', path: path + '/deployments' }),
    ]);
    const active = deployments.result.deployments[0].versions;
    const expected = baseline[kind];
    if (active.length !== 1 || active[0].version_id !== expected.version || active[0].percentage !== 100) throw Error('Production version changed: ' + worker);
    const boundary = script.split('\r\n')[0];
    const parts = script.split(boundary).flatMap(part => {
      const split = part.indexOf('\r\n\r\n');
      const name = part.slice(0, split).match(/name="([^"]+)"/)?.[1];
      return name ? [{ name, body: part.slice(split + 4).replace(/\r\n$/, '') }] : [];
    }).sort((left, right) => left.name.localeCompare(right.name));
    if (parts.length !== expected.count || await digest(JSON.stringify(parts)) !== expected.sha256) throw Error('Module integrity mismatch: ' + worker);
    if (!parts.some(part => part.name === 'glass-main.mjs')) throw Error('Unexpected Worker entry: ' + worker);
    if (parts.some(part => part.name.startsWith('account-access-'))) throw Error('Account access extension already exists: ' + worker);
    let patched = parts.map(part => ({ ...part }));
    if (kind === 'control') {
      patched = patched.map(part => {
        if (part.name !== 'index.js') return part;
        const oldAdmin = 'function Ia(e){const t=hR(),a=gR(),r=e.email.trim().toLocaleLowerCase("pt-BR");return!!t&&r===t||!!a&&e.id===a}';
        const oldUser = 'provider:"supabase",aal:Df(e),mfaRequired:';
        if (!part.body.includes(oldAdmin) || !part.body.includes(oldUser)) throw Error('Control authorization code changed');
        return { ...part, body: part.body.replace(oldAdmin, oldAdmin.replace('||!!a&&e.id===a}', '||!!a&&e.id===a||e.controlAdmin===!0}')).replace(oldUser, 'provider:"supabase",controlAdmin:t.app_metadata?.fama_control_admin===!0,aal:Df(e),mfaRequired:') };
      });
    }
    patched = patched.map(part => ({ ...part, body: part.name === 'glass-core.mjs' || part.name === 'glass-client-resources.mjs'
      ? part.body.replaceAll('15.23.2', '15.23.3').replaceAll('2026-11-07-mobile-tap-01', '2026-11-09-account-access-01') : part.body }));
    const main = `import app from './glass-main.mjs';\nimport {withAccountAccess} from './account-access-entry.mjs';\nexport default withAccountAccess(app, '${kind}');\n`;
    const all = [...patched, ...additions.map(([name, body]) => ({ name, body })), { name: 'account-access-main.mjs', body: main }];
    const s = settings.result;
    const metadata = { main_module: 'account-access-main.mjs', bindings: s.bindings.map(binding => ({ name: binding.name, type: 'inherit' })), keep_assets: true, compatibility_date: s.compatibility_date, compatibility_flags: s.compatibility_flags, observability: s.observability, usage_model: s.usage_model, logpush: s.logpush, tail_consumers: s.tail_consumers, tags: s.tags };
    if (s.limits) metadata.limits = s.limits;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    for (const part of all) form.append(part.name, new Blob([part.body], { type: 'application/javascript+module' }), part.name);
    prepared.push({ worker, path, form, expected, summary: { worker, modules: all.length, preserved: parts.length, newModules: 4, bindings: s.bindings.length, sourceSha256: await digest(JSON.stringify(parts)) } });
  }
  if (!activate) return { verified: true, packages: prepared.map(part => part.summary) };
  const published = [];
  try {
    for (const part of prepared) {
      const result = await cloudflare.request({ method: 'PUT', path: part.path, body: part.form });
      if (!result.success) throw Error(JSON.stringify(result.errors));
      published.push(part);
    }
  } catch (error) {
    const rollbacks = [];
    for (const part of published) {
      const result = await cloudflare.request({ method: 'POST', path: part.path + '/deployments', body: { strategy: 'percentage', versions: [{ version_id: part.expected.version, percentage: 100 }] } });
      rollbacks.push({ worker: part.worker, success: result.success });
    }
    return { success: false, error: String(error), rollbacks };
  }
  const versions = [];
  for (const part of prepared) {
    const result = await cloudflare.request({ method: 'GET', path: part.path + '/deployments' });
    versions.push({ worker: part.worker, deployment: result.result.deployments[0] });
  }
  return { success: true, packages: prepared.map(part => part.summary), versions };
}
