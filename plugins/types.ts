import { ToolManifest, ToolHandler } from '../tools/types';

/**
 * Declarative schema for a plugin's manifest file (plugin.manifest.json).
 * Each plugin must declare its name, version, the tools it provides,
 * and the permissions it requires to operate.
 */
export type PluginManifest = Readonly<{
    name: string;
    version: string;
    description: string;
    author?: string;

    /** Tool declarations this plugin provides */
    tools: PluginToolDeclaration[];

    /** 
     * Permissions this plugin requires. 
     * Tools outside these permissions are rejected at boot.
     */
    permissions: PluginPermission[];
}>;

export type PluginToolDeclaration = {
    name: string;
    description: string;
    parameters: Record<string, any>;
    /** Relative path to the handler module from the plugin root */
    handlerModule: string;
    /** Exported function name inside the handler module */
    handlerExport: string;
};

/**
 * Granular permission tokens. Plugins must declare what they need.
 * The kernel rejects tools that exceed declared permissions.
 */
export type PluginPermission =
    | 'network'      // Can make HTTP requests
    | 'filesystem'   // Can read/write files in sandbox
    | 'shell'        // Can execute bash commands
    | 'memory'       // Can access PersistentStore
    | 'delegation';  // Can delegate to other agents

export type LoadedPlugin = {
    manifest: PluginManifest;
    tools: Map<string, { manifest: ToolManifest; handler: ToolHandler }>;
    valid: boolean;
    errors: string[];
};
