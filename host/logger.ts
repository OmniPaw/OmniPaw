import * as fs from 'fs';
import * as path from 'path';
import { ExecutionLogger, LogEntry } from '../logging/logger';

export class FileLogger extends ExecutionLogger {
    private readonly fd: number;
    public readonly filePath: string;

    constructor(readonly logDir: string, existingFile?: string) {
        super();

        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        if (existingFile) {
            this.filePath = existingFile;
            this.fd = fs.openSync(this.filePath, 'a');
        } else {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.filePath = path.join(logDir, `omni-kernel-${timestamp}.jsonl`);
            this.fd = fs.openSync(this.filePath, 'a');
            console.log(`[HOST] FileLogger initialized. Writing append-only WAL to ${this.filePath}`);
        }
    }

    override append(entryWithoutSeq: Omit<LogEntry, "busSeq">): LogEntry {
        // Natively invoke base OS implementation to maintain absolute core immutability
        const entry = super.append(entryWithoutSeq);

        // Host-level side-effect: flush instantly to `.jsonl` disk
        fs.appendFileSync(this.fd, JSON.stringify(entry) + '\n');
        return entry;
    }

    /**
     * Reconstruct a FileLogger entirely from a historical JSONL dump.
     * Overrides internal arrays enabling zero-mutation Replay routing seamlessly.
     */
    static loadFromFile(filePath: string): FileLogger {
        const logger = new FileLogger(path.dirname(filePath), filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');

        for (const line of lines) {
            const entry: LogEntry = JSON.parse(line);
            // By-passing wrapper layers forcing exact history mapping structurally
            (logger as any).logs.push(entry);
            (logger as any).nextBusSeq = Math.max((logger as any).nextBusSeq, entry.busSeq + 1);
        }

        Object.freeze((logger as any).logs); // Hard-freeze arrays preserving native framework rules
        console.log(`[HOST] FileLogger restored from disk. Loaded ${lines.length} historical tuples.`);
        return logger;
    }
}
