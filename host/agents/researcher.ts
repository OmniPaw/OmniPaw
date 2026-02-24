import { OmniKernel, KernelConfig, TickEngine, Scheduler } from '../../index';
import { FileLogger } from '../logger';
import { KernelTUI } from '../tui';
import { ToolGate } from '../../tools/gate';
import { createBashTool } from '../tools/bash';
import { createBrowserTool, closeBrowser } from '../tools/browser';

async function bootstrapResearcher() {
    console.log("🌐 Booting Web Researcher & System Automation Agent...");

    const logger = new FileLogger('./.storage');
    const config = new KernelConfig('LIVE');
    const kernel = new OmniKernel(logger);

    const tui = new KernelTUI(kernel.bus);
    tui.startVisualizer();

    // Register Advanced Tools
    const bashTool = createBashTool();
    const browserTool = createBrowserTool();

    // Map strictly to the rigor of the OS logic
    const gate = new ToolGate(kernel.logger, config, {
        [bashTool.manifest.name]: (args: any) => bashTool.handler(AGENT_ID, args),
        [browserTool.manifest.name]: (args: any) => browserTool.handler(AGENT_ID, args)
    });

    const tickEngine = new TickEngine();
    const scheduler = new Scheduler(tickEngine, kernel.logger, kernel.lifecycle, gate, config, kernel.persistentStore!);

    // Spawn Agent
    const AGENT_ID = 'researcher-alpha';
    kernel.registry.registerAgent({ id: AGENT_ID, type: 'os_explorer', createdAt: Date.now() });
    kernel.lifecycle.transition(AGENT_ID, 'spawn');
    kernel.lifecycle.transition(AGENT_ID, 'activate');

    // Mapped manual asynchronous loop testing exact instructions against deterministic sandboxes natively
    const executeStep = async (step: number, instruction: any) => {
        const tickInput = { agentId: AGENT_ID, sequenceNumber: step, instruction, maxSteps: 10 };
        const tickResult = tickEngine.runTick(tickInput);

        if (tickResult.kind === 'PENDING_TOOL') {
            kernel.bus.emit({ kind: 'TOOL_CALL_REQUESTED', agentId: AGENT_ID, toolName: tickResult.toolName, timestamp: Date.now() });
            try {
                const out = await gate.execute(AGENT_ID, step, tickResult.toolName, tickResult.args);
                console.log(`\x1b[32m[Tool Success]\x1b[0m Payload retrieved. Size: ${JSON.stringify(out).length} bytes`);
            } catch (e: any) {
                console.error(`\x1b[31m[Tool Denied]\x1b[0m ${e.message}`);
            }
        }
        await new Promise(r => setTimeout(r, 800)); // OS Tick Buffer
    };

    // Instruction 1: Run a controlled safe OS diagnostic ping natively securely
    await executeStep(1, {
        kind: 'CALL_TOOL',
        toolName: 'host.system.bash',
        args: { command: 'echo "Deterministic Kernel Execution Alive" && node -v' }
    });

    // Instruction 2: Fetch and evaluate external HTTP payload mappings using Chromium
    await executeStep(2, {
        kind: 'CALL_TOOL',
        toolName: 'host.web.browser',
        args: { url: 'https://example.com' }
    });

    kernel.lifecycle.transition(AGENT_ID, 'complete');
    kernel.lifecycle.transition(AGENT_ID, 'teardown_ok');

    console.log("\n✅ Web Researcher Sequence Complete.");

    // Explicit teardown closing orphan Chromium resources mapping cleanly
    await closeBrowser();

    setTimeout(() => {
        process.exit(0);
    }, 500);
}

bootstrapResearcher().catch(console.error);
