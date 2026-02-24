import { OmniKernel, KernelConfig, TickEngine, Scheduler } from '../../index';
import { FileLogger } from '../logger';
import { KernelTUI } from '../tui';
import { LlmBrainAdapter } from '../brain';
import { ToolGate } from '../../tools/gate';
import { createReadTool, createWriteTool, createListDirTool } from '../tools/fs';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrapSWE() {
    console.log("🛠 Booting Software Engineer Agent Application...");

    // 1. Storage & Config
    const logger = new FileLogger('./.storage');
    const config = new KernelConfig('LIVE');
    const kernel = new OmniKernel(logger);

    // 2. Observability TUI
    const tui = new KernelTUI(kernel.bus);
    tui.startVisualizer();

    // 3. Configure Virtual Sandbox
    const sandboxDir = path.resolve(__dirname, '../../.workspace');
    if (!fs.existsSync(sandboxDir)) {
        fs.mkdirSync(sandboxDir, { recursive: true });
    }

    // Provision an explicit workspace task mathematically guaranteed safe bounds
    fs.writeFileSync(path.join(sandboxDir, 'README.md'), '# Empty Workspace', 'utf8');

    // 4. Register Explicit OS Tools
    const readTool = createReadTool(sandboxDir);
    const writeTool = createWriteTool(sandboxDir);
    const listTool = createListDirTool(sandboxDir);

    // Explicitly mount tools onto the rigorous ToolGate
    const gate = new ToolGate(kernel.logger, config, {
        [readTool.manifest.name]: (args: any) => readTool.handler(SWE_ID, args),
        [writeTool.manifest.name]: (args: any) => writeTool.handler(SWE_ID, args),
        [listTool.manifest.name]: (args: any) => listTool.handler(SWE_ID, args)
    });

    // 5. Connect AI Engine & Boot OS
    const tickEngine = new TickEngine();
    const scheduler = new Scheduler(tickEngine, kernel.logger, kernel.lifecycle, gate, config, kernel.persistentStore);
    const brain = new LlmBrainAdapter();

    // Spawn SWE Agent!
    const SWE_ID = 'swe-agent-1';
    kernel.registry.registerAgent({ id: SWE_ID, type: 'engineer', createdAt: Date.now() });
    kernel.lifecycle.transition(SWE_ID, 'spawn');
    kernel.lifecycle.transition(SWE_ID, 'activate');

    // 6. Define complex dynamic goal
    const SWE_GOAL = "Inspect the directory. Replace the content of README.md with a greeting formatted explicitly in Markdown. Then, create a new file named `app.js` and write a simple Express.js server script into it.";

    let tickCounter = 1;
    let isTerminated = false;

    // A simple outer Run-loop tracking structural `Instructions` cleanly terminating on RETURN loops natively
    kernel.ephemeralStore.init(SWE_ID, 1);
    while (!isTerminated && tickCounter < 15) { // Cap runaway bounds explicitly
        try {
            const rawHistory = kernel.ephemeralStore.read(`${SWE_ID}:1`, 'tick_memory');
            const history = Array.isArray(rawHistory) ? rawHistory : [];

            // Evaluator deduction (LLM mapping instruction inference)
            const tickResult = await brain.spinTickRound(tickEngine, SWE_ID, tickCounter, SWE_GOAL, history);

            // If the LLM requested a Tool Call, execute it through the rigorous Gate
            if (tickResult.kind === 'PENDING_TOOL') {
                kernel.bus.emit({ kind: 'TOOL_CALL_REQUESTED', agentId: SWE_ID, toolName: tickResult.toolName, timestamp: Date.now() });
                try {
                    const toolResult = await gate.execute(SWE_ID, tickCounter, tickResult.toolName, tickResult.args);
                    console.log(`\x1b[32m[Sandbox Success]\x1b[0m Executed ${tickResult.toolName} natively.`);
                } catch (toolError: any) {
                    console.error(`\x1b[31m[Sandbox Denied]\x1b[0m ${tickResult.toolName} failed: ${toolError.message}`);
                }
            }

            // Track memory mapping inside sandboxed isolation correctly
            history.push({ tick: tickCounter, output: JSON.parse(JSON.stringify(tickResult)) });
            kernel.ephemeralStore.write(`${SWE_ID}:1`, 'tick_memory', history as any);

            // Terminate gracefully if the returned state says DONE seamlessly
            if (kernel.lifecycle.getState(SWE_ID) === 'TERMINATED') {
                isTerminated = true;
                break;
            }

            // Force artificial delay simulating asynchronous real-world IO logic explicitly
            await new Promise(r => setTimeout(r, 1500));
            tickCounter++;
        } catch (e: any) {
            console.error(`KERNEL_PANIC: TICK_${tickCounter} CRASHED > ${e.message}`);
            break;
        }
    }

    console.log("\n✅ Software Engineer Application Sequence Complete.");
}

bootstrapSWE().catch(console.error);
