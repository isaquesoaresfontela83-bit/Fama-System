import { createEnvironment } from './vps-env.mjs';
import { HybridPostgres, postgresPool } from './hybrid-postgres.mjs';

import { HybridBucket } from './hybrid-bucket.mjs';
let database, bucket;
const fallback = createEnvironment();
export const env = new Proxy({}, {
    get(_target, name) {
        if (name === 'DB') {
            database ??= new HybridPostgres(postgresPool(process.env), process.env.FAMA_POSTGRES_SCHEMA);
            return database;
        }
        // Never store backups or session files on Render's ephemeral disk.
        if (name === 'BUCKET') {
            if (!process.env.FAMA_BACKUP_BUCKET) return undefined;
            bucket ??= new HybridBucket(process.env);
            return bucket;
        }
        return fallback[name];
    },
});
