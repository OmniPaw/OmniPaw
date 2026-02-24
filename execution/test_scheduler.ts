import { Scheduler } from './scheduler';
import { TickEngine } from './tick';
import { ExecutionLogger } from '../logging/logger';
import { LifecycleController } from '../lifecycle/controller';
import { ToolGate } from '../tools/gate';
import { KernelConfig } from '../kernel/config';

function test() {
    const logger = new ExecutionLogger();
    const config = new KernelConfig('LIVE');
    const lifecycle = new LifecycleController(logger);
    const tickEngine = new TickEngine();
    const toolGate = new ToolGate(logger, config, {});
    const scheduler = new Scheduler(tickEngine, logger, lifecycle, toolGate, config);

    const testAgentId = 'agent-1';

    // Setup lifecycle state
    lifecycle.transition(testAgentId, 'spawn');
    lifecycle.transition(testAgentId, 'activate');

    console.log('--- Initial State ---');
    console.log(lifecycle.getState(testAgentId)); // ACTIVE

    console.log('\n--- Running NOOP Instruction ---');
    scheduler.runAgentLoop(testAgentId, { kind: 'NOOP' });
    console.log('State after NOOP:', lifecycle.getState(testAgentId)); // TERMINATED

    console.log('\n--- Resetting Agent for PENDING_TOOL ---');
    // Hack for testing: manually overwrite state sinceTERMINATED is sink state
    (lifecycle as any).stateMap.set(testAgentId, 'ACTIVE');

    scheduler.runAgentLoop(testAgentId, { kind: 'CALL_TOOL', toolName: 'testTool', args: {} });
    console.log('State after CALL_TOOL:', lifecycle.getState(testAgentId)); // WAITING

    console.log('\n--- Logs ---');
    logger.getLogs().forEach(l => console.log(JSON.stringify(l, null, 2)));
}

test();
