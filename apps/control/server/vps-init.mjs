import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VpsSQLite } from './vps-sqlite.mjs';

const filename = resolve(process.env.FAMA_SQLITE_PATH || './data/fama.sqlite');
const existed = existsSync(filename);
const database = new VpsSQLite(filename, { allowCreate: process.env.FAMA_ALLOW_EMPTY_DATABASE === 'true' });
try {
    if (!existed) {
        for (const migration of readdirSync('drizzle').filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
            await database.exec(readFileSync(resolve('drizzle', migration), 'utf8'));
        }
        console.log('Banco de testes vazio criado explicitamente. Importe os dados reais antes da troca de domínio.');
    }
    const result = await database.prepare('PRAGMA integrity_check').first();
    if (Object.values(result)[0] !== 'ok') throw new Error('O banco não passou pela verificação de integridade.');
    console.log('Armazenamento local verificado.');
} finally { database.close(); }
