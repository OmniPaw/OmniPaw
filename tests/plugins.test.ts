import { PluginValidator } from '../plugins/validator';
import { PluginLoader } from '../plugins/loader';
import { ToolRegistry } from '../tools/registry';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Plugin System', () => {

    // =========================================
    // PluginValidator Tests
    // =========================================
    describe('PluginValidator', () => {
        const validator = new PluginValidator();

        test('should accept a valid manifest', () => {
            const result = validator.validate({
                name: 'plugin-weather',
                version: '1.0.0',
                description: 'Weather forecasts',
                tools: [{
                    name: 'plugin-weather.forecast',
                    description: 'Get forecast',
                    parameters: { city: 'string' },
                    handlerModule: './tools/forecast',
                    handlerExport: 'getForecast'
                }],
                permissions: ['network']
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject manifest with missing required fields', () => {
            const result = validator.validate({ name: 'test' });

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('version'))).toBe(true);
        });

        test('should reject invalid plugin name format', () => {
            const result = validator.validate({
                name: 'BAD NAME!',
                version: '1.0.0',
                description: 'Test',
                tools: [],
                permissions: []
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid plugin name'))).toBe(true);
        });

        test('should reject invalid semver', () => {
            const result = validator.validate({
                name: 'plugin-test',
                version: 'not-semver',
                description: 'Test',
                tools: [],
                permissions: []
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid version'))).toBe(true);
        });

        test('should reject unknown permissions', () => {
            const result = validator.validate({
                name: 'plugin-test',
                version: '1.0.0',
                description: 'Test',
                tools: [],
                permissions: ['teleport']
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Unknown permission'))).toBe(true);
        });

        test('should reject tools not namespaced under plugin name', () => {
            const result = validator.validate({
                name: 'plugin-test',
                version: '1.0.0',
                description: 'Test',
                tools: [{
                    name: 'wrong-namespace.tool',
                    description: 'Bad tool',
                    handlerModule: './bad',
                    handlerExport: 'fn'
                }],
                permissions: []
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('namespaced'))).toBe(true);
        });

        test('should reject tools missing handlerModule', () => {
            const result = validator.validate({
                name: 'plugin-test',
                version: '1.0.0',
                description: 'Test',
                tools: [{ name: 'plugin-test.tool', description: 'x' }],
                permissions: []
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('handlerModule'))).toBe(true);
        });
    });

    // =========================================
    // PluginLoader Tests
    // =========================================
    describe('PluginLoader', () => {

        test('should return empty array for non-existent directory', () => {
            const loader = new PluginLoader('/non/existent/path');
            const results = loader.discoverAndLoad();
            expect(results).toHaveLength(0);
        });

        test('should detect directory without manifest as invalid', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnipaw-test-'));
            const emptyPlugin = path.join(tmpDir, 'plugin-empty');
            fs.mkdirSync(emptyPlugin);

            const loader = new PluginLoader(tmpDir);
            const results = loader.discoverAndLoad();

            expect(results).toHaveLength(1);
            expect(results[0].valid).toBe(false);
            expect(results[0].errors[0]).toContain('No plugin.manifest.json');

            // Cleanup
            fs.rmSync(tmpDir, { recursive: true });
        });

        test('should reject malformed JSON manifest', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnipaw-test-'));
            const badPlugin = path.join(tmpDir, 'plugin-bad');
            fs.mkdirSync(badPlugin);
            fs.writeFileSync(path.join(badPlugin, 'plugin.manifest.json'), '{ broken json!!!', 'utf8');

            const loader = new PluginLoader(tmpDir);
            const results = loader.discoverAndLoad();

            expect(results).toHaveLength(1);
            expect(results[0].valid).toBe(false);
            expect(results[0].errors[0]).toContain('Failed to parse');

            fs.rmSync(tmpDir, { recursive: true });
        });

        test('should load the real plugin-weather example successfully', () => {
            const pluginsDir = path.resolve(__dirname, '..', 'plugins');
            const loader = new PluginLoader(pluginsDir);
            const results = loader.discoverAndLoad();

            // Find the weather plugin
            const weather = results.find(r => r.manifest.name === 'plugin-weather');
            expect(weather).toBeDefined();
            expect(weather!.valid).toBe(true);
            expect(weather!.tools.has('plugin-weather.get_forecast')).toBe(true);

            // Execute the loaded tool handler
            const forecastTool = weather!.tools.get('plugin-weather.get_forecast')!;
            const result = forecastTool.handler('test-agent', { city: 'Tokyo' });

            expect((result as any).kind).toBe('SUCCESS');
            const parsed = JSON.parse((result as any).data);
            expect(parsed.forecast.condition).toBe('Sunny');
        });

        test('should inject loaded tools into ToolRegistry', () => {
            const pluginsDir = path.resolve(__dirname, '..', 'plugins');
            const loader = new PluginLoader(pluginsDir);
            loader.discoverAndLoad();

            const registry = new ToolRegistry();
            const { injected, rejected } = loader.injectIntoRegistry(registry);

            expect(injected).toContain('plugin-weather.get_forecast');
            expect(rejected).toHaveLength(0);

            // Verify the tool is callable through the registry
            const manifest = registry.getManifest('plugin-weather.get_forecast');
            expect(manifest).toBeDefined();
            expect(manifest!.name).toBe('plugin-weather.get_forecast');
        });
    });
});
