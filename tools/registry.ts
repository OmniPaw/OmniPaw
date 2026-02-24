import { ToolManifest, ToolHandler, ToolResult } from './types';

export class ToolRegistry {
    private tools: Map<string, ToolHandler> = new Map();
    private manifests: Map<string, ToolManifest> = new Map();

    register(manifest: ToolManifest, handler: ToolHandler): void {
        if (this.tools.has(manifest.name)) {
            throw new Error(`Tool ${manifest.name} is already registered.`);
        }

        // Freeze manifest to prevent runtime alterations
        Object.freeze(manifest);
        this.manifests.set(manifest.name, manifest);
        this.tools.set(manifest.name, handler);
    }

    getHandler(toolName: string): ToolHandler | undefined {
        return this.tools.get(toolName);
    }

    getManifest(toolName: string): ToolManifest | undefined {
        return this.manifests.get(toolName);
    }

    listTools(): ToolManifest[] {
        return Array.from(this.manifests.values());
    }

    // Pure synchronous invocation wrapper if needed by Gate
    executeSync(toolName: string, agentId: string, args: any): ToolResult {
        const handler = this.tools.get(toolName);
        if (!handler) {
            return { kind: 'ERROR', message: `Tool ${toolName} not found.` };
        }

        try {
            // The OS architecture forbids async in the core execution loop.
            // Real implementations would run these out-of-band, but for the local sim, 
            // we execute synchronously and return immediately.
            const result = handler(agentId, args);
            if (result instanceof Promise) {
                throw new Error("Async ToolHandlers are forbidden in the synchronous TickEngine.");
            }
            return result;
        } catch (e: any) {
            return { kind: 'ERROR', message: `Tool ${toolName} threw an exception: ${e.message}` };
        }
    }
}

// ---------------------------------------------------------
// Bootstrap Core OS Tools natively
// ---------------------------------------------------------
export function bootstrapCoreTools(registry: ToolRegistry): void {
    // system.read_file
    registry.register({
        name: 'system.read_file',
        description: 'Read a virtual file securely from the OS sandbox.',
        parameters: { path: 'string' }
    }, (agentId, args) => {
        // Simulated sandbox read
        if (args.path === '/etc/config') {
            return { kind: 'SUCCESS', data: 'max_retries=3\nlogging=true' };
        }
        return { kind: 'ERROR', message: `File not found in sandbox: ${args.path}` };
    });

    // system.fetch
    registry.register({
        name: 'system.fetch',
        description: 'Simulated synchronous API fetch.',
        parameters: { url: 'string' }
    }, (agentId, args) => {
        return { kind: 'SUCCESS', data: `Simulated response from ${args.url}` };
    });

    // system.ask_user
    registry.register({
        name: 'system.ask_user',
        description: 'Wait for user input.',
        parameters: { prompt: 'string' }
    }, (agentId, args) => {
        // In a real execution, this forces WAITING state until human response via Kernel Bus
        return { kind: 'SUCCESS', data: `Simulated User Reply to: ${args.prompt}` };
    });
}
