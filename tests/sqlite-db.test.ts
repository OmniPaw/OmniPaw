import { SqliteLogger } from '../host/db/sqlite-logger';
import { SqliteStore } from '../host/db/sqlite-store';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLite Persistence Engine', () => {
    const dbPath = './.storage/test-omnipaw.db';
    let logger: SqliteLogger;
    let store: SqliteStore;

    beforeEach(() => {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-journal')) fs.unlinkSync(dbPath + '-journal');
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

        logger = new SqliteLogger(dbPath);
        store = new SqliteStore(logger, dbPath);
    });

    afterEach(() => {
        if (store) store.close();
        if (logger) logger.close();

        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-journal')) fs.unlinkSync(dbPath + '-journal');
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
    });

    describe('SqliteLogger', () => {
        test('should append and retrieve logs structurally', () => {
            const entry1 = logger.append({
                kind: 'SPAWN',
                agentId: 'agent-1',
                timestamp: 1000,
                payload: { foo: 'bar' }
            });

            logger.append({
                kind: 'TICK',
                agentId: 'agent-2',
                timestamp: 1001,
                payload: { baz: 'qux' }
            });

            const logs = logger.getLogs();
            expect(logs.length).toBe(2);
            expect(logs[0].busSeq).toBe(1);
            expect(logs[0].kind).toBe('SPAWN');
            expect(logs[0].payload).toEqual({ foo: 'bar' });

            const agent1Logs = logger.getLogsForAgent('agent-1');
            expect(agent1Logs.length).toBe(1);
            expect(agent1Logs[0].busSeq).toBe(1);
        });
    });

    describe('SqliteStore', () => {
        test('should write and read values atomically', () => {
            store.write('agent-a', 'key-1', { score: 42 }, 'tx-001');
            const val = store.read('agent-a', 'key-1');
            expect(val).toEqual({ score: 42 });
        });

        test('should reject non-serializable values (INV-11)', () => {
            const circular: any = {};
            circular.self = circular;

            expect(() => {
                store.write('agent-a', 'key-broken', circular, 'tx-002');
            }).toThrow(/INV-11/);
        });

        test('should snapshot all keys for an agent', () => {
            store.write('agent-a', 'k1', 'v1', 'tx-1');
            store.write('agent-a', 'k2', 'v2', 'tx-2');
            store.write('agent-b', 'k3', 'v3', 'tx-3');

            const snap = store.snapshot('agent-a');
            expect(snap).toEqual({
                k1: 'v1',
                k2: 'v2'
            });
        });

        test('should delete keys correctly', () => {
            store.write('agent-a', 'k1', 'v1', 'tx-1');
            store.delete('agent-a', 'k1', 'tx-2');

            expect(store.read('agent-a', 'k1')).toBeNull();
        });

        test('writes must trigger WAL logger append (INV-02)', () => {
            const spy = jest.spyOn(logger, 'append');
            store.write('agent-c', 'k1', 'v1', 'tx-99');

            expect(spy).toHaveBeenCalled();
            const callArgs = spy.mock.calls[0][0];
            expect(callArgs.kind).toBe('MEMORY_PERSISTENT_WRITE');
            expect(callArgs.agentId).toBe('agent-c');
            expect((callArgs.payload as any).txId).toBe('tx-99');
        });
    });

    describe('Rehydration (Cold Boot)', () => {
        test('should recover state from disk on fresh instance', () => {
            // Write to first instance
            logger.append({ kind: 'A', agentId: 'ag', timestamp: 1 });
            store.write('ag', 'score', 100, 'tx-1');

            // Simulate reboot by creating new instances attached to same file
            const newLogger = new SqliteLogger(dbPath);
            const newStore = new SqliteStore(newLogger, dbPath);

            const logs = newLogger.getLogs();
            expect(logs.length).toBe(2); // The explicit log + the WAL log from the write

            const val = newStore.read('ag', 'score');
            expect(val).toBe(100);

            newStore.close();
            newLogger.close();
        });
    });
});
