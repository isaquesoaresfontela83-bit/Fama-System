import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!args[i]?.startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--')) {
    throw new Error('Forneça pares --opcao valor. Consulte documentacao/PUBLICACAO.md.');
  }
  options[args[i].slice(2)] = args[i + 1];
}
for (const key of ['project', 'worker-name', 'database-name', 'database-id', 'supabase-url']) {
  if (!options[key]) throw new Error(`Faltou --${key}.`);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(options['worker-name'])) throw new Error('Nome de Worker inválido.');
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options['database-id'])) {
  throw new Error('Informe o UUID real do recurso D1.');
}
if (options['database-id'] === '00000000-0000-4000-8000-000000000000') throw new Error('O ID D1 de exemplo não é um recurso real.');
const supabase = new URL(options['supabase-url']);
if (supabase.protocol !== 'https:' || supabase.username || supabase.password || supabase.search || supabase.hash) {
  throw new Error('Informe uma URL HTTPS de Supabase, sem credenciais ou parâmetros.');
}
const project = path.resolve(options.project);
const sourcePath = path.join(project, 'dist/server/wrangler.json');
const config = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
if (!config.main || !config.assets?.directory) throw new Error('O build não contém configuração de Worker e assets esperada.');
config.name = options['worker-name'];
if ('topLevelName' in config) config.topLevelName = config.name;
config.assets = { ...config.assets, binding: 'ASSETS' };
config.images = { binding: 'IMAGES' };
config.d1_databases = [{ binding: 'DB', database_name: options['database-name'], database_id: options['database-id'], migrations_dir: '../../drizzle' }];
config.vars = { ...config.vars, DATA_BACKEND: 'supabase', SUPABASE_AUTH_ENABLED: 'true', SUPABASE_URL: supabase.origin, SUPABASE_STORAGE_BUCKET: 'fama-documents' };
const outputPath = path.join(project, 'dist/server/wrangler.export.json');
await fs.writeFile(outputPath, JSON.stringify(config, null, 2) + '\n');
process.stdout.write(`Configuração preparada: ${outputPath}\n`);
process.stdout.write('Nenhuma publicação foi executada. Configure os segredos no seu Worker.\n');
