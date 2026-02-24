import { KernelBus } from '../kernel/bus';

export class KernelTUI {
    constructor(private readonly bus: KernelBus) {
        // Clear terminal roughly mapping bash constraints
        console.clear();
        console.log(`\x1b[36m===================================================\x1b[0m`);
        console.log(`\x1b[36m      🔬 OMNI KERNEL VISUAL DASHBOARD 🔬       \x1b[0m`);
        console.log(`\x1b[36m===================================================\x1b[0m\n`);
    }

    startVisualizer(): void {
        this.bus.subscribe('*', (event) => {
            const time = new Date(event.timestamp).toISOString().split('T')[1].slice(0, 12);
            const prefix = `\x1b[90m[${time}]\x1b[0m`;

            switch (event.kind) {
                case 'AGENT_SPAWNED':
                    console.log(`${prefix} \x1b[32m[SPAWN]\x1b[0m Agent [\x1b[33m${event.agentId}\x1b[0m] entered the registry.`);
                    break;
                case 'LIFECYCLE_TRANSITION':
                    const eL = event as any;
                    console.log(`${prefix} \x1b[35m[STATE]\x1b[0m Agent [\x1b[33m${event.agentId}\x1b[0m] shifted: \x1b[90m${eL.from}\x1b[0m → \x1b[37m${eL.to}\x1b[0m (Trigger: ${eL.trigger})`);
                    break;
                case 'TICK_COMPLETED':
                    const eC = event as any;
                    console.log(`${prefix} \x1b[34m[TICK]\x1b[0m Agent [\x1b[33m${event.agentId}\x1b[0m]: Tick #${eC.tickSeq} Finished.`);
                    break;
                case 'TOOL_CALL_REQUESTED':
                    const eT = event as any;
                    console.log(`${prefix} \x1b[36m[TOOL ]\x1b[0m Agent [\x1b[33m${event.agentId}\x1b[0m] requested: \x1b[31m${eT.toolName}\x1b[0m`);
                    break;
                case 'MEMORY_ACCESS':
                    const eM = event as any;
                    console.log(`${prefix} \x1b[33m[ MEM ]\x1b[0m Agent [\x1b[33m${event.agentId}\x1b[0m] ${eM.action}: ${eM.scope}/${eM.key}`);
                    break;
                default:
                    console.log(`${prefix} \x1b[90m[EVENT]\x1b[0m Generic <${event.kind}> triggered.`);
            }
        });
    }

    renderDivergencePanic(expectedHash: string, actualHash: string): void {
        console.log(`\n\x1b[41m\x1b[37m !!! KERNEL PANIC: CRYPTOGRAPHIC DIVERGENCE !!! \x1b[0m`);
        console.log(`\x1b[31mExpected:\x1b[0m ${expectedHash}`);
        console.log(`\x1b[31mActual:  \x1b[0m ${actualHash}`);
        console.log(`\x1b[90mExecution path irrevocably compromised. Halting TickEngine immediately.\x1b[0m\n`);
    }
}
