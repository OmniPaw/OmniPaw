import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolManifest, ToolHandler, ToolResult } from '../../tools/types';

const execAsync = promisify(exec);

export function createBashTool(timeoutMs: number = 5000): { manifest: ToolManifest, handler: ToolHandler } {
    return {
        manifest: {
            name: 'host.system.bash',
            description: 'Execute shell commands natively with strict timeouts.',
            parameters: { command: 'string' }
        },
        handler: async (agentId: string, args: any): Promise<ToolResult> => {
            try {
                if (!args.command || typeof args.command !== 'string') {
                    return { kind: 'ERROR', message: 'Missing or invalid command strictly required.' };
                }

                const { stdout, stderr } = await execAsync(args.command, { timeout: timeoutMs });

                const output = (stdout || '') + (stderr || '');
                return { kind: 'SUCCESS', data: output.trim().substring(0, 4000) };
            } catch (e: any) {
                return { kind: 'ERROR', message: `BASH_ERROR: ${e.message}` };
            }
        }
    };
}
