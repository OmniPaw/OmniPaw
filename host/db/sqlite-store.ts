import Database from 'better-sqlite3';
import { PersistentStore } from '../../memory/persistent';
import { ExecutionLogger } from '../../logging/logger';
import { AgentId, TxId, Value, WriteResult } from '../../memory/types';
import * as path from 'path';
import * as fs from 'fs';

export class SqliteStore extends PersistentStore {
    private db: Database.Database;
    private writeStmt: Database.Statement;
    private readStmt: Database.Statement;
    private deleteStmt: Database.Statement;
    private snapshotStmt: Database.Statement;
    private loggerRef: ExecutionLogger;

    constructor(logger: ExecutionLogger, dbPath: string = './.storage/omnipaw.db') {
        super(logger);
        this.loggerRef = logger;

        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS agent_memory (
                agentId TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (agentId, key)
            );
        `);

        this.writeStmt = this.db.prepare(`
            INSERT INTO agent_memory (agentId, key, value)
            VALUES (@agentId, @key, @value)
            ON CONFLICT(agentId, key) DO UPDATE SET value = excluded.value
        `);

        this.readStmt = this.db.prepare(`SELECT value FROM agent_memory WHERE agentId = ? AND key = ?`);
        this.deleteStmt = this.db.prepare(`DELETE FROM agent_memory WHERE agentId = ? AND key = ?`);
        this.snapshotStmt = this.db.prepare(`SELECT key, value FROM agent_memory WHERE agentId = ?`);
    }

    override read(agentId: AgentId, key: string): Value | null {
        const row = this.readStmt.get(agentId, key) as any;
        if (!row) return null;
        return JSON.parse(row.value);
    }

    override write(agentId: AgentId, key: string, value: Value, txId: TxId): WriteResult {
        // Verify serializability (INV-11)
        let serializableValue: string;
        try {
            const parsed = JSON.parse(JSON.stringify(value));
            serializableValue = JSON.stringify(parsed);
        } catch (e) {
            throw new Error(`Value is not JSON serializable (INV-11): ${key}`);
        }

        // WAL (INV-02)
        this.loggerRef.append({
            kind: 'MEMORY_PERSISTENT_WRITE',
            agentId,
            timestamp: Date.now(),
            payload: { txId, key, value: JSON.parse(serializableValue) }
        });

        this.writeStmt.run({
            agentId,
            key,
            value: serializableValue
        });

        return {
            success: true,
            txId,
            timestamp: Date.now()
        };
    }

    override delete(agentId: AgentId, key: string, txId: TxId): WriteResult {
        // WAL (INV-02)
        this.loggerRef.append({
            kind: 'MEMORY_PERSISTENT_DELETE',
            agentId,
            timestamp: Date.now(),
            payload: { txId, key }
        });

        this.deleteStmt.run(agentId, key);

        return {
            success: true,
            txId,
            timestamp: Date.now()
        };
    }

    override snapshot(agentId: AgentId): Record<string, Value> {
        const rows = this.snapshotStmt.all(agentId) as any[];
        const result: Record<string, Value> = {};
        for (const row of rows) {
            result[row.key] = JSON.parse(row.value);
        }
        return result;
    }

    close(): void {
        this.db.close();
    }
}
