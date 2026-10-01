import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const strict = process.argv.includes('--strict-source');
const failures = [];
const requireFile = (rel) => {
  const full = path.resolve(root, rel);
  if (!full.startsWith(root) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    failures.push(`Arquivo obrigatório ausente: ${rel}`);
    return null;
  }
  return full;
};
const readJson = (rel) => {
  const file = requireFile(rel);
  if (!file) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { failures.push(`JSON inválido: ${rel}`); return null; }
};
for (const rel of ['README.md', 'docs/INDEX.md', 'docs/DESENVOLVIMENTO.md', 'docs/BANCO.md',
  'docs/CONFIGURACAO.md', 'docs/PUBLICACAO.md', '.github/workflows/ci.yml',
  'scripts/apps.mjs', 'scripts/setup.mjs', 'scripts/export-repository.py']) requireFile(rel);
const repository = readJson('package.json');
if (repository && (!repository.private || repository.workspaces)) failures.push('A raiz deve permanecer privada e usar instalações independentes das aplicações.');
readJson('package-lock.json');
for (const name of ['fama-system', 'fama-control']) {
  const prefix = `apps/${name}`;
  const pkg = readJson(`${prefix}/package.json`);
  readJson(`${prefix}/package-lock.json`);
  if (pkg) for (const command of ['build', 'dev', 'test', 'typecheck']) {
    if (!pkg.scripts?.[command]) failures.push(`Falta script ${command} em ${prefix}.`);
  }
  for (const rel of ['worker/index.ts', 'vite.config.ts', 'db/schema.ts', '.openai/hosting.json']) requireFile(`${prefix}/${rel}`);
  requireFile(`config/env/${name}.dev.vars.example`);
}
const database = readJson('database/supabase/estrutura-atual.json');
for (const name of ['01-estrutura-completa-supabase.sql', '02-storage.sql', '03-agendamentos.sql', '04-eventos-ddl.sql', '05-privilegios-padrao-referencia.sql']) {
  requireFile(`database/supabase/${name}`);
}
const source = readJson('SOURCE_MANIFEST.json');
if (source && source.original_files_preserved !== source.files.length) failures.push('Quantidade inconsistente no manifesto de origem.');
const sourceRefArgument = process.argv.indexOf('--source-ref');
const sourceRef = sourceRefArgument >= 0 ? process.argv[sourceRefArgument + 1] : source?.original_snapshot_commit;
if (strict && source) {
  if (sourceRef && (!/^[a-f0-9]{40}$/.test(sourceRef) || !fs.existsSync(path.join(root, '.git')))) {
    failures.push('A conferência do snapshot exige um clone Git e um hash de commit completo. Para pacotes de código sem histórico, use npm run verify.');
  } else {
    for (const entry of source.files) {
      let content;
      try {
        content = sourceRef ? execFileSync('git', ['show', `${sourceRef}:${entry.repository_path}`], { cwd: root, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }) : fs.readFileSync(requireFile(entry.repository_path));
      } catch {
        failures.push(`Arquivo ausente no snapshot de origem: ${entry.repository_path}`);
        continue;
      }
      if (crypto.createHash('sha256').update(content).digest('hex') !== entry.sha256) {
        failures.push(`Conteúdo difere do snapshot de origem: ${entry.repository_path}`);
      }
    }
  }
}
let files;
if (fs.existsSync(path.join(root, '.git'))) {
  files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
} else {
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    if (['.git', 'node_modules', 'dist', '.sites-runtime', '.wrangler', 'artifacts'].includes(item.name)) return [];
    const full = path.join(directory, item.name);
    return item.isDirectory() ? walk(full) : [path.relative(root, full).split(path.sep).join('/')];
  });
  files = walk(root);
}
const keyPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /sb_secret_[A-Za-z0-9_-]{20,}/g,
  /sk-(?:proj-|org-)?[A-Za-z0-9_-]{40,}/g,
  /(?:ghp_|github_pat_)[A-Za-z0-9_]{25,}/g,
  /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/g,
  /\$aact_(?:prod|hmlg|sandbox)_[A-Za-z0-9_-]{30,}/g,
];
for (const rel of files) {
  const name = path.basename(rel);
  if ((name === '.env' || name.startsWith('.env.') || name === '.dev.vars' || name.startsWith('.dev.vars.')) && !name.endsWith('.example')) {
    failures.push(`Configuração privada versionada: ${rel}`);
  }
  if (!/\.(?:mjs|cjs|js|ts|tsx|json|md|yml|yaml|sql|sh|example)$/.test(rel)) continue;
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const pattern of keyPatterns) for (const match of text.matchAll(pattern)) {
    if (match[0].includes('substitua_no_ambiente_seguro')) continue;
    if (rel.startsWith('apps/fama-system/tests/') && /^\$aact_(?:prod|hmlg)_123456789012345678901234567890$/.test(match[0])) continue;
    failures.push(`Possível credencial em ${rel}; o valor não será exibido.`);
  }
}
const documentFiles = ['README.md', 'CONTRIBUTING.md', 'docs/INDEX.md', 'docs/DESENVOLVIMENTO.md', 'docs/ARQUITETURA.md', 'docs/REPOSITORIO.md'];
for (const rel of documentFiles) {
  const file = requireFile(rel);
  if (!file) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) failures.push(`Link local inválido em ${rel}: ${target}`);
  }
}
if (failures.length) {
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.exit(1);
}
process.stdout.write(JSON.stringify({ status: 'ok', original_files: source?.original_files_preserved,
  original_hashes_checked: strict, source_ref: strict ? sourceRef ?? null : null, applications: 2, tables: database?.schema.tables.length,
  functions: database?.schema.functions.length, private_values_detected: false }) + '\n');
