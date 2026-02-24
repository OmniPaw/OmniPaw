# OmniPaw — Deterministic Kernel Architecture

> **Scope:** Core runtime only. No UI, no cloud deployment, no monetization.
> **Design philosophy:** Minimal OS kernel — explicit state, no hidden globals, full replayability.

---

## 1. High-Level Architecture Overview

OmniPaw is a deterministic agent runtime organized as a set of composable, side-effect-isolated modules. Execution flows in a single direction through a fixed loop. Every external interaction is mediated by a permission gate, logged before execution, and recorded with its outcome. Any agent run can be fully replayed from its log.

```
┌─────────────────────────────────────────────────────────────┐
│                       OMNIAXIOM KERNEL                      │
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Agent   │───▶│  Lifecycle   │───▶│  Execution Loop  │  │
│  │ Registry │    │  Controller  │    │   (Tick Engine)  │  │
│  └──────────┘    └──────────────┘    └────────┬─────────┘  │
│                                               │             │
│  ┌────────────────────────────────────────────▼──────────┐  │
│  │                    KERNEL BUS (read-only event spine)  │  │
│  └───┬──────────┬──────────────┬────────────┬────────────┘  │
│      │          │              │            │               │
│  ┌───▼──┐  ┌───▼──┐  ┌────────▼──┐  ┌─────▼──────┐        │
│  │Mem   │  │Tool  │  │Permission │  │Execution   │        │
│  │Layer │  │Gate  │  │   Model   │  │  Logger    │        │
│  └──────┘  └──────┘  └───────────┘  └────────────┘        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │             Delegation Protocol Layer                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

All modules communicate via the Kernel Bus — a synchronous, ordered event spine with no callbacks and no implicit coupling. Modules never call each other directly; they emit and consume typed events.

---

## 2. Module Breakdown

### 2.1 `AgentRegistry`
**Responsibility:** Stores and resolves agent identity records. Acts as the single source of truth for which agents exist.

- Maintains a map of `AgentId → AgentIdentity`
- Issues new identities on agent spawn
- Validates identity on every lifecycle transition
- Read-only after agent creation (identities are immutable)

### 2.2 `LifecycleController`
**Responsibility:** Enforces the agent state machine. The only module permitted to change an agent's lifecycle state.

- Accepts transition requests, validates them against the state machine
- Rejects invalid transitions with an explicit error record
- Emits `LifecycleEvent` to the Kernel Bus on every state change
- Maintains `AgentLifecycleRecord` per agent (ordered list of state transitions with timestamps)

### 2.3 `TickEngine` (Execution Loop)
**Responsibility:** Drives the deterministic execution loop for a single agent tick. Has no internal state between ticks.

- Accepts a `TickInput` (agent context + single instruction)
- Produces a `TickOutput` (result or pending action)
- Calls only through the Kernel Bus — never touches Memory or Tools directly
- Has a bounded step count; exceeding it triggers `TICK_OVERFLOW` failure

### 2.4 `MemoryLayer`
**Responsibility:** Provides three isolated memory scopes. No cross-scope access without explicit calls.

- `EphemeralStore`: per-tick scratch space, wiped on tick completion
- `PersistentStore`: durable agent-scoped key-value store, write-ahead logged
- `SharedStore`: multi-agent read/write namespace, access controlled by PermissionModel

### 2.5 `ToolGate`
**Responsibility:** Single choke-point for all external tool calls.

- Receives `ToolCallRequest`, passes to `PermissionModel` before execution
- Wraps every tool execution in a timed, sandboxed context
- Records result or failure into `ExecutionLogger` before returning to caller
- Never executes a tool if permission check fails

### 2.6 `PermissionModel`
**Responsibility:** Evaluates whether a given agent is allowed to perform a given action at the current moment.

- Maintains `PermissionGrant[]` per agent (assigned at spawn or via delegation)
- Evaluates against a policy set: `(agentId, action, resource) → Allow | Deny | Escalate`
- All policy evaluations are recorded
- Grants are non-recursive by default (a delegatee cannot grant more than it received)

### 2.7 `DelegationProtocol`
**Responsibility:** Governs how one agent spawns, tasks, and terminates sub-agents.

- Validates delegation requests against the delegator's current grants
- Issues bounded `DelegationToken` to the delegatee
- Tracks parent-child relationships in a `DelegationTree`
- Revocation of parent's grant cascades to all children

### 2.8 `ExecutionLogger`
**Responsibility:** Write-ahead log of every event in the system.

- Appends `LogEntry` records atomically
- Entries are immutable once written
- Log is the sole source for replay; no other component holds authoritative history
- Exposes `replay(agentId, fromSeq)` interface for deterministic reconstruction

### 2.9 `FailureHandler`
**Responsibility:** Classifies and routes failures. Never silently swallows errors.

- Receives `FailureEvent` from any module
- Classifies: `TRANSIENT | PERMANENT | POLICY_VIOLATION | INVARIANT_BREACH`
- Routes to recovery strategy (retry, fallback, escalate, halt)
- `INVARIANT_BREACH` always halts the entire agent and escalates to parent

---

## 3. Agent Lifecycle State Diagram

```
                         ┌────────────┐
                         │   DEFINED  │  ← Identity record created, not yet runnable
                         └─────┬──────┘
                               │ spawn(config)
                         ┌─────▼──────┐
                         │  SPAWNED   │  ← Resources allocated, permissions assigned
                         └─────┬──────┘
                               │ activate()
                         ┌─────▼──────┐
              ┌──────────│   ACTIVE   │◀──────────────────┐
              │          └─────┬──────┘                   │
              │                │                          │
              │  suspend()     │ yield() / await_tool()   │ resume()
              │          ┌─────▼──────┐                   │
              │          │  WAITING   │───────────────────▶┘
              │          └─────┬──────┘
              │                │ timeout / cancel
              │          ┌─────▼──────┐
              │          │  RESUMABLE │  ← Snapshot persisted, can resume from log
              │          └─────┬──────┘
              │                │ resume() or expire()
              │                │
  error()     │          ┌─────▼──────┐
    ┌─────────▼──┐       │ COMPLETING │  ← Running teardown, emitting final outputs
    │   FAULTED  │       └─────┬──────┘
    └─────┬──────┘             │ teardown_ok()
          │                    │
  recover()│             ┌─────▼──────┐
    ┌──────▼──────┐      │ TERMINATED │  ← Final state; identity retained in registry
    │  RECOVERING │      └────────────┘
    └──────┬──────┘
           │ success / exhausted
     ACTIVE / TERMINATED

Legend:
  DEFINED    → identity exists, not runnable
  SPAWNED    → resources allocated, awaiting first activation
  ACTIVE     → tick engine running
  WAITING    → blocked on tool result or sub-agent
  RESUMABLE  → snapshotted, hibernated
  COMPLETING → teardown in progress
  TERMINATED → final; read-only
  FAULTED    → error captured; recovery in progress or permanent
  RECOVERING → retrying from last safe checkpoint
```

**Valid transitions (exhaustive):**

| From        | To          | Trigger             |
|-------------|-------------|---------------------|
| DEFINED     | SPAWNED     | spawn()             |
| SPAWNED     | ACTIVE      | activate()          |
| ACTIVE      | WAITING     | yield()/await_tool()|
| ACTIVE      | COMPLETING  | complete()          |
| ACTIVE      | FAULTED     | error()             |
| ACTIVE      | RESUMABLE   | suspend()           |
| WAITING     | ACTIVE      | resume()            |
| WAITING     | FAULTED     | timeout()/error()   |
| RESUMABLE   | ACTIVE      | resume()            |
| RESUMABLE   | TERMINATED  | expire()            |
| COMPLETING  | TERMINATED  | teardown_ok()       |
| FAULTED     | RECOVERING  | recover()           |
| FAULTED     | TERMINATED  | abandon()           |
| RECOVERING  | ACTIVE      | recovery_success()  |
| RECOVERING  | TERMINATED  | recovery_exhausted()|

Any transition not in this table is a hard rejection.

---

## 4. Execution Loop Pseudocode

```typescript
// TickEngine.ts — one tick per call, no shared mutable state

type TickInput = {
  agentId: AgentId;
  sequenceNumber: number;       // monotonically increasing, per agent
  context: AgentContext;        // read-only snapshot of memory + env
  instruction: Instruction;     // single unit of work
  parentSpanId: SpanId | null;
};

type TickOutput =
  | { kind: 'COMPLETED'; result: Value; logs: LogEntry[] }
  | { kind: 'PENDING_TOOL'; request: ToolCallRequest; logs: LogEntry[] }
  | { kind: 'PENDING_DELEGATION'; request: DelegationRequest; logs: LogEntry[] }
  | { kind: 'FAILED'; failure: FailureEvent; logs: LogEntry[] };

function runTick(input: TickInput): TickOutput {
  const span = Tracer.openSpan(input.agentId, input.sequenceNumber, input.parentSpanId);
  const logs: LogEntry[] = [];

  // STEP 1: Validate agent is in ACTIVE state
  const state = LifecycleController.getState(input.agentId);
  if (state !== 'ACTIVE') {
    return emitFailure(span, logs, 'INVALID_STATE', `Expected ACTIVE, got ${state}`);
  }

  // STEP 2: Load ephemeral context (isolated per tick)
  const ephemeral = MemoryLayer.ephemeral.init(input.agentId, input.sequenceNumber);

  // STEP 3: Evaluate instruction — bounded step count
  let steps = 0;
  const MAX_STEPS = KernelConfig.maxStepsPerTick;
  let current: Instruction = input.instruction;

  while (steps < MAX_STEPS) {
    steps++;
    logs.push(Logger.record({ kind: 'STEP', agentId: input.agentId, seq: input.sequenceNumber, step: steps, instruction: current }));

    const result = evalInstruction(current, input.context, ephemeral);

    if (result.kind === 'PURE_VALUE') {
      MemoryLayer.ephemeral.destroy(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'OK');
      return { kind: 'COMPLETED', result: result.value, logs };
    }

    if (result.kind === 'NEEDS_TOOL') {
      // Exit tick — control returns to TickEngine caller
      // Tool result will be fed back as a new tick
      MemoryLayer.ephemeral.checkpoint(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'PENDING_TOOL');
      return { kind: 'PENDING_TOOL', request: result.request, logs };
    }

    if (result.kind === 'NEEDS_DELEGATION') {
      MemoryLayer.ephemeral.checkpoint(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'PENDING_DELEGATION');
      return { kind: 'PENDING_DELEGATION', request: result.request, logs };
    }

    if (result.kind === 'NEXT_INSTRUCTION') {
      current = result.next;
      continue;
    }

    if (result.kind === 'FAILURE') {
      MemoryLayer.ephemeral.destroy(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'FAILED');
      return { kind: 'FAILED', failure: result.failure, logs };
    }
  }

  // STEP 4: Step overflow — deterministic halt
  MemoryLayer.ephemeral.destroy(input.agentId, input.sequenceNumber);
  return emitFailure(span, logs, 'TICK_OVERFLOW', `Exceeded ${MAX_STEPS} steps`);
}

// Kernel scheduler — drives ticks forward, never recurses
function runAgentLoop(agentId: AgentId): void {
  const queue = TickQueue.get(agentId);  // bounded FIFO, no recursion

  while (!queue.isEmpty()) {
    const input = queue.dequeue();
    const output = runTick(input);
    Logger.appendAll(output.logs);

    match(output) {
      case 'COMPLETED':    handleCompletion(agentId, output.result);     break;
      case 'PENDING_TOOL': handleToolPending(agentId, output.request);   break;
      case 'PENDING_DELEGATION': handleDelegation(agentId, output.request); break;
      case 'FAILED':       FailureHandler.handle(agentId, output.failure); break;
    }
  }
}
```

---

## 5. Memory Model Definition

```typescript
// ── Scopes ────────────────────────────────────────────────────

type MemoryScope = 'EPHEMERAL' | 'PERSISTENT' | 'SHARED';

// Ephemeral: lives for exactly one tick sequence
// Wiped on COMPLETED or FAILED; checkpointed on PENDING_TOOL
interface EphemeralStore {
  init(agentId: AgentId, tickSeq: number): EphemeralHandle;
  read(handle: EphemeralHandle, key: string): Value | null;
  write(handle: EphemeralHandle, key: string, value: Value): void;
  checkpoint(agentId: AgentId, tickSeq: number): void;   // persists for resumption
  destroy(agentId: AgentId, tickSeq: number): void;
}

// Persistent: agent-scoped durable store; write-ahead logged
interface PersistentStore {
  read(agentId: AgentId, key: string): Value | null;
  write(agentId: AgentId, key: string, value: Value, txId: TxId): WriteResult;
  delete(agentId: AgentId, key: string, txId: TxId): WriteResult;
  snapshot(agentId: AgentId): PersistentSnapshot;  // for replay
}

// Shared: multi-agent namespace; permission-gated on every access
interface SharedStore {
  read(agentId: AgentId, namespace: string, key: string): Value | null;
  write(agentId: AgentId, namespace: string, key: string, value: Value, txId: TxId): WriteResult;
  // Permission check is automatic — throws PERMISSION_DENIED, never silently fails
}

// ── Invariants ────────────────────────────────────────────────
// 1. EphemeralStore is never readable by another agent
// 2. PersistentStore writes always produce a WAL entry before returning
// 3. SharedStore reads/writes always emit a MemoryAccessEvent to the Kernel Bus
// 4. No store holds references to live objects — only serializable values
// 5. Memory snapshots are keyed by (agentId, sequenceNumber) for exact replay
```

---

## 6. Delegation Protocol Schema

```typescript
// ── Token ─────────────────────────────────────────────────────

type DelegationToken = {
  tokenId:       string;           // UUID, globally unique
  parentAgentId: AgentId;
  childAgentId:  AgentId;          // assigned at delegation time
  grants:        PermissionGrant[];// subset of parent's grants (never a superset)
  maxDepth:      number;           // how many further delegations are allowed
  ttl:           number;           // absolute expiry timestamp (ms since epoch)
  revoked:       boolean;          // set to true on revocation; immutable thereafter
};

// ── Request / Response ───────────────────────────────────────

type DelegationRequest = {
  requestId:      string;
  parentAgentId:  AgentId;
  taskSpec:       TaskSpec;         // what the child should do
  grantSubset:    PermissionGrant[];// what permissions to delegate
  maxDepth:       number;
  ttl:            number;
};

type DelegationResponse =
  | { kind: 'ACCEPTED'; token: DelegationToken; childAgentId: AgentId }
  | { kind: 'REJECTED'; reason: string };

// ── Rules (enforced by DelegationProtocol module) ────────────
// 1. grantSubset must be ⊆ parent's current grants at time of request
// 2. maxDepth must be < parent's remaining delegation depth
// 3. Revocation is immediate and cascades depth-first through DelegationTree
// 4. On parent TERMINATED or FAULTED(permanent), all child tokens are auto-revoked
// 5. Child cannot access parent's persistent memory unless explicitly granted
// 6. Every delegation event is logged with the full token snapshot

// ── DelegationTree ────────────────────────────────────────────

type DelegationTree = {
  nodes: Map<AgentId, DelegationNode>;
};

type DelegationNode = {
  agentId:   AgentId;
  parentId:  AgentId | null;   // null = root agent
  children:  AgentId[];
  token:     DelegationToken | null;
};
```

---

## 7. Permission Enforcement Flow

```
Agent requests action (tool call, memory write, delegation, etc.)
              │
              ▼
┌─────────────────────────────┐
│   PermissionModel.evaluate  │
│   (agentId, action, resource│
└────────────┬────────────────┘
             │
     ┌───────▼────────┐
     │ Load agent's   │
     │ PermissionGrant│
     │ list from      │
     │ DelegationTree │
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │ Match policy:  │
     │ (action,       │
     │  resource,     │
     │  context)      │
     └───────┬────────┘
             │
    ┌────────▼─────────┐
    │   ALLOW?  DENY?  │
    │   ESCALATE?      │
    └────┬──────┬──────┘
         │      │        \
       ALLOW   DENY    ESCALATE
         │      │           │
         │   Log DENY    Emit to parent agent's
         │   Return      PermissionEscalationQueue
         │   PERMISSION_ (parent decides, or
         │   DENIED err  times out → DENY)
         │
    Log ALLOW + grant snapshot
    Proceed to ToolGate / MemoryLayer / DelegationProtocol
         │
    Log ACTION_EXECUTED or ACTION_FAILED
         │
    Return result to agent tick

Key rules:
  - Policy evaluation is pure (no side effects)
  - Evaluation order: explicit DENY > explicit ALLOW > default DENY
  - No implicit trust between agents sharing a namespace
  - PermissionGrant has an optional notAfter timestamp
  - All evaluations are logged regardless of outcome
```

---

## 8. Failure Modes and Recovery Strategy

```typescript
type FailureClass =
  | 'TRANSIENT'          // e.g. tool timeout; retry with backoff
  | 'PERMANENT'          // e.g. tool does not exist; no retry
  | 'POLICY_VIOLATION'   // e.g. permission denied; log and halt tick
  | 'INVARIANT_BREACH';  // e.g. invalid state transition; halt agent + escalate

type FailureEvent = {
  agentId:   AgentId;
  tickSeq:   number;
  class:     FailureClass;
  code:      string;
  message:   string;
  context:   SerializableContext;
  timestamp: number;
};
```

**Recovery strategies by class:**

| Class | Action | Max Retries | Escalation |
|---|---|---|---|
| `TRANSIENT` | Re-queue tick from last checkpoint | Configurable (default 3) | After max retries → PERMANENT |
| `PERMANENT` | Mark tick FAILED, transition agent to FAULTED | 0 | Notify parent via DelegationTree |
| `POLICY_VIOLATION` | Halt tick, log violation, keep agent ACTIVE | 0 | Optionally notify parent |
| `INVARIANT_BREACH` | Immediately halt agent (→ TERMINATED), freeze all child tokens | 0 | Always escalate to root + write to immutable audit log |

**Checkpointing for recovery:**

Before any PENDING_TOOL or PENDING_DELEGATION exit, the TickEngine writes a checkpoint containing the full `EphemeralStore` snapshot, the tick sequence number, and the last known-good persistent memory state. Recovery replays from this checkpoint, not from the beginning of the agent's life.

**Parent notification:**

When a child agent reaches FAULTED or TERMINATED due to failure, its parent's WAITING state receives a `ChildFailureEvent`. The parent tick resumes with this event as input. The parent may then retry delegation, fall back, or propagate the failure upward.

---

## 9. System Invariants (Non-Negotiable Rules)

These are checked at runtime; violation triggers `INVARIANT_BREACH`.

```
INV-01  Every state transition must be recorded in the log before taking effect.
INV-02  No module may read or write agent state outside of its defined interface.
INV-03  A TickEngine instance processes exactly one tick at a time per agent.
INV-04  PermissionModel.evaluate must be called before every ToolGate execution.
INV-05  EphemeralStore data never persists past the tick that created it
         (unless explicitly checkpointed for resumption).
INV-06  DelegationToken.grants must always be a strict subset of the
         delegating agent's grants at the moment of delegation.
INV-07  Every LogEntry is immutable once appended; no log compaction or deletion
         within an agent's active lifetime.
INV-08  The DelegationTree contains no cycles. Every agent has at most one parent.
INV-09  An agent in TERMINATED state cannot execute ticks, access memory,
         or perform tool calls.
INV-10  The Kernel Bus is the only channel through which modules communicate;
         no module holds a direct reference to another module's internals.
INV-11  All values stored in any memory scope must be serializable to JSON.
         Non-serializable values are rejected at write time.
INV-12  The TickEngine's step count is bounded by KernelConfig.maxStepsPerTick.
         This value is set at kernel boot and is immutable at runtime.
INV-13  No agent may spawn a sub-agent without an active DelegationToken.
INV-14  Tool call results are recorded in the log before being returned to
         the calling tick.
INV-15  Replay of (agentId, sequenceRange) from the execution log must produce
         identical TickOutputs for all COMPLETED ticks (given same tool stubs).
```

---

## 10. Suggested Folder Structure

```
omni-kernel/
├── kernel/
│   ├── index.ts                  # Kernel boot and module wiring
│   ├── bus.ts                    # KernelBus — typed event spine
│   └── config.ts                 # KernelConfig (immutable after boot)
│
├── identity/
│   ├── types.ts                  # AgentId, AgentIdentity
│   └── registry.ts               # AgentRegistry
│
├── lifecycle/
│   ├── types.ts                  # AgentState, LifecycleEvent, transitions table
│   └── controller.ts             # LifecycleController
│
├── execution/
│   ├── types.ts                  # TickInput, TickOutput, Instruction, Value
│   ├── tick.ts                   # TickEngine (runTick)
│   └── scheduler.ts              # runAgentLoop, TickQueue
│
├── memory/
│   ├── types.ts                  # MemoryScope, Value, TxId
│   ├── ephemeral.ts              # EphemeralStore
│   ├── persistent.ts             # PersistentStore + WAL
│   └── shared.ts                 # SharedStore (permission-gated)
│
├── tools/
│   ├── types.ts                  # ToolCallRequest, ToolResult, ToolManifest
│   ├── gate.ts                   # ToolGate
│   └── registry.ts               # registered tool definitions
│
├── permissions/
│   ├── types.ts                  # PermissionGrant, Policy, PolicyResult
│   └── model.ts                  # PermissionModel.evaluate
│
├── delegation/
│   ├── types.ts                  # DelegationToken, DelegationRequest/Response, DelegationTree
│   └── protocol.ts               # DelegationProtocol
│
├── logging/
│   ├── types.ts                  # LogEntry, SpanId, TraceContext
│   ├── logger.ts                 # ExecutionLogger (append-only)
│   └── replay.ts                 # replay(agentId, fromSeq)
│
├── failure/
│   ├── types.ts                  # FailureEvent, FailureClass, RecoveryStrategy
│   └── handler.ts                # FailureHandler
│
└── invariants/
    └── checker.ts                # Runtime invariant assertions (INV-01 … INV-15)
```

Every folder exports only through its own `types.ts` and one implementation file. Cross-module dependencies go through `bus.ts` only — never through direct imports of implementation files.

---

## Summary Table

| Concern | Module | Key Guarantee |
|---|---|---|
| Who is this agent? | `identity/registry` | Immutable identity post-creation |
| What state is it in? | `lifecycle/controller` | All transitions explicit and logged |
| What is it doing right now? | `execution/tick` | Bounded, no hidden loops |
| What can it remember? | `memory/*` | Scoped, serializable, logged |
| What tools can it call? | `tools/gate` | Permission-gated, always logged |
| Can it spawn children? | `delegation/protocol` | Grant subset only, tree-structured |
| Is it allowed to do this? | `permissions/model` | Evaluated before every action |
| What happened? | `logging/logger` | Immutable append-only log |
| Something went wrong | `failure/handler` | Classified, explicit recovery path |
| Is the system healthy? | `invariants/checker` | Hard assertions, breach = halt |
```
