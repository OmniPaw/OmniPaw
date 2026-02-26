# 🐾 OmniPaw Kernel — Next-Gen Roadmap

> Each section below is a self-contained expansion with clear objectives, technical specs, and acceptance criteria.

---

## 🔥 Phase 5: Plugin System

**Goal:** Let external developers register custom tools and agents via a declarative manifest, turning OmniPaw into an extensible platform.

### Tasks
- [ ] Design `plugin.manifest.json` schema (name, version, tools[], agents[], permissions[])
- [ ] Create `PluginLoader` class that reads manifests from a `plugins/` directory at boot
- [ ] Implement runtime tool injection into `ToolRegistry` from loaded plugins
- [ ] Implement runtime agent injection into `AgentRegistry` from loaded plugins
- [ ] Add plugin sandboxing — plugins run with restricted permissions (no raw FS/Bash unless declared)
- [ ] Create a `PluginValidator` to verify manifest integrity and reject malformed plugins
- [ ] Write example plugin: `plugin-weather` (registers a `weather.get_forecast` tool)
- [ ] Write tests for plugin loading, validation, sandboxing, and rejection

### Technical Spec
```
plugins/
  plugin-weather/
    plugin.manifest.json    ← { name, version, tools: [...], permissions: ["network"] }
    tools/
      forecast.ts           ← ToolHandler implementation
```

### Dependencies
- None (pure TypeScript)

### Acceptance Criteria
- A plugin in `plugins/` is auto-discovered and loaded at kernel boot
- Plugins without required permissions are rejected with clear error messages
- All existing invariants (INV-01 through INV-15) remain enforced across plugin boundaries

---

## 🔥 Phase 6: WebSocket Real-Time Dashboard

**Goal:** Replace the terminal-only TUI with a browser-based real-time dashboard for remote monitoring.

### Tasks
- [ ] Add `ws` (WebSocket) dependency
- [ ] Create `DashboardServer` class in `host/dashboard/server.ts`
- [ ] Broadcast all `KernelBus` events to connected WebSocket clients in real-time
- [ ] Build a single-page HTML/JS dashboard (`host/dashboard/public/index.html`)
- [ ] Dashboard panels: Agent Registry, Live Event Stream, Memory Inspector, Lifecycle FSM Visualizer
- [ ] Add authentication token for WebSocket connections (prevent unauthorized access)
- [ ] Write tests for WebSocket event broadcasting and client connection lifecycle

### Technical Spec
- Server: `ws` on port `9090` (configurable via `.env`)
- Protocol: JSON messages `{ type: "BUS_EVENT", payload: { ... } }`
- Frontend: Vanilla HTML/CSS/JS with live DOM updates (no framework needed)

### Dependencies
- `ws`, `@types/ws`

### Acceptance Criteria
- Opening `http://localhost:9090` shows a live dashboard
- All KernelBus events appear in real-time without polling
- Dashboard auto-reconnects on connection drop

---

## 🔥 Phase 7: Multi-Agent Swarm Orchestration

**Goal:** Enable true concurrent agent coordination with message-passing, shared goals, and consensus.

### Tasks
- [ ] Design `SwarmProtocol` class with `broadcast()`, `requestVote()`, and `reachConsensus()` methods
- [ ] Implement agent-to-agent messaging via `KernelBus` channels (namespaced events)
- [ ] Create `SwarmCoordinator` that spawns N agents with a shared goal and collects results
- [ ] Implement leader election algorithm (simple majority voting)
- [ ] Add swarm-level memory namespace in `SharedStore` for cross-agent state
- [ ] Build `MapReduce` pattern: coordinator splits task → workers execute → results merge
- [ ] Write simulation: 3 agents collaboratively analyze a codebase (one reads, one plans, one patches)
- [ ] Write tests for message delivery guarantees, consensus, and result aggregation

### Technical Spec
```typescript
const swarm = new SwarmCoordinator(kernel, {
    agents: 3,
    goal: "Analyze and fix all TODOs in the codebase",
    strategy: 'MAP_REDUCE'  // or 'CONSENSUS', 'PIPELINE'
});
const result = await swarm.execute();
```

### Dependencies
- None (builds on existing `KernelBus`, `DelegationProtocol`, `SharedStore`)

### Acceptance Criteria
- 3+ agents can execute concurrently with isolated memory but shared communication
- Leader election converges deterministically
- Full audit trail captures every inter-agent message

---

## 🔥 Phase 8: OpenTelemetry Observability

**Goal:** Export structured traces, metrics, and logs so OmniPaw integrates with Grafana, Datadog, Jaeger, etc.

### Tasks
- [ ] Add `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`
- [ ] Create `TelemetryProvider` singleton in `host/telemetry/provider.ts`
- [ ] Instrument `TickEngine.runTick()` with spans (trace each tick)
- [ ] Instrument `ToolGate.execute()` with spans (trace each tool call)
- [ ] Instrument `Scheduler.runAgentLoop()` as the root span per agent execution
- [ ] Export custom metrics: `omnipaw.ticks.total`, `omnipaw.tools.latency_ms`, `omnipaw.agents.active`
- [ ] Add OTLP exporter endpoint configuration via `.env` (`OTEL_EXPORTER_ENDPOINT`)
- [ ] Write tests verifying span creation and metric emission

### Dependencies
- `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`

### Acceptance Criteria
- Running OmniPaw with `OTEL_EXPORTER_ENDPOINT` set exports traces to a collector
- Each agent loop appears as a full trace with child spans for ticks and tool calls
- Metrics are queryable in Prometheus/Grafana

---

## 🛡️ Phase 9: Resource Quotas & Rate Limiting

**Goal:** Cap token usage, CPU time, and memory per agent to prevent runaway costs and infinite loops.

### Tasks
- [ ] Design `ResourceQuota` type: `{ maxTicks: number, maxToolCalls: number, maxMemoryKeys: number, maxTokens: number }`
- [ ] Create `QuotaEnforcer` middleware that wraps `Scheduler.runAgentLoop()`
- [ ] Track per-agent resource consumption in a `ResourceLedger`
- [ ] Enforce hard limits: agent transitions to `FAULTED` state when quota exceeded
- [ ] Add soft limits with warnings logged to `ExecutionLogger`
- [ ] Make quotas configurable per-agent via `AgentIdentity.quota` field
- [ ] Write tests for quota enforcement, soft/hard limit transitions, and ledger accuracy

### Technical Spec
```typescript
const quota: ResourceQuota = {
    maxTicks: 1000,
    maxToolCalls: 50,
    maxMemoryKeys: 100,
    maxTokens: 100_000
};
```

### Dependencies
- None (pure TypeScript)

### Acceptance Criteria
- An agent exceeding `maxTicks` is automatically faulted with `QUOTA_EXCEEDED` error
- Soft limit warnings appear in the audit trail before hard limits trigger
- Quotas are enforced identically in both LIVE and REPLAY modes

---

## 🛡️ Phase 10: Docker Sandbox for Tool Execution

**Goal:** Run tool executions (bash, git, fs) inside ephemeral Docker containers for true OS-level isolation.

### Tasks
- [ ] Add `dockerode` dependency for Docker API interaction
- [ ] Create `DockerSandbox` class in `host/sandbox/docker.ts`
- [ ] Implement container lifecycle: `create → start → exec → collect output → destroy`
- [ ] Route `host.system.bash` tool through Docker when `SANDBOX_MODE=docker` in `.env`
- [ ] Mount agent workspace as a read-write volume inside the container
- [ ] Enforce container resource limits (CPU, memory, network, timeout)
- [ ] Implement output streaming from container to `ExecutionLogger`
- [ ] Write tests using Docker-in-Docker or mock `dockerode` for CI environments

### Technical Spec
- Base image: `node:22-alpine` (lightweight, matches runtime)
- Timeout: 30s per tool execution (configurable)
- Network: disabled by default, enabled per-tool via permissions

### Dependencies
- `dockerode`, `@types/dockerode`
- Docker daemon running locally

### Acceptance Criteria
- `host.system.bash` commands execute inside an ephemeral container
- Container is destroyed after each execution (no state leakage)
- File changes persist only in the agent's mounted workspace volume

---

## 🛡️ Phase 11: CI/CD Pipeline

**Goal:** Automated testing, building, and quality gates on every push.

### Tasks
- [ ] Create `.github/workflows/ci.yml` with Node.js matrix (18, 20, 22)
- [ ] Steps: checkout → install → build (`npx tsc`) → test (`npm test`)
- [ ] Add code coverage reporting via `jest --coverage`
- [ ] Add coverage threshold enforcement (≥80% lines)
- [ ] Add lint step (ESLint with TypeScript rules)
- [ ] Add badge to README: build status + coverage percentage
- [ ] Create `.github/workflows/release.yml` for tagged releases → npm publish

### Acceptance Criteria
- Every PR runs build + test + lint automatically
- PRs with failing tests or <80% coverage are blocked
- Tagged releases auto-publish to npm

---

## 📦 Phase 12: NPM Package Publishing

**Goal:** Publish `@omnipaw/kernel` so the community can install and extend it.

### Tasks
- [ ] Configure `package.json` for publishing (name, main, types, files, repository, license)
- [ ] Set up `tsconfig.build.json` producing clean `dist/` output with declaration files
- [ ] Create `index.ts` barrel export exposing the public API surface
- [ ] Write `CHANGELOG.md` with semantic versioning
- [ ] Add `prepublishOnly` script: `npm run build && npm test`
- [ ] Publish initial `0.1.0` to npm registry
- [ ] Add `npm install @omnipaw/kernel` quick-start example to README

### Public API Surface
```typescript
export { OmniKernel } from './kernel/index';
export { AgentRegistry } from './identity/registry';
export { ExecutionLogger } from './logging/logger';
export { TickEngine } from './execution/tick';
export { Scheduler } from './execution/scheduler';
export { ToolGate } from './tools/gate';
export { ToolRegistry } from './tools/registry';
export { PersistentStore } from './memory/persistent';
export { SharedStore } from './memory/shared';
export { EphemeralStore } from './memory/ephemeral';
```

### Acceptance Criteria
- `npm install @omnipaw/kernel` works and exposes typed imports
- Package size is < 100KB (no dev dependencies bundled)
- TypeScript declaration files are included

---

## 📦 Phase 13: Documentation Site

**Goal:** A beautiful, searchable documentation site with architecture diagrams, API reference, and tutorials.

### Tasks
- [ ] Initialize Nextra docs project in `docs/` directory
- [ ] Write **Getting Started** guide (install → boot kernel → run first agent)
- [ ] Write **Architecture Overview** with Mermaid diagrams (Kernel Bus, Tick Engine, Memory Layer)
- [ ] Write **API Reference** for every exported class and function
- [ ] Write **Plugin Development Guide** (creating and registering custom tools)
- [ ] Write **Invariants Reference** (INV-01 through INV-15 explained)
- [ ] Write **Replay & Determinism** deep-dive (how cryptographic verification works)
- [ ] Deploy to Vercel with custom domain
- [ ] Add search via Nextra's built-in full-text search

### Acceptance Criteria
- Docs are live at a public URL
- Every public API has documented parameters, return types, and examples
- Architecture diagrams accurately reflect the current codebase
