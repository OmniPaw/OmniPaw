export type BusSeq = number;

export type LogEntry = Readonly<{
    kind: string;
    agentId: string;
    timestamp: number;
    busSeq: BusSeq;
    payload?: unknown;
}>;

export class ExecutionLogger {
    private logs: LogEntry[] = [];
    private nextBusSeq: BusSeq = 1;

    append(entryWithoutSeq: Omit<LogEntry, "busSeq">): LogEntry {
        const entry: LogEntry = {
            ...entryWithoutSeq,
            busSeq: this.nextBusSeq,
        };

        this.nextBusSeq++;

        // Freeze the final log entry to ensure immutability
        Object.freeze(entry);

        this.logs.push(entry);
        return entry;
    }

    getLogs(): ReadonlyArray<LogEntry> {
        // Return a readonly copy to prevent external mutation
        return Object.freeze([...this.logs]);
    }

    getLogsForAgent(agentId: string): ReadonlyArray<LogEntry> {
        // Return a filtered readonly copy
        return Object.freeze(this.logs.filter(log => log.agentId === agentId));
    }
}
