import { database } from "@/lib/database";
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const canonical = (rows) => rows.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))).sort();
export async function readD1Backup() {
    const db = database();
    if (db.captureSnapshot) return db.captureSnapshot();
    const definitions = await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'fama_restore_%' ORDER BY name").all();
    const tables = [];
    for (const definition of definitions.results) {
        if (!/^[a-z_][a-z0-9_]*$/i.test(definition.name) || !/^\s*CREATE\s+TABLE\b/i.test(definition.sql))
            throw new Error(`Estrutura local não suportada pelo backup: ${definition.name}.`);
        const info = await db.prepare(`PRAGMA table_info(${quote(definition.name)})`).all();
        const order = info.results.filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => quote(column.name)).join(',') || 'rowid';
        const rows = [];
        for (let offset = 0;; offset += 500) {
            const page = await db.prepare(`SELECT * FROM ${quote(definition.name)} ORDER BY ${order} LIMIT 500 OFFSET ?`).bind(offset).all();
            rows.push(...page.results);
            if (page.results.length < 500)
                break;
        }
        const keys = await db.prepare(`PRAGMA foreign_key_list(${quote(definition.name)})`).all();
        tables.push({ ...definition, columns: info.results.map(column => column.name), rows, foreignKeys: keys.results });
    }
    return { capturedAt: new Date().toISOString(), tables };
}
export async function verifyD1Backup(snapshot) {
    const db = database();
    if (db.verifySnapshot) return db.verifySnapshot(snapshot);
    const prefix = `fama_restore_${crypto.randomUUID().replaceAll('-', '')}_`;
    const names = new Map(snapshot.tables.map(table => [table.name, prefix + table.name]));
    const pending = [...snapshot.tables], ordered = [];
    while (pending.length) {
        const index = pending.findIndex(table => table.foreignKeys.every(key => !names.has(key.table) || ordered.some(parent => parent.name === key.table)));
        if (index < 0)
            throw new Error("O backup contém relações locais circulares que precisam de restauração assistida.");
        ordered.push(pending.splice(index, 1)[0]);
    }
    const created = [];
    try {
        for (const table of ordered) {
            const target = names.get(table.name);
            let ddl = table.sql.replace(/^(\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[a-z0-9_]+)/i, `$1${quote(target)}`);
            ddl = ddl.replace(/\bREFERENCES\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-z0-9_]+))/gi, (_match, ...values) => {
                const name = values.slice(0, 4).find(Boolean);
                if (!names.has(name))
                    throw new Error("Relação externa ausente no backup local.");
                return `REFERENCES ${quote(names.get(name))}`;
            });
            await db.prepare(ddl).run();
            created.push(target);
            for (let offset = 0; offset < table.rows.length; offset += 50) {
                await db.batch(table.rows.slice(offset, offset + 50).map(row => db.prepare(`INSERT INTO ${quote(target)} (${table.columns.map(quote).join(',')}) VALUES (${table.columns.map(() => '?').join(',')})`).bind(...table.columns.map(column => row[column] ?? null))));
            }
            const restored = await db.prepare(`SELECT * FROM ${quote(target)}`).all();
            if (JSON.stringify(canonical(restored.results)) !== JSON.stringify(canonical(table.rows)))
                throw new Error(`A restauração local divergiu na tabela ${table.name}.`);
            const foreign = await db.prepare(`PRAGMA foreign_key_check(${quote(target)})`).all();
            if (foreign.results.length)
                throw new Error(`Relação inválida na restauração local de ${table.name}.`);
        }
        return { valid: true, tables: ordered.length, records: ordered.reduce((total, table) => total + table.rows.length, 0), restoredInto: 'isolated D1 tables' };
    }
    finally {
        for (const name of created.reverse())
            await db.prepare(`DROP TABLE IF EXISTS ${quote(name)}`).run();
    }
}
