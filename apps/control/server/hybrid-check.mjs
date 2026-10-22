import { HybridPostgres, postgresPool } from './hybrid-postgres.mjs';

if (process.env.DATA_BACKEND !== 'supabase') throw new Error('O modo híbrido exige os dados operacionais no Supabase.');
if (!process.env.FAMA_PUBLIC_URL?.startsWith('https://')) throw new Error('Configure o endereço público HTTPS da aplicação.');
const database = new HybridPostgres(postgresPool(process.env), process.env.FAMA_POSTGRES_SCHEMA);
try { await database.check(); console.log('Armazenamento persistente verificado; nenhum banco local foi criado.'); }
finally { await database.close(); }
