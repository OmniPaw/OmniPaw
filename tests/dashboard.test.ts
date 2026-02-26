import { DashboardServer } from '../host/dashboard/server';
import { KernelBus } from '../kernel/bus';
import WebSocket from 'ws';

describe('DashboardServer', () => {
    let bus: KernelBus;
    let server: DashboardServer;
    const TEST_PORT = 19876;

    beforeEach(() => {
        bus = new KernelBus();
    });

    afterEach(async () => {
        if (server) await server.stop();
    });

    test('should start and accept WebSocket connections', async () => {
        server = new DashboardServer(bus, { port: TEST_PORT });
        server.start();
        await sleep(300);

        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        await waitForOpen(ws);

        expect(server.getClientCount()).toBe(1);
        ws.close();
        await sleep(100);
        expect(server.getClientCount()).toBe(0);
    });

    test('should send INIT message with buffered events on connection', async () => {
        server = new DashboardServer(bus, { port: TEST_PORT });
        server.start();
        await sleep(300);

        // Emit some events before client connects
        bus.emit({ kind: 'AGENT_SPAWNED', agentId: 'agent-1', timestamp: Date.now() });
        bus.emit({ kind: 'TICK_COMPLETED', agentId: 'agent-1', tickSeq: 1, timestamp: Date.now() });

        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        const msg = await waitForMessage(ws);
        const parsed = JSON.parse(msg);

        expect(parsed.type).toBe('INIT');
        expect(parsed.payload.bufferedEvents.length).toBe(2);

        ws.close();
    });

    test('should broadcast live events to connected clients', async () => {
        server = new DashboardServer(bus, { port: TEST_PORT });
        server.start();
        await sleep(300);

        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        await waitForMessage(ws); // consume INIT

        // Emit a live event
        const eventPromise = waitForMessage(ws);
        bus.emit({ kind: 'TOOL_CALL_REQUESTED', agentId: 'agent-2', toolName: 'host.git.clone', timestamp: Date.now() });

        const msg = JSON.parse(await eventPromise);
        expect(msg.type).toBe('BUS_EVENT');
        expect(msg.payload.kind).toBe('TOOL_CALL_REQUESTED');

        ws.close();
    });

    test('should reject connections without valid auth token', async () => {
        server = new DashboardServer(bus, { port: TEST_PORT, authToken: 'secret-123' });
        server.start();
        await sleep(300);

        // Connection WITHOUT token — should be rejected
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
        const closeCode = await waitForClose(ws);
        expect(closeCode).toBe(4001);

        // Connection WITH correct token — should succeed
        const ws2 = new WebSocket(`ws://localhost:${TEST_PORT}?token=secret-123`);
        await waitForOpen(ws2);
        expect(server.getClientCount()).toBe(1);

        ws2.close();
    });

    test('should serve HTML dashboard on HTTP GET /', async () => {
        server = new DashboardServer(bus, { port: TEST_PORT });
        server.start();
        await sleep(300);

        const res = await fetch(`http://localhost:${TEST_PORT}/`);
        expect(res.status).toBe(200);

        const html = await res.text();
        expect(html).toContain('OmniPaw Dashboard');
        expect(html).toContain('Live Event Stream');
    });
});

// --- Helpers ---
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });
}

function waitForMessage(ws: WebSocket): Promise<string> {
    return new Promise((resolve) => {
        ws.once('message', (data) => resolve(data.toString()));
    });
}

function waitForClose(ws: WebSocket): Promise<number> {
    return new Promise((resolve) => {
        ws.on('close', (code) => resolve(code));
    });
}
