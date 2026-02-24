import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { KernelBus } from '../../kernel/bus';

export interface DashboardConfig {
    port: number;
    authToken?: string;
}

/**
 * Real-time WebSocket dashboard server for OmniPaw.
 * Broadcasts all KernelBus events to connected browser clients.
 */
export class DashboardServer {
    private wss: WebSocketServer | null = null;
    private httpServer: http.Server | null = null;
    private clients: Set<WebSocket> = new Set();
    private eventBuffer: any[] = [];
    private readonly maxBufferSize = 200;

    constructor(
        private readonly bus: KernelBus,
        private readonly config: DashboardConfig
    ) { }

    start(): void {
        this.httpServer = http.createServer((req, res) => {
            if (req.url === '/' || req.url === '/index.html') {
                const htmlPath = path.join(__dirname, 'public', 'index.html');
                if (fs.existsSync(htmlPath)) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(fs.readFileSync(htmlPath, 'utf8'));
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(this.getEmbeddedDashboard());
                }
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        this.wss = new WebSocketServer({ server: this.httpServer });

        this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
            // Auth check
            if (this.config.authToken) {
                const url = new URL(req.url || '', `http://localhost:${this.config.port}`);
                const token = url.searchParams.get('token');
                if (token !== this.config.authToken) {
                    ws.close(4001, 'Unauthorized');
                    return;
                }
            }

            this.clients.add(ws);

            // Send buffered events to new client
            ws.send(JSON.stringify({
                type: 'INIT',
                payload: { bufferedEvents: this.eventBuffer }
            }));

            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });

        // Subscribe to ALL kernel bus events
        this.bus.subscribe('*', (event: any) => {
            const message = {
                type: 'BUS_EVENT',
                payload: event,
                timestamp: Date.now()
            };

            // Buffer for late-joining clients
            this.eventBuffer.push(message);
            if (this.eventBuffer.length > this.maxBufferSize) {
                this.eventBuffer.shift();
            }

            // Broadcast to all connected clients
            const data = JSON.stringify(message);
            for (const client of this.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            }
        });

        this.httpServer.listen(this.config.port, () => {
            console.log(`🐾 OmniPaw Dashboard live at http://localhost:${this.config.port}`);
        });
    }

    stop(): Promise<void> {
        return new Promise((resolve) => {
            for (const client of this.clients) {
                client.close();
            }
            this.clients.clear();

            if (this.wss) this.wss.close();
            if (this.httpServer) {
                this.httpServer.close(() => resolve());
            } else {
                resolve();
            }
        });
    }

    getClientCount(): number {
        return this.clients.size;
    }

    getBufferedEvents(): any[] {
        return [...this.eventBuffer];
    }

    private getEmbeddedDashboard(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🐾 OmniPaw Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: #0a0a1a;
    color: #e0e0f0;
    min-height: 100vh;
  }
  .header {
    background: linear-gradient(135deg, #1a1a3e 0%, #0d0d2b 100%);
    padding: 20px 32px;
    border-bottom: 1px solid #2a2a5e;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .header h1 { font-size: 22px; font-weight: 600; }
  .header .status {
    margin-left: auto;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
  }
  .status.connected { background: #0d3320; color: #4ade80; border: 1px solid #166534; }
  .status.disconnected { background: #3b1111; color: #f87171; border: 1px solid #7f1d1d; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 16px;
    padding: 16px;
    height: calc(100vh - 80px);
  }
  .panel {
    background: #111128;
    border: 1px solid #2a2a5e;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .panel-header {
    padding: 12px 16px;
    background: #16163a;
    border-bottom: 1px solid #2a2a5e;
    font-size: 14px;
    font-weight: 600;
    color: #a5a5d0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
  }
  .event-row {
    padding: 6px 10px;
    border-radius: 6px;
    margin-bottom: 4px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .event-row:hover { background: #1a1a44; }
  .badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .badge.spawn { background: #0e4429; color: #4ade80; }
  .badge.tick { background: #1e3a5f; color: #60a5fa; }
  .badge.tool { background: #5c3d1e; color: #fbbf24; }
  .badge.memory { background: #3b1f5e; color: #c084fc; }
  .badge.default { background: #2a2a5e; color: #a5a5d0; }
  .ts { color: #555580; font-size: 11px; }
  .agent-id { color: #60a5fa; }
  .counter {
    text-align: center;
    padding: 24px;
    font-size: 48px;
    font-weight: 700;
    color: #818cf8;
  }
  .counter-label {
    text-align: center;
    font-size: 13px;
    color: #6b6b9e;
    margin-top: 4px;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 16px;
  }
</style>
</head>
<body>
<div class="header">
  <span style="font-size: 28px;">🐾</span>
  <h1>OmniPaw Dashboard</h1>
  <div class="status disconnected" id="status">Disconnected</div>
</div>
<div class="grid">
  <div class="panel">
    <div class="panel-header">📡 Live Event Stream</div>
    <div class="panel-body" id="events"></div>
  </div>
  <div class="panel">
    <div class="panel-header">📊 Statistics</div>
    <div class="panel-body">
      <div class="stats-grid">
        <div><div class="counter" id="totalEvents">0</div><div class="counter-label">Total Events</div></div>
        <div><div class="counter" id="totalAgents">0</div><div class="counter-label">Unique Agents</div></div>
        <div><div class="counter" id="totalTicks">0</div><div class="counter-label">Ticks</div></div>
        <div><div class="counter" id="totalTools">0</div><div class="counter-label">Tool Calls</div></div>
      </div>
    </div>
  </div>
  <div class="panel" style="grid-column: span 2;">
    <div class="panel-header">🧠 Agent Activity</div>
    <div class="panel-body" id="agents"></div>
  </div>
</div>
<script>
const agents = new Set();
let totalEvents = 0, totalTicks = 0, totalTools = 0;

function getBadgeClass(kind) {
  if (kind.includes('SPAWN')) return 'spawn';
  if (kind.includes('TICK')) return 'tick';
  if (kind.includes('TOOL')) return 'tool';
  if (kind.includes('MEMORY')) return 'memory';
  return 'default';
}

function addEvent(event) {
  const el = document.getElementById('events');
  const row = document.createElement('div');
  row.className = 'event-row';
  const ts = new Date(event.timestamp || Date.now()).toLocaleTimeString();
  row.innerHTML = '<span class="ts">' + ts + '</span>'
    + '<span class="badge ' + getBadgeClass(event.payload?.kind || '') + '">' + (event.payload?.kind || 'EVENT') + '</span>'
    + '<span class="agent-id">' + (event.payload?.agentId || '—') + '</span>';
  el.insertBefore(row, el.firstChild);
  if (el.children.length > 200) el.removeChild(el.lastChild);

  totalEvents++;
  if (event.payload?.agentId) agents.add(event.payload.agentId);
  if ((event.payload?.kind || '').includes('TICK')) totalTicks++;
  if ((event.payload?.kind || '').includes('TOOL')) totalTools++;

  document.getElementById('totalEvents').textContent = totalEvents;
  document.getElementById('totalAgents').textContent = agents.size;
  document.getElementById('totalTicks').textContent = totalTicks;
  document.getElementById('totalTools').textContent = totalTools;
}

function connect() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const ws = new WebSocket('ws://' + location.host + '?token=' + token);

  ws.onopen = () => {
    document.getElementById('status').className = 'status connected';
    document.getElementById('status').textContent = 'Connected';
  };
  ws.onclose = () => {
    document.getElementById('status').className = 'status disconnected';
    document.getElementById('status').textContent = 'Disconnected';
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'INIT') {
      msg.payload.bufferedEvents.forEach(addEvent);
    } else {
      addEvent(msg);
    }
  };
}
connect();
</script>
</body>
</html>`;
    }
}
