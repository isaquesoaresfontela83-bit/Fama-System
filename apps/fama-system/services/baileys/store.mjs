import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export class Store {
    constructor(filename, key, codec = JSON) {
        if (!/^[a-f0-9]{64}$/i.test(key || '')) throw new Error('BAILEYS_ENCRYPTION_KEY precisa de 32 bytes em hexadecimal.');
        this.key = Buffer.from(key, 'hex'); this.codec = codec;
        this.db = new DatabaseSync(filename);
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
            CREATE TABLE IF NOT EXISTS auth(company TEXT, id TEXT, value TEXT NOT NULL, PRIMARY KEY(company,id));
            CREATE TABLE IF NOT EXISTS sessions(company TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1);
            CREATE TABLE IF NOT EXISTS messages(company TEXT, id TEXT, phone TEXT NOT NULL, occurred_at INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(company,id));
            CREATE INDEX IF NOT EXISTS message_page ON messages(company,phone,occurred_at);
            CREATE TABLE IF NOT EXISTS sends(company TEXT, id TEXT, fingerprint TEXT NOT NULL, status TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(company,id));`);
    }
    seal(company, id, value) {
        const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
        cipher.setAAD(Buffer.from(company + ':' + id));
        return Buffer.concat([iv, cipher.update(this.codec.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString('base64');
    }
    open(company, id, value) {
        const bytes = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
        decipher.setAAD(Buffer.from(company + ':' + id)); decipher.setAuthTag(bytes.subarray(-16));
        return this.codec.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString());
    }
    getAuth(company, id) { const row = this.db.prepare('SELECT value FROM auth WHERE company=? AND id=?').get(company,id); return row ? this.open(company,id,row.value) : null; }
    setAuth(company, id, value) {
        if (value === null) this.db.prepare('DELETE FROM auth WHERE company=? AND id=?').run(company,id);
        else this.db.prepare('INSERT INTO auth VALUES (?,?,?) ON CONFLICT(company,id) DO UPDATE SET value=excluded.value').run(company,id,this.seal(company,id,value));
    }
    enabled() { return this.db.prepare('SELECT company FROM sessions WHERE enabled=1').all().map(row => row.company); }
    enable(company, enabled) { this.db.prepare('INSERT INTO sessions VALUES (?,?) ON CONFLICT(company) DO UPDATE SET enabled=excluded.enabled').run(company, enabled ? 1 : 0); }
    clearAuth(company) { this.db.prepare('DELETE FROM auth WHERE company=?').run(company); this.enable(company,false); }
    phoneKey(company, phone) { return createHmac('sha256',this.key).update(company+':'+phone).digest('hex'); }
    record(company, message) {
        this.db.prepare('INSERT INTO messages VALUES (?,?,?,?,?) ON CONFLICT(company,id) DO UPDATE SET value=excluded.value').run(company,message.id,this.phoneKey(company,message.phone),message.timestamp,this.seal(company,'message:'+message.id,message));
    }
    messages(company, phone) {
        return this.db.prepare('SELECT id,value FROM messages WHERE company=? AND phone=? ORDER BY occurred_at DESC,id DESC LIMIT 100').all(company,this.phoneKey(company,phone)).reverse().map(row => this.open(company,'message:'+row.id,row.value));
    }
    conversations(company) {
        return this.db.prepare(`SELECT m.id,m.value FROM messages m WHERE company=? AND rowid IN (
            SELECT MAX(rowid) FROM messages WHERE company=? GROUP BY phone) ORDER BY occurred_at DESC LIMIT 100`).all(company,company).map(row => {
            const message = this.open(company,'message:'+row.id,row.value);
            return { phone:message.phone, name:message.name || message.phone, preview:message.text, timestamp:message.timestamp };
        });
    }
    reserve(company, id, fingerprint) {
        const row = this.db.prepare('SELECT * FROM sends WHERE company=? AND id=?').get(company,id);
        if (row) return { created:false, fingerprint:row.fingerprint, status:row.status, ...this.open(company,'send:'+id,row.value) };
        this.db.prepare('INSERT INTO sends VALUES (?,?,?,?,?)').run(company,id,fingerprint,'uncertain',this.seal(company,'send:'+id,{}));
        return { created:true };
    }
    finish(company, id, value) { this.db.prepare('UPDATE sends SET status=?,value=? WHERE company=? AND id=?').run('sent',this.seal(company,'send:'+id,value),company,id); }
    close() { this.db.close(); }
}
