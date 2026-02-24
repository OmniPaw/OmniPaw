import { ExecutionLogger } from './logger';

function test() {
    const logger = new ExecutionLogger();

    const entry1 = logger.append({
        kind: 'TEST_EVENT',
        agentId: 'agent-1',
        timestamp: Date.now(),
        payload: { foo: 'bar' }
    });

    const entry2 = logger.append({
        kind: 'TEST_EVENT',
        agentId: 'agent-2',
        timestamp: Date.now()
    });

    console.log('Entry 1:', entry1);
    console.log('Entry 2:', entry2);

    // Verify busSeq increment
    if (entry1.busSeq === 1 && entry2.busSeq === 2) {
        console.log('BusSeq increment: OK');
    } else {
        console.log('BusSeq increment: FAILED');
    }

    // Verify immutability
    try {
        (entry1 as any).kind = 'MUTATED';
        console.log('Immutability: FAILED (was able to mutate)');
    } catch (e) {
        console.log('Immutability: OK (mutation prevented)');
    }

    // Verify filtering
    const agent1Logs = logger.getLogsForAgent('agent-1');
    if (agent1Logs.length === 1 && agent1Logs[0].agentId === 'agent-1') {
        console.log('Filtering: OK');
    } else {
        console.log('Filtering: FAILED');
    }

    console.log('All Logs:', logger.getLogs());
}

test();
