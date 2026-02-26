import { DockerSandbox } from '../host/sandbox/docker';
import { createBashTool } from '../host/tools/bash';

describe('Docker Sandbox & Bash Tool Integration', () => {
    // Increase timeout for pulling alpine image if not present (although normally cached locally)
    jest.setTimeout(30000);

    let sandbox: DockerSandbox;

    beforeAll(async () => {
        sandbox = new DockerSandbox('alpine:latest');
        // Pre-pull the image so individual tests don't timeout
        await sandbox.initialize();
    });

    it('executes a command inside the container', async () => {
        const result = await sandbox.execute('echo "hello from docker"');
        expect(result.trim()).toBe('hello from docker');
    });

    it('enforces strict timeout and kills runaway processes', async () => {
        // Sleep for 10 seconds, but enforce a 1000ms timeout
        await expect(sandbox.execute('sleep 10', 1000)).rejects.toThrow(/Timeout of 1000ms exceeded/);
    });

    it('ensures filesystem isolation (cannot see Windows host)', async () => {
        // Alpine Linux uses /etc/alpine-release
        const result = await sandbox.execute('cat /etc/alpine-release');
        expect(result.length).toBeGreaterThan(0);

        // Attempting to list standard Windows drive roots should fail in alpine
        const failResult = await sandbox.execute('ls /C/ || echo "not found"');
        expect(failResult.trim()).toMatch(/not found/);
    });

    describe('Bash Tool with Sandbox', () => {
        it('routes standard execution through Docker if provided', async () => {
            const bashToolObj = createBashTool(5000, sandbox);

            const result = await bashToolObj.handler('agent-1', { command: 'expr 5 + 7' });
            expect(result.kind).toBe('SUCCESS');
            if (result.kind === 'SUCCESS') {
                expect(result.data.trim()).toBe('12');
            }
        });

        it('gracefully handles docker invocation errors as tool errors', async () => {
            const bashToolObj = createBashTool(1000, sandbox);
            // This command should timeout and return a BASH_ERROR via the Tool interface
            const result = await bashToolObj.handler('agent-1', { command: 'sleep 10' });

            expect(result.kind).toBe('ERROR');
            if (result.kind === 'ERROR') {
                expect(result.message).toMatch(/Timeout of 1000ms exceeded/);
            }
        });
    });
});
