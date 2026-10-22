import { DatabaseSync } from 'node:sqlite';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const normalize = value => typeof value === 'boolean' ? Number(value) : value === undefined ? null : value;

class Statement {
    constructor(database, sql, values = []) {
        this.database = database;
        this.sql = sql;
        this.values = values.map(normalize);
    }

    bind(...values) {
        return new Statement(this.database, this.sql, values);
    }

    execute() {
        const connection = this.database.connection;
        const before = connection.prepare('SELECT total_changes() AS n').get().n;
        const started = performance.now();
        const results = connection.prepare(this.sql).all(...this.values).map(row => ({ ...row }));
        const state = connection.prepare('SELECT total_changes() AS n, last_insert_rowid() AS id').get();
        return {
            success: true,
            results,
            meta: { changes: state.n - before, last_row_id: state.id, duration: performance.now() - started },
        };
    }

    async all() { return this.execute(); }
    async run() { return this.execute(); }

    async first(column) {
        const row = this.database.connection.prepare(this.sql).get(...this.values);
        if (!row) return null;
        if (column !== undefined && !Object.hasOwn(row, column)) throw new Error('Coluna ausente na consulta.');
        return column === undefined ? { ...row } : row[column];
    }

    async raw({ columnNames = false } = {}) {
        const statement = this.database.connection.prepare(this.sql);
        statement.setReturnArrays(true);
        const rows = statement.all(...this.values);
        return columnNames ? [statement.columns().map(column => column.name), ...rows] : rows;
    }
}

/** Compatibility for the existing query layer; storage is a local SQLite file. */
export class VpsSQLite {
    constructor(filename, { allowCreate = false } = {}) {
        if (filename !== ':memory:') {
            if (!existsSync(filename) && !allowCreate) {
                throw new Error('Importe o backup do banco antes de iniciar a VPS.');
            }
            mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
        }
        this.connection = new DatabaseSync(filename, { enableForeignKeyConstraints: true });
        this.connection.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
        if (filename !== ':memory:') chmodSync(filename, 0o600);
    }

    prepare(sql) { return new Statement(this, sql); }

    async batch(statements) {
        if (!Array.isArray(statements) || statements.some(item => !(item instanceof Statement) || item.database !== this)) {
            throw new Error('Lote de consultas inválido.');
        }
        this.connection.exec('BEGIN IMMEDIATE');
        try {
            const results = statements.map(statement => statement.execute());
            this.connection.exec('COMMIT');
            return results;
        } catch (error) {
            this.connection.exec('ROLLBACK');
            throw error;
        }
    }

    async exec(sql) {
        const started = performance.now();
        this.connection.exec(sql);
        return { count: 0, duration: performance.now() - started };
    }

    close() { this.connection.close(); }
}
