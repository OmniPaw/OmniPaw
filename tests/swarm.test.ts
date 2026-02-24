import { SwarmProtocol } from '../swarm/protocol';
import { SwarmCoordinator } from '../swarm/coordinator';
import { KernelBus } from '../kernel/bus';

describe('Multi-Agent Swarm', () => {

    // =========================================
    // SwarmProtocol Tests
    // =========================================
    describe('SwarmProtocol', () => {
        let bus: KernelBus;
        let protocol: SwarmProtocol;

        beforeEach(() => {
            bus = new KernelBus();
            protocol = new SwarmProtocol(bus);
        });

        test('should deliver messages to channel subscribers', () => {
            const received: any[] = [];
            protocol.subscribe('agent-1', 'tasks', (msg) => received.push(msg));

            protocol.send({
                from: 'leader',
                to: 'agent-1',
                channel: 'tasks',
                payload: { work: 'analyze file' },
                timestamp: Date.now()
            });

            expect(received).toHaveLength(1);
            expect(received[0].payload.work).toBe('analyze file');
        });

        test('should broadcast to all subscribers on a channel', () => {
            const received1: any[] = [];
            const received2: any[] = [];
            protocol.subscribe('agent-1', 'announce', (msg) => received1.push(msg));
            protocol.subscribe('agent-2', 'announce', (msg) => received2.push(msg));

            protocol.broadcast('leader', 'announce', { event: 'START' });

            expect(received1).toHaveLength(1);
            expect(received2).toHaveLength(1);
        });

        test('should maintain an immutable message log', () => {
            protocol.broadcast('a', 'ch', { x: 1 });
            protocol.broadcast('b', 'ch', { x: 2 });

            const log = protocol.getMessageLog();
            expect(log).toHaveLength(2);
            expect(Object.isFrozen(log)).toBe(true);
        });

        test('majority vote should accept when > 50% approve', () => {
            const result = protocol.requestVote(
                { proposer: 'a', proposal: 'merge', voters: ['a', 'b', 'c'] },
                new Map([['a', true], ['b', true], ['c', false]])
            );

            expect(result.accepted).toBe(true);
            expect(result.quorum).toBe(2);
        });

        test('majority vote should reject when < 50% approve', () => {
            const result = protocol.requestVote(
                { proposer: 'a', proposal: 'merge', voters: ['a', 'b', 'c'] },
                new Map([['a', true], ['b', false], ['c', false]])
            );

            expect(result.accepted).toBe(false);
        });

        test('consensus should require unanimous agreement', () => {
            const pass = protocol.reachConsensus(
                { proposer: 'a', proposal: 'deploy', voters: ['a', 'b'] },
                new Map([['a', true], ['b', true]])
            );
            expect(pass.accepted).toBe(true);

            const fail = protocol.reachConsensus(
                { proposer: 'a', proposal: 'deploy', voters: ['a', 'b'] },
                new Map([['a', true], ['b', false]])
            );
            expect(fail.accepted).toBe(false);
        });
    });

    // =========================================
    // SwarmCoordinator Tests
    // =========================================
    describe('SwarmCoordinator', () => {
        let bus: KernelBus;

        beforeEach(() => {
            bus = new KernelBus();
        });

        test('should elect the first agent as leader deterministically', () => {
            const coord = new SwarmCoordinator(bus, {
                agentIds: ['agent-a', 'agent-b', 'agent-c'],
                goal: 'Analyze codebase',
                strategy: 'MAP_REDUCE'
            });

            const leader = coord.electLeader();
            expect(leader).toBe('agent-a');
        });

        test('MAP_REDUCE: should split, work, and merge correctly', () => {
            const coord = new SwarmCoordinator(bus, {
                agentIds: ['reader', 'planner', 'patcher'],
                goal: 'Fix all TODOs',
                strategy: 'MAP_REDUCE'
            });

            const result = coord.execute(
                // Splitter: divide goal into subtasks
                (goal, count) => ['read code', 'plan fixes', 'apply patches'],
                // Worker: each agent produces a result
                (agentId, task) => `${agentId} completed: ${task}`,
                // Merger: combine all results
                (results) => Array.from(results.values()).join(' | ')
            );

            expect(result.strategy).toBe('MAP_REDUCE');
            expect(result.leader).toBe('reader');
            expect(result.agentResults.size).toBe(3);
            expect(result.finalResult).toContain('reader completed');
            expect(result.finalResult).toContain('patcher completed');
            expect(result.messageCount).toBeGreaterThan(0);
        });

        test('PIPELINE: should chain agent outputs sequentially', () => {
            const coord = new SwarmCoordinator(bus, {
                agentIds: ['tokenizer', 'analyzer', 'reporter'],
                goal: 'raw data',
                strategy: 'PIPELINE'
            });

            const result = coord.execute(
                (goal, count) => [goal],
                (agentId, input) => `${agentId}(${input})`,
                (results) => ''
            );

            expect(result.strategy).toBe('PIPELINE');
            expect(result.finalResult).toBe('reporter(analyzer(tokenizer(raw data)))');
        });

        test('CONSENSUS: should use leader result as final', () => {
            const coord = new SwarmCoordinator(bus, {
                agentIds: ['agent-a', 'agent-b'],
                goal: 'Agree on fix',
                strategy: 'CONSENSUS'
            });

            const result = coord.execute(
                (goal, count) => ['task-1', 'task-2'],
                (agentId, task) => `${agentId}-result`,
                (results) => ''
            );

            expect(result.strategy).toBe('CONSENSUS');
            expect(result.finalResult).toBe('agent-a-result');
        });

        test('should throw on empty swarm', () => {
            const coord = new SwarmCoordinator(bus, {
                agentIds: [],
                goal: 'Test',
                strategy: 'MAP_REDUCE'
            });

            expect(() => coord.electLeader()).toThrow('SWARM_EMPTY');
        });
    });
});
