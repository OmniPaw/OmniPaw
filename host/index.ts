import * as path from 'path';
import { OmniKernel } from '../kernel/index';
import { KernelConfig } from '../kernel/config';
import { FileLogger } from './logger';
import { KernelTUI } from './tui';
import { LlmBrainAdapter } from './brain';
import { ToolGate } from '../tools/gate';
import { ToolRegistry } from '../tools/registry';
import { createReadTool } from './tools/fs';
import { createFetchTool } from './tools/net';
import { TickEngine } from '../execution/tick';
import { Scheduler } from '../execution/scheduler';

async function bootstrapFullEcosystem() {
    const logDir = path.join(__dirname, '..', '.storage');
    const sandboxDir = path.join(__dirname, '..', '.sandbox');

    // 1. Storage Durability (Phase 1)
    const fileLogger = new FileLogger(logDir);
    const config = new KernelConfig('LIVE');
    const kernel = new OmniKernel(fileLogger);

    // 2. Observability TUI (Phase 4)
    const tui = new KernelTUI(kernel.bus);
    tui.startVisualizer();

    // 3. Concrete Host Tools (Phase 2)
    const toolRegistry = new ToolRegistry();
    const readTool = createReadTool(sandboxDir);
    const netTool = createFetchTool();

    toolRegistry.register(readTool.manifest, readTool.handler);
    toolRegistry.register(netTool.manifest, netTool.handler);

    const adaptedHandlers: Record<string, (args: any) => any> = {};
    for (const manifest of toolRegistry.listTools()) {
        adaptedHandlers[manifest.name] = (args: any) => toolRegistry.executeSync(manifest.name, 'system', args);
    }
    const toolGate = new ToolGate(kernel.logger, config, adaptedHandlers);

    // 4. Execution Logic
    const tickEngine = new TickEngine();
    const scheduler = new Scheduler(tickEngine, kernel.logger, kernel.lifecycle, toolGate, config, kernel.persistentStore);

    // AI Evaluator (Phase 3)
    const aiBrain = new LlmBrainAdapter();

    // Spawn Host Agent
    const AGENT_ID = 'ai-explorer-1';
    kernel.registry.registerAgent({ id: AGENT_ID, type: 'explorer', createdAt: Date.now() });

    // Natively wrapping OS lifecycle events into TUI
    kernel.bus.emit({ kind: 'AGENT_SPAWNED', agentId: AGENT_ID, timestamp: Date.now() });

    kernel.lifecycle.transition(AGENT_ID, 'spawn');
    kernel.lifecycle.transition(AGENT_ID, 'activate');

    // Natively feeding an LLM loop into the OS Scheduler deterministically
    setTimeout(async () => {
        let executionSequence = 1;

        console.log(`\n\x1b[90m--- Evaluator Loop Starting ---\x1b[0m`);

        // First dynamic Inference (will hit file system since context is clean)
        let output = await aiBrain.spinTickRound(tickEngine, AGENT_ID, executionSequence++, "Discover Host System files", {});
        kernel.bus.emit({ kind: 'TICK_COMPLETED', agentId: AGENT_ID, tickSeq: 1, timestamp: Date.now() });

        if (output.kind === 'PENDING_TOOL') {
            kernel.bus.emit({ kind: 'TOOL_CALL_REQUESTED', agentId: AGENT_ID, toolName: output.toolName, timestamp: Date.now() });
            toolGate.execute(AGENT_ID, executionSequence, output.toolName, output.args);
        }

        // Second dynamic Inference (will detect state gracefully and yield)
        output = await aiBrain.spinTickRound(tickEngine, AGENT_ID, executionSequence++, "Analyze Data further", { cache: true });
        kernel.bus.emit({ kind: 'TICK_COMPLETED', agentId: AGENT_ID, tickSeq: 2, timestamp: Date.now() });

        kernel.lifecycle.transition(AGENT_ID, 'complete');
        kernel.lifecycle.transition(AGENT_ID, 'teardown_ok');

        console.log(`\n\x1b[32mEcosystem Exited Flawlessly.\x1b[0m Check ${fileLogger.filePath} for Immutable Cryptographic State Log.`);
    }, 1000);
}

bootstrapFullEcosystem().catch(console.error);
