import { PluginManifest } from './types';

/**
 * Validates plugin manifests for structural integrity and security constraints.
 * Malformed or dangerous plugins are rejected before they touch the kernel.
 */
export class PluginValidator {
    private static readonly REQUIRED_FIELDS: (keyof PluginManifest)[] = [
        'name', 'version', 'description', 'tools', 'permissions'
    ];

    private static readonly VALID_PERMISSIONS = new Set([
        'network', 'filesystem', 'shell', 'memory', 'delegation'
    ]);

    private static readonly NAME_REGEX = /^[a-z][a-z0-9\-]{2,63}$/;

    validate(manifest: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 1. Required fields check
        for (const field of PluginValidator.REQUIRED_FIELDS) {
            if (manifest[field] === undefined || manifest[field] === null) {
                errors.push(`Missing required field: "${field}"`);
            }
        }

        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // 2. Name format (lowercase, alphanumeric + hyphens, 3-64 chars)
        if (!PluginValidator.NAME_REGEX.test(manifest.name)) {
            errors.push(`Invalid plugin name "${manifest.name}". Must match: lowercase, 3-64 chars, alphanumeric + hyphens.`);
        }

        // 3. Version format (simple semver check)
        if (typeof manifest.version !== 'string' || !manifest.version.match(/^\d+\.\d+\.\d+$/)) {
            errors.push(`Invalid version "${manifest.version}". Must be semver (e.g. 1.0.0).`);
        }

        // 4. Tools must be an array
        if (!Array.isArray(manifest.tools)) {
            errors.push(`"tools" must be an array.`);
        } else {
            for (let i = 0; i < manifest.tools.length; i++) {
                const tool = manifest.tools[i];
                if (!tool.name || typeof tool.name !== 'string') {
                    errors.push(`Tool at index ${i} missing valid "name".`);
                }
                if (!tool.handlerModule || typeof tool.handlerModule !== 'string') {
                    errors.push(`Tool "${tool.name || i}" missing "handlerModule".`);
                }
                if (!tool.handlerExport || typeof tool.handlerExport !== 'string') {
                    errors.push(`Tool "${tool.name || i}" missing "handlerExport".`);
                }
            }
        }

        // 5. Permissions must be valid tokens
        if (!Array.isArray(manifest.permissions)) {
            errors.push(`"permissions" must be an array.`);
        } else {
            for (const perm of manifest.permissions) {
                if (!PluginValidator.VALID_PERMISSIONS.has(perm)) {
                    errors.push(`Unknown permission: "${perm}". Valid: ${[...PluginValidator.VALID_PERMISSIONS].join(', ')}`);
                }
            }
        }

        // 6. Tool names must be namespaced under plugin name
        if (Array.isArray(manifest.tools) && typeof manifest.name === 'string') {
            for (const tool of manifest.tools) {
                if (tool.name && !tool.name.startsWith(`${manifest.name}.`)) {
                    errors.push(`Tool "${tool.name}" must be namespaced under plugin "${manifest.name}." (e.g. "${manifest.name}.${tool.name}").`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }
}
