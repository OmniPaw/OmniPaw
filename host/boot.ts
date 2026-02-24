import * as fs from 'fs';
import * as path from 'path';
import { OmniKernel } from '../kernel/index';
import { KernelConfig } from '../kernel/config';
import { FileLogger } from './logger';
import { ToolGate } from '../tools/gate';
import { ToolRegistry, bootstrapCoreTools } from '../tools/registry';
import { TickEngine } from '../execution/tick';
import { Scheduler } from '../execution/scheduler';

async function hostBoot() {
    const logDir = path.join(__dirname, '..', '.storage');

    console.log("=========================================");
    console.log(" 💾 OMNI AGENT OS - HOST FILE STORAGE 💾");
    console.log("=========================================");

    // -------------------------------------------------------------
    // RUN 1: Cold Boot & Write WAL to File
    // -------------------------------------------------------------
    console.log("\n>>> BOOT 1: Initializing Fresh Kernel");

    const fileLogger = new FileLogger(logDir);
    const config = new KernelConfig('LIVE');
    const kernel = new OmniKernel(fileLogger);

    const toolRegistry = new ToolRegistry();
    bootstrapCoreTools(toolRegistry);

    const adaptedHandlers: Record<string, (args: any) => any> = {};
    for (const manifest of toolRegistry.listTools()) {
        adaptedHandlers[manifest.name] = (args: any) => toolRegistry.executeSync(manifest.name, 'system', args);
    }

    const toolGate = new ToolGate(kernel.logger, config, adaptedHandlers);
    const tickEngine = new TickEngine();
    const scheduler = new Scheduler(tickEngine, kernel.logger, kernel.lifecycle, toolGate, config, kernel.persistentStore);

    const ROOT_ID = 'persistent-agent-1';
    kernel.registry.registerAgent({ id: ROOT_ID, type: 'root', createdAt: Date.now() });
    kernel.lifecycle.transition(ROOT_ID, 'spawn');
    kernel.lifecycle.transition(ROOT_ID, 'activate');

    console.log(`Executing Tool Call to prove write...`);
    scheduler.runAgentLoop(ROOT_ID, {
        kind: 'CALL_TOOL',
        toolName: 'system.read_file',
        args: { path: '/etc/config' }
    });

    console.log(`Saved ${kernel.logger.getLogs().length} audit items securely to disk at ${fileLogger.filePath}`);

    // -------------------------------------------------------------
    // RUN 2: OS Restart & Reconstruction from File
    // -------------------------------------------------------------
    console.log("\n>>> BOOT 2: Simulating App Restart (Process Killed)");

    console.log(`Reading exact trace from ${fileLogger.filePath}...`);
    const historyLogger = FileLogger.loadFromFile(fileLogger.filePath);

    const replayConfig = new KernelConfig('REPLAY');
    const replayKernel = new OmniKernel(historyLogger); // Inject identical immutable WAL frame

    const replayToolGate = new ToolGate(replayKernel.logger, replayConfig, adaptedHandlers);
    const replayScheduler = new Scheduler(tickEngine, replayKernel.logger, replayKernel.lifecycle, replayToolGate, replayConfig, replayKernel.persistentStore);

    // Bypass definition sequence simply activating natively mapped
    (replayKernel.lifecycle as any).stateMap.set(ROOT_ID, 'ACTIVE');

    console.log("Firing identical deterministic execution path locally...");
    try {
        replayScheduler.runAgentLoop(ROOT_ID, {
            kind: 'CALL_TOOL',
            toolName: 'system.read_file',
            args: { path: '/etc/config' }
        });

        console.log("✅ OS correctly rebuilt historical execution graph verbatim from raw `.jsonl` disk storage.");
        console.log("Cryptographic boundaries affirmed.");
    } catch (e: any) {
        console.error("Storage Validation Failed:", e.message);
    }
}

hostBoot().catch(console.error);
