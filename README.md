# OmniPaw
**Deterministic execution substrate for autonomous systems.**

Most AI agent frameworks today suffer from a critical flaw: they are fundamentally unpredictable. When an agent hallucinates a destructive action, fails a complex task, or corrupts state, developers are left with scattered logs, unprovable execution paths, and no way to reliably reproduce the failure. You cannot rewind an execution, prove the cryptographic integrity of a tool call, or guarantee that an agent won't silently violate security boundaries.

**OmniPaw solves this.**

Unlike traditional LLM-wrapper frameworks, OmniPaw strictly treats autonomous agent execution as a stateful, replayable operating system capable of proving every interaction cryptographically.

---

## 🚀 Key Features

- **100% Deterministic Replay**: When an agent completes an execution loop, you can deterministically rewind, inspect, and replay the exact system state that led to its decision. Say goodbye to "it worked on my machine" AI debugging.
- **Cryptographic Tracing**: Every state transition, memory footprint, and tool execution is dynamically hashed and mapped perfectly into an immutable Write-Ahead Log matrix.
- **Strict Isolation Bounds**: Sandboxed memory (`Ephemeral`, `Persistent`, `Shared`), `ToolGate` chroot-jailed executions, and permission-granted abstractions natively prevent cross-agent memory leakage or unauthorized host access.
- **Dynamic AI LLM Bridging**: Seamlessly maps asynchronous LLM completions (OpenAI, Anthropic, Gemini) straight back into the strict kernel Instruction pipeline via the `LlmBrainAdapter`.

---

## 📦 Installation

```bash
npm install @omnipaw/kernel
```

## 💻 Quick Start (Bridging The Ecosystem)

Booting a full `OmniKernel` is simple. You dictate the execution boundaries, wire the persistence modules, attach the AI adapter, and let it run natively.

```typescript
import { OmniKernel, KernelConfig, TickEngine, Scheduler } from '@omnipaw/kernel';
import { FileLogger, KernelTUI, LlmBrainAdapter, ToolGate, ToolRegistry } from '@omnipaw/kernel/host';

// 1. Storage Durability
const logger = new FileLogger('./.storage');
const config = new KernelConfig('LIVE');
const kernel = new OmniKernel(logger);

// 2. Map Dynamic Host Observability
const tui = new KernelTUI(kernel.bus);
tui.startVisualizer();

// 3. Register Explicit OS Tools
const tools = new ToolRegistry();
const gate = new ToolGate(kernel.logger, config, tools.listHandlers());

// 4. Connect AI Engine & Boot OS
const scheduler = new Scheduler(new TickEngine(), kernel.logger, kernel.lifecycle, gate, config, kernel.persistentStore);
const brain = new LlmBrainAdapter(); // Add OPENAI_API_KEY to .env

// Execute!
const agent = 'agent-1';
kernel.registry.registerAgent({ id: agent, type: 'explorer', createdAt: Date.now() });
kernel.lifecycle.transition(agent, 'spawn');
kernel.lifecycle.transition(agent, 'activate');

await brain.spinTickRound(scheduler, agent, 1, "Investigate OS config.", {});
```

---

## 🔒 The 15 Core Invariants
OmniPaw is structurally governed by **15 explicitly checked core invariants** ensuring total execution integrity mathematically. If an invariant is breached (e.g., an agent mutates an unchecked shared map explicitly denied), a Kernel Panic (`INVARIANT_BREACH`) forces a complete halt structurally escaping unpredictable consequences safely.

A subset of these strictly enforced invariants includes:
- `INV-03`: **SharedStore Isolation:** Rejects read/write without explicit `PermissionGrant` evaluations dynamically.
- `INV-09`: **Zombie Prevention:** Terminated agents cannot execute ticks or mutate parameters explicitly.
- `INV-11`: **Memory Serialization:** Non-JSON serializable objects are rejected deeply avoiding unstructured payloads mutating standard mapping logic natively.
- `INV-15`: **Execution Proofs:** Dynamic Replay sequences perfectly reproducing identically mapped sequences natively without trace divergences explicitly.

---

## 📖 Complete Documentation & Architecture

For a deep dive into the strict memory models, isolation bounds, permission enforcement flows, and the full list of invariants, read the **[OmniPaw Deterministic Architecture Specification](doc/omni-agent-os-architecture.md)**.

---

## 🛡 Formal Test Suite
To aggressively assert OS integrity structurally, OmniPaw encapsulates explicit `Jest` definitions natively throwing out-of-bounds metrics directly against the invariants.

```bash
npm test
```

*OmniPaw — Built to securely map chaos.*
