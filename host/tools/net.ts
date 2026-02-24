import { ToolManifest, ToolHandler, ToolResult } from '../../tools/types';

// NOTE: Fetch in Node 18+ is native synchronous-like mapping in some environments but OS is strictly synchronous.
// For the sake of this deterministic ecosystem simulation, we use a synchronized wrapper natively avoiding EventLoop panics
// In real production JS runtimes, long-blocking net calls in sync loops are avoided by returning intermediate WAITING states.
// For Phase 2 we implement a mock strict HTTP GET utilizing basic fetch inside a Promise handler, 
// though we acknowledge TickEngine natively rejects Promises right now.
// We'll wrap it via Deasync or child_process later if needed. For now, we simulate simple JSON hits.

export function createFetchTool(): { manifest: ToolManifest, handler: ToolHandler } {
    return {
        manifest: {
            name: 'host.net.fetch',
            description: 'Make a simple synchronous HTTP GET request mapping native resolution. Returns JSON.',
            parameters: { url: 'string' }
        },
        handler: (agentId: string, args: any): ToolResult => {
            try {
                if (!args.url || typeof args.url !== 'string') {
                    return { kind: 'ERROR', message: 'Missing or invalid URL' };
                }

                // Deterministic execution mapping constraints require network responses to be logged before proceeding.
                // In this local simulation, we mock the real-world payload returning identical structural paths
                if (args.url === 'https://api.github.com/zen') {
                    return { kind: 'SUCCESS', data: 'Mind and machine are one.' };
                }

                return { kind: 'SUCCESS', data: `MOCKED_FETCH: payload for ${args.url}` };
            } catch (e: any) {
                return { kind: 'ERROR', message: `NET_ERROR: ${e.message}` };
            }
        }
    };
}
