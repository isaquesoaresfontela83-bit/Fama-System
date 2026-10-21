import { DatabaseSync } from 'node:sqlite';
import { EncryptedStore } from './encrypted-store.mjs';
export class Store extends EncryptedStore {
    constructor(filename,key,codec=JSON){
        const db=new DatabaseSync(filename);
        db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
        super(db,key,codec);
    }
}
