import { EphemeralStore } from './ephemeral';
import { PersistentStore } from './persistent';
import { ExecutionLogger } from '../logging/logger';

function testMemory() {
    const agentId = 'agent-memory-test';

    // ==========================================
    // PHASE 1: EPHEMERAL STORE
    // ==========================================
    console.log("=== PHASE 1: EPHEMERAL STORE ===");
    const ephemeral = new EphemeralStore();

    const handle1 = ephemeral.init(agentId, 1);
    console.log("Init Handle 1:", handle1);

    // Write and Read
    ephemeral.write(handle1, "foo", "bar");
    ephemeral.write(handle1, "obj", { a: 1 });
    console.log("Read foo:", ephemeral.read(handle1, "foo"));

    // Immutability Check
    const readObj = ephemeral.read(handle1, "obj") as any;
    readObj.a = 2; // mutating the read object should NOT mutate the store
    console.log("Read obj after local mutation:", ephemeral.read(handle1, "obj")); // should still be { a: 1 }

    // Checkpoint & Restore
    ephemeral.checkpoint(agentId, 1);
    console.log("Checkpointed tick 1");

    // Destroy (simulate PENDING tool exit where memory mapped to next tick)
    // No, actually wait, PENDING_TOOL exit doesn't destroy, it just leaves it checkpointed.
    // The TickEngine destroys it if it produces a return. But let's verify resume.

    const handle1Restored = ephemeral.restore(agentId, 1);
    console.log("Restored Handle 1:", handle1Restored);
    console.log("Read restored foo:", ephemeral.read(handle1Restored, "foo"));

    // Destroy
    ephemeral.destroy(agentId, 1);
    try {
        ephemeral.read(handle1, "foo");
        console.log("FAIL: Was able to read after destroy");
    } catch (e: any) {
        console.log("OK: Cannot read active memory after destroy ->", e.message);
    }


    // ==========================================
    // PHASE 2: PERSISTENT STORE
    // ==========================================
    console.log("\n=== PHASE 2: PERSISTENT STORE ===");
    const logger = new ExecutionLogger();
    const persistent = new PersistentStore(logger);

    // Write and Read
    persistent.write(agentId, "theme", "dark", "tx-001");
    console.log("Read theme:", persistent.read(agentId, "theme"));

    persistent.write(agentId, "settings", { volume: 80 }, "tx-002");
    const readSettings = persistent.read(agentId, "settings") as any;
    readSettings.volume = 100;
    console.log("Read settings after local mutation:", persistent.read(agentId, "settings"));

    // Verify WAL Logging
    const logs = logger.getLogsForAgent(agentId);
    console.log("Persistent WAL Logs Count:", logs.length);
    logs.forEach(l => console.log(`[WAL] ${l.kind}: key=`, (l.payload as any).key));

    // Snapshot
    console.log("\nSnapshot dump:", persistent.snapshot(agentId));

    // Delete
    persistent.delete(agentId, "theme", "tx-003");
    console.log("Snapshot after delete:", persistent.snapshot(agentId));
}

testMemory();
