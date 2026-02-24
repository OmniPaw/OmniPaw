import * as fs from 'fs';
import * as path from 'path';
import { ToolManifest, ToolHandler, ToolResult } from '../../tools/types';

/**
 * Returns a tuple containing the Manifest and the Handler for secure File reading.
 * Uses a strict chroot-jail path to prevent directory traversal securely isolating the agent.
 */
export function createReadTool(sandboxBaseDir: string): { manifest: ToolManifest, handler: ToolHandler } {
    return {
        manifest: {
            name: 'host.fs.read_file',
            description: 'Read the contents of a file securely within the assigned sandbox bounds.',
            parameters: { relativePath: 'string' }
        },
        handler: (agentId: string, args: any): ToolResult => {
            try {
                // Ensure args are strictly provided
                if (!args.relativePath || typeof args.relativePath !== 'string') {
                    return { kind: 'ERROR', message: 'Missing or invalid relativePath strictly required.' };
                }

                // Chroot Jail Security Map (prevents ../../ out of bounds isolation escapes natively)
                const targetPath = path.resolve(sandboxBaseDir, args.relativePath);
                if (!targetPath.startsWith(path.resolve(sandboxBaseDir))) {
                    return { kind: 'ERROR', message: `SANDBOX_ESCAPED_DENIED: Path ${args.relativePath} resolves outside sandbox.` };
                }

                if (!fs.existsSync(targetPath)) {
                    return { kind: 'ERROR', message: 'FILE_NOT_FOUND' };
                }

                const data = fs.readFileSync(targetPath, 'utf8');
                return { kind: 'SUCCESS', data };
            } catch (e: any) {
                return { kind: 'ERROR', message: `FS_ERROR: ${e.message}` };
            }
        }
    };
}

/**
 * Returns a tuple containing the Manifest and the Handler for secure File writing.
 * Uses a strict chroot-jail path to prevent directory traversal natively.
 */
export function createWriteTool(sandboxBaseDir: string): { manifest: ToolManifest, handler: ToolHandler } {
    return {
        manifest: {
            name: 'host.fs.write_file',
            description: 'Write string content to a file securely within the assigned sandbox bounds.',
            parameters: { relativePath: 'string', content: 'string' }
        },
        handler: (agentId: string, args: any): ToolResult => {
            try {
                if (!args.relativePath || typeof args.relativePath !== 'string') {
                    return { kind: 'ERROR', message: 'Missing or invalid relativePath strictly required.' };
                }
                if (typeof args.content !== 'string') {
                    return { kind: 'ERROR', message: 'Missing or invalid content payload strictly required.' };
                }

                // Chroot Jail Security Map
                const targetPath = path.resolve(sandboxBaseDir, args.relativePath);
                if (!targetPath.startsWith(path.resolve(sandboxBaseDir))) {
                    return { kind: 'ERROR', message: `SANDBOX_ESCAPED_DENIED: Path ${args.relativePath} resolves outside sandbox.` };
                }

                // Ensure parent directory exists securely
                const parentDir = path.dirname(targetPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }

                fs.writeFileSync(targetPath, args.content, 'utf8');
                return { kind: 'SUCCESS', data: `Successfully wrote payload to ${args.relativePath}` };
            } catch (e: any) {
                return { kind: 'ERROR', message: `FS_WRITE_ERROR: ${e.message}` };
            }
        }
    };
}

/**
 * Returns a tuple containing the Manifest and the Handler for reading directory structures.
 */
export function createListDirTool(sandboxBaseDir: string): { manifest: ToolManifest, handler: ToolHandler } {
    return {
        manifest: {
            name: 'host.fs.list_dir',
            description: 'Returns an array of files/directories securely located at the sandbox path.',
            parameters: { relativePath: 'string' }
        },
        handler: (agentId: string, args: any): ToolResult => {
            try {
                const searchPath = args.relativePath ? args.relativePath : '.';
                if (typeof searchPath !== 'string') {
                    return { kind: 'ERROR', message: 'Invalid relativePath strictly required.' };
                }

                // Chroot Jail Security Map
                const targetPath = path.resolve(sandboxBaseDir, searchPath);
                if (!targetPath.startsWith(path.resolve(sandboxBaseDir))) {
                    return { kind: 'ERROR', message: `SANDBOX_ESCAPED_DENIED: Path ${searchPath} resolves outside sandbox.` };
                }

                if (!fs.existsSync(targetPath)) {
                    return { kind: 'ERROR', message: 'DIRECTORY_NOT_FOUND' };
                }

                const items = fs.readdirSync(targetPath, { withFileTypes: true });
                const catalog = items.map(item => ({
                    name: item.name,
                    isDirectory: item.isDirectory()
                }));
                return { kind: 'SUCCESS', data: JSON.stringify({ directory: searchPath, contents: catalog }) };
            } catch (e: any) {
                return { kind: 'ERROR', message: `FS_LIST_ERROR: ${e.message}` };
            }
        }
    };
}
