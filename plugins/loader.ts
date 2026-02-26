import * as fs from 'fs';
import * as path from 'path';
import { PluginManifest, LoadedPlugin, PluginToolDeclaration } from './types';
import { PluginValidator } from './validator';
import { ToolManifest, ToolHandler } from '../tools/types';
import { ToolRegistry } from '../tools/registry';

/**
 * Discovers, validates, and loads plugins from a directory.
 * Each plugin lives in its own directory with a `plugin.manifest.json`.
 * 
 * Directory structure:
 * ```
 * plugins/
 *   plugin-weather/
 *     plugin.manifest.json
 *     tools/
 *       forecast.ts
 * ```
 */
export class PluginLoader {
    private validator = new PluginValidator();
    private loaded: Map<string, LoadedPlugin> = new Map();

    constructor(private readonly pluginsDir: string) { }

    /**
     * Discovers all plugins in the plugins directory, validates them,
     * and loads their tool handlers.
     */
    discoverAndLoad(): LoadedPlugin[] {
        const results: LoadedPlugin[] = [];

        if (!fs.existsSync(this.pluginsDir)) {
            return results;
        }

        const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
        const pluginDirs = entries.filter(e => e.isDirectory());

        for (const dir of pluginDirs) {
            const pluginPath = path.join(this.pluginsDir, dir.name);
            const manifestPath = path.join(pluginPath, 'plugin.manifest.json');

            if (!fs.existsSync(manifestPath)) {
                results.push({
                    manifest: { name: dir.name, version: '0.0.0', description: '', tools: [], permissions: [] },
                    tools: new Map(),
                    valid: false,
                    errors: [`No plugin.manifest.json found in ${dir.name}/`]
                });
                continue;
            }

            try {
                const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                const validation = this.validator.validate(rawManifest);

                if (!validation.valid) {
                    results.push({
                        manifest: rawManifest,
                        tools: new Map(),
                        valid: false,
                        errors: validation.errors
                    });
                    continue;
                }

                const manifest: PluginManifest = Object.freeze(rawManifest);
                const toolMap = this.loadToolHandlers(manifest, pluginPath);

                const loadedPlugin: LoadedPlugin = {
                    manifest,
                    tools: toolMap.tools,
                    valid: toolMap.errors.length === 0,
                    errors: toolMap.errors
                };

                this.loaded.set(manifest.name, loadedPlugin);
                results.push(loadedPlugin);

            } catch (e: any) {
                results.push({
                    manifest: { name: dir.name, version: '0.0.0', description: '', tools: [], permissions: [] },
                    tools: new Map(),
                    valid: false,
                    errors: [`Failed to parse manifest: ${e.message}`]
                });
            }
        }

        return results;
    }

    /**
     * Injects all successfully loaded plugin tools into a ToolRegistry.
     */
    injectIntoRegistry(registry: ToolRegistry): { injected: string[]; rejected: string[] } {
        const injected: string[] = [];
        const rejected: string[] = [];

        for (const [pluginName, plugin] of this.loaded) {
            if (!plugin.valid) {
                rejected.push(pluginName);
                continue;
            }

            for (const [toolName, toolDef] of plugin.tools) {
                try {
                    registry.register(toolDef.manifest, toolDef.handler);
                    injected.push(toolName);
                } catch (e: any) {
                    rejected.push(toolName);
                }
            }
        }

        return { injected, rejected };
    }

    getLoadedPlugins(): ReadonlyMap<string, LoadedPlugin> {
        return this.loaded;
    }

    private loadToolHandlers(
        manifest: PluginManifest,
        pluginDir: string
    ): { tools: Map<string, { manifest: ToolManifest; handler: ToolHandler }>; errors: string[] } {
        const tools = new Map<string, { manifest: ToolManifest; handler: ToolHandler }>();
        const errors: string[] = [];

        for (const toolDecl of manifest.tools) {
            try {
                const modulePath = path.resolve(pluginDir, toolDecl.handlerModule);

                if (!fs.existsSync(modulePath) && !fs.existsSync(modulePath + '.ts') && !fs.existsSync(modulePath + '.js')) {
                    errors.push(`Tool "${toolDecl.name}": handler module not found at ${toolDecl.handlerModule}`);
                    continue;
                }

                // Dynamic require of the tool handler module
                const mod = require(modulePath);
                const handlerFn = mod[toolDecl.handlerExport];

                if (typeof handlerFn !== 'function') {
                    errors.push(`Tool "${toolDecl.name}": export "${toolDecl.handlerExport}" is not a function in ${toolDecl.handlerModule}`);
                    continue;
                }

                const toolManifest: ToolManifest = {
                    name: toolDecl.name,
                    description: toolDecl.description || '',
                    parameters: toolDecl.parameters || {}
                };

                tools.set(toolDecl.name, { manifest: toolManifest, handler: handlerFn });

            } catch (e: any) {
                errors.push(`Tool "${toolDecl.name}": failed to load handler — ${e.message}`);
            }
        }

        return { tools, errors };
    }
}
