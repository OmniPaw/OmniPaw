import { LifecycleController, ExecutionLogger } from './controller';
import { TransitionTrigger } from './types';

class MockLogger implements ExecutionLogger {
    logs: any[] = [];
    append(entry: any) {
        this.logs.push(entry);
    }
}

function test() {
    const logger = new MockLogger();
    const controller = new LifecycleController(logger);
    const agentId = 'test-agent';

    console.log('--- Initial State ---');
    console.log('State:', controller.getState(agentId)); // Should be DEFINED

    try {
        console.log('\n--- Valid Transition: spawn ---');
        controller.transition(agentId, 'spawn');
        console.log('New State:', controller.getState(agentId)); // Should be SPAWNED

        console.log('\n--- Valid Transition: activate ---');
        controller.transition(agentId, 'activate');
        console.log('New State:', controller.getState(agentId)); // Should be ACTIVE

        console.log('\n--- Invalid Transition: spawn from ACTIVE ---');
        controller.transition(agentId, 'spawn' as TransitionTrigger);
    } catch (error: any) {
        console.log('Caught Expected Error:', error.message);
    }

    console.log('\n--- Logs ---');
    logger.logs.forEach(l => console.log(JSON.stringify(l)));

    if (logger.logs.length === 2 && controller.getState(agentId) === 'ACTIVE') {
        console.log('\nLifecycle Test Passed!');
    } else {
        console.log('\nLifecycle Test Failed!');
    }
}

test();
