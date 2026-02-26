import { AgentRegistry } from '../../identity/registry';
import { AgentId } from '../../memory/types';
import { HostGitTools } from '../tools/git';
import { createReadTool, createWriteTool, createListDirTool } from '../tools/fs';
import { createBashTool } from '../tools/bash';
import * as path from 'path';

export function spawnDevinAgent(registry: AgentRegistry): AgentId {
    const id = 'omnidevin';
    registry.registerAgent({
        id,
        type: 'devin',
        name: 'OmniPaw Advanced SWE',
        version: '1.0.0',
        createdAt: Date.now()
    });
    return id;
}

export function registerDevinTools(registry: any): void {
    const sandboxDir = path.resolve('.workspace');

    // Register Git Tools
    for (const [name, toolDef] of Object.entries(HostGitTools)) {
        registry.registerTool(name, toolDef);
    }

    // Register FS Tools
    registry.registerTool('host.fs.read_file', createReadTool(sandboxDir));
    registry.registerTool('host.fs.write_file', createWriteTool(sandboxDir));
    registry.registerTool('host.fs.list_dir', createListDirTool(sandboxDir));

    // Register Bash Tool
    registry.registerTool('host.system.bash', createBashTool());
}
