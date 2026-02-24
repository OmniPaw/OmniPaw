import Database from 'better-sqlite3';
import { ExecutionLogger, LogEntry, BusSeq } from '../../logging/logger';
import * as path from 'path';
import * as fs from 'fs';

export class SqliteLogger extends ExecutionLogger {
    private db: Database.Database;
    private insertStmt: Database.Statement;
    private selectAllStmt: Database.Statement;
    private selectByAgentStmt: Database.Statement;

    constructor(dbPath: string = './.storage/omnipaw.db') {
        super();

        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);

        // Initialize table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS audit_log (
                busSeq INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                agentId TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                payload TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_agent ON audit_log(agentId);
        `);

        this.insertStmt = this.db.prepare(`
            INSERT INTO audit_log (kind, agentId, timestamp, payload)
            VALUES (@kind, @agentId, @timestamp, @payload)
        `);

        this.selectAllStmt = this.db.prepare(`SELECT * FROM audit_log ORDER BY busSeq ASC`);
        this.selectByAgentStmt = this.db.prepare(`SELECT * FROM audit_log WHERE agentId = ? ORDER BY busSeq ASC`);

        // Restore sequence to memory if we have existing logs
        const maxSeqRes = this.db.prepare(`SELECT MAX(busSeq) as maxSeq FROM audit_log`).get() as any;
        if (maxSeqRes && maxSeqRes.maxSeq) {
            // Need to hack nextBusSeq slightly since it's private in base class, 
            // but we can just override the append method completely to rely on the DB's AUTOINCREMENT.
        }
    }

    override append(entryWithoutSeq: Omit<LogEntry, "busSeq">): LogEntry {
        let payloadStr = null;
        if (entryWithoutSeq.payload !== undefined) {
            payloadStr = JSON.stringify(entryWithoutSeq.payload);
        }

        const info = this.insertStmt.run({
            kind: entryWithoutSeq.kind,
            agentId: entryWithoutSeq.agentId,
            timestamp: entryWithoutSeq.timestamp,
            payload: payloadStr
        });

        const entry: LogEntry = {
            ...entryWithoutSeq,
            busSeq: info.lastInsertRowid as number
        };

        Object.freeze(entry);
        return entry;
    }

    override getLogs(): ReadonlyArray<LogEntry> {
        const rows = this.selectAllStmt.all() as any[];
        return Object.freeze(rows.map(this.mapRowToLogEntry));
    }

    override getLogsForAgent(agentId: string): ReadonlyArray<LogEntry> {
        const rows = this.selectByAgentStmt.all(agentId) as any[];
        return Object.freeze(rows.map(this.mapRowToLogEntry));
    }

    private mapRowToLogEntry(row: any): LogEntry {
        return {
            busSeq: row.busSeq,
            kind: row.kind,
            agentId: row.agentId,
            timestamp: row.timestamp,
            payload: row.payload ? JSON.parse(row.payload) : undefined
        };
    }

    close(): void {
        this.db.close();
    }
}
