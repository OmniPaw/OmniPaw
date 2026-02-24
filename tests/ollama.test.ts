import { OllamaAdapter } from '../host/adapters/ollama';

// Mock fetch globally
(global as any).fetch = jest.fn();

describe('OllamaAdapter', () => {
    let adapter: OllamaAdapter;

    beforeEach(() => {
        adapter = new OllamaAdapter();
        ((global as any).fetch as jest.Mock).mockClear();
    });

    test('should parse valid JSON perfectly', async () => {
        ((global as any).fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                response: '{"kind": "CALL_TOOL", "toolName": "host.fs.list_dir", "args": {"foo": "bar"}}'
            })
        });

        const instruction = await adapter.evaluate('do it', {});
        expect(instruction).toEqual({
            kind: 'CALL_TOOL',
            toolName: 'host.fs.list_dir',
            args: { foo: 'bar' }
        });
    });

    test('should invoke robust regex fallback for broken JSON', async () => {
        ((global as any).fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                // Intentionally broken JSON (missing closing brace)
                response: '{"kind": "CALL_TOOL", "toolName": "host.system.bash"'
            })
        });

        const instruction = await adapter.evaluate('do it', {});
        expect(instruction).toEqual({
            kind: 'CALL_TOOL',
            toolName: 'host.system.bash',
            args: {} // expected fallback
        });
    });

    test('should fallback to RETURN KERNEL_PANIC on network failure', async () => {
        ((global as any).fetch as jest.Mock).mockRejectedValueOnce(new Error("Connection refused"));

        const instruction = await adapter.evaluate('do it', {});
        expect(instruction.kind).toBe("RETURN");
        if (instruction.kind === 'RETURN') {
            expect(instruction.value).toContain('KERNEL_PANIC');
        }
    });
});
