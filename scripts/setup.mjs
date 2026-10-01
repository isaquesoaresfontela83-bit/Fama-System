import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) throw new Error('Instale Node.js 22.13 ou superior.');
for (const name of ['fama-system', 'fama-control']) {
  const source = path.join(root, 'config/env', `${name}.dev.vars.example`);
  const target = path.join(root, 'apps', name, '.dev.vars');
  try {
    await fs.copyFile(source, target, constants.COPYFILE_EXCL);
    await fs.chmod(target, 0o600);
    process.stdout.write(`[${name}] Modelo local criado.\n`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    process.stdout.write(`[${name}] Configuração local existente preservada.\n`);
  }
}
process.stdout.write('Preencha as configurações locais, siga docs/BANCO.md e execute npm run install:apps.\n');
