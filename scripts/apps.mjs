import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const names = { system: 'fama-system', control: 'fama-control' };
const args = process.argv.slice(2);
const action = args.shift();
if (!['install', 'build', 'typecheck', 'lint', 'test'].includes(action)) {
  throw new Error('Uso: node scripts/apps.mjs install|build|typecheck|lint|test [--app system|control] [--dry-run]');
}
let selected = Object.keys(names);
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dry-run') {
    dryRun = true;
  } else if (args[i] === '--app' && names[args[i + 1]]) {
    selected = [args[++i]];
  } else {
    throw new Error(`Argumento inválido: ${args[i]}`);
  }
}
if (process.platform === 'win32' && !dryRun) throw new Error('Execute pelo WSL2: os scripts das aplicações requerem Linux/Bash.');
for (const name of selected) {
  const directory = path.join(root, 'apps', names[name]);
  const command = action === 'install' ? ['ci'] : ['run', action];
  process.stdout.write(`[${names[name]}] npm ${command.join(' ')}\n`);
  if (dryRun) continue;
  const child = spawnSync('npm', command, { cwd: directory, stdio: 'inherit' });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status ?? 130);
}
