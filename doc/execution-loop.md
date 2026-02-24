# Omni Kernel — Execution Loop

> **Document scope:** Authoritative spec for `execution/tick.ts` and `execution/scheduler.ts`.
> **Status:** Frozen. All implementation must conform to this document.

---

## 1. Purpose

The execution loop is the engine that drives an agent forward. It is the only place where instructions are evaluated, and the only place where the agent produces observable outputs. Everything else in the kernel exists to support it or constrain it.

The loop has two layers:

- **The Tick** — a single, bounded, stateless unit of execution. One instruction in, one output out.
- **The Scheduler** — the global drain loop that sequences ticks across agents, feeds results back in, and never recurses.

---

## 2. Core Design Rules

These rules are absolute. The entire replayability and determinism guarantee of the kernel rests on them.

1. **One tick, one output.** A tick always produces exactly one `TickOutput`. It never blocks, never awaits, never yields to the event loop mid-execution.
2. **No state between ticks.** `runTick()` is a pure function with respect to kernel state. All state it needs is passed in via `TickInput`. All state changes it produces are emitted via the Kernel Bus and returned in `TickOutput`.
3. **All non-determinism exits as a request.** If a tick needs time, randomness, network, or a sub-agent result, it exits with `PENDING_TOOL` or `PENDING_DELEGATION`. The result is fed back as the input of the next tick.
4. **Steps are bounded.** A tick may evaluate at most `KernelConfig.maxStepsPerTick` instructions. Exceeding this is a hard halt (`TICK_OVERFLOW`), not a warning.
5. **No recursion in the scheduler.** The scheduler is a `while` loop over a bounded FIFO queue. It never calls itself.

---

## 3. Type Definitions

```typescript
// execution/types.ts

// ── Identity and Sequencing ────────────────────────────────────

type AgentId  = string;  // UUID; assigned at spawn; globally unique
type SpanId   = string;  // UUID; assigned per tick; used for tracing
type TxId     = string;  // UUID; assigned per write operation; for WAL correlation

// ── Instruction ───────────────────────────────────────────────
// An Instruction is the atomic unit of work evalInstruction() processes.
// The kernel does not define the instruction format — that is the domain
// of the agent's instruction set. The kernel only requires it to be
// JSON-serializable and to produce an EvalResult.

type Instruction = {
  kind:    string;           // e.g. 'CALL', 'MAP', 'BRANCH', 'RETURN', 'LITERAL'
  payload: Record<string, unknown>;  // instruction-specific data; must be serializable
};

// ── Tick Input ────────────────────────────────────────────────

type TickInput = {
  agentId:        AgentId;
  sequenceNumber: number;       // monotonically increasing per agent; never reused
  context:        AgentContext; // read-only snapshot of memory + env at tick start
  instruction:    Instruction;  // the instruction to evaluate
  parentSpanId:   SpanId | null;
  toolResult?:    ToolResult;   // present if this tick is a continuation after a tool call
  delegationResult?: DelegationResult; // present if this tick resumes after child completion
};

// AgentContext is a frozen snapshot. evalInstruction() may read it but not write it.
type AgentContext = {
  agentId:   AgentId;
  tickSeq:   number;
  env:       Readonly<Record<string, string>>;  // snapshotted from KernelConfig at tick start
  grants:    ReadonlyArray<PermissionGrant>;    // current permission grants; read-only
  busSeqAt:  number;  // busSeq at the moment the context was snapshotted
};

// ── Tick Output ───────────────────────────────────────────────

type TickOutput =
  | { kind: 'COMPLETED';           result:   Value;              logs: LogEntry[] }
  | { kind: 'PENDING_TOOL';        request:  ToolCallRequest;    logs: LogEntry[] }
  | { kind: 'PENDING_DELEGATION';  request:  DelegationRequest;  logs: LogEntry[] }
  | { kind: 'FAILED';              failure:  FailureEvent;       logs: LogEntry[] };

// ── Eval Result ───────────────────────────────────────────────
// Returned by evalInstruction(). Internal to the tick — never leaves runTick().

type EvalResult =
  | { kind: 'PURE_VALUE';        value:   Value }
  | { kind: 'NEXT_INSTRUCTION';  next:    Instruction }
  | { kind: 'NEEDS_TOOL';        request: ToolCallRequest }
  | { kind: 'NEEDS_DELEGATION';  request: DelegationRequest }
  | { kind: 'FAILURE';           failure: FailureEvent };

// ── Value ─────────────────────────────────────────────────────
// All values in the kernel must be JSON-serializable (INV-11).

type Value =
  | string
  | number
  | boolean
  | null
  | Value[]
  | { [key: string]: Value };
```

---

## 4. `runTick()` — Step-by-Step

```typescript
// execution/tick.ts

function runTick(input: TickInput): TickOutput {
  const logs: LogEntry[] = [];
  const span = Tracer.openSpan(input.agentId, input.sequenceNumber, input.parentSpanId);

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Guard — agent must be ACTIVE
  // ═══════════════════════════════════════════════════════════
  // Checked first. Every other step assumes ACTIVE.
  // If the agent has been faulted or terminated between tick enqueue
  // and tick execution, this guard catches it.

  const state = LifecycleController.getState(input.agentId);
  InvariantChecker.assertAgentActive(input.agentId, state);  // INV-09

  if (state !== 'ACTIVE') {
    return emitFailure(span, logs, 'INVALID_STATE',
      `Tick enqueued for agent ${input.agentId} but state is ${state}`);
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Initialize ephemeral scratch space
  // ═══════════════════════════════════════════════════════════
  // EphemeralStore is isolated per (agentId, sequenceNumber).
  // If this tick is a continuation (toolResult or delegationResult present),
  // the checkpoint from the previous PENDING_* exit is restored here.

  const ephemeral = input.toolResult || input.delegationResult
    ? MemoryLayer.ephemeral.restore(input.agentId, input.sequenceNumber)
    : MemoryLayer.ephemeral.init(input.agentId, input.sequenceNumber);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Evaluation loop — bounded step count
  // ═══════════════════════════════════════════════════════════

  let steps = 0;
  const MAX_STEPS = KernelConfig.maxStepsPerTick;  // immutable after boot (INV-12)
  let current: Instruction = input.instruction;

  while (steps < MAX_STEPS) {
    steps++;
    InvariantChecker.assertStepBound(steps, MAX_STEPS);  // INV-12

    // Log every step before evaluation (INV-01 pattern applied to steps)
    logs.push(Logger.record({
      kind:        'STEP',
      agentId:     input.agentId,
      tickSeq:     input.sequenceNumber,
      step:        steps,
      instruction: current,
    }));

    // evalInstruction CONTRACT (INV-20):
    //   - Pure function: same inputs → same output, always
    //   - No Date.now(), Math.random(), process.env, or global state reads
    //   - No I/O of any kind
    //   - All non-determinism exits as NEEDS_TOOL
    const result: EvalResult = evalInstruction(current, input.context, ephemeral);

    // ── Branch on eval result ──────────────────────────────────

    if (result.kind === 'PURE_VALUE') {
      // Tick is done. Destroy ephemeral scratch. Return completed output.
      MemoryLayer.ephemeral.destroy(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'COMPLETED');
      logs.push(Logger.record({ kind: 'TICK_COMPLETED', agentId: input.agentId, tickSeq: input.sequenceNumber }));
      return { kind: 'COMPLETED', result: result.value, logs };
    }

    if (result.kind === 'NEXT_INSTRUCTION') {
      // Keep looping with the next instruction. No exit.
      current = result.next;
      continue;
    }

    if (result.kind === 'NEEDS_TOOL') {
      // Exit the tick. Checkpoint ephemeral state so the continuation
      // tick can restore it. The scheduler will route to ToolGate.
      //
      // LIVE mode:   ToolGate executes the real adapter,
      //              logs the ToolResultEntry (INV-14),
      //              then re-enqueues this agent with a continuation TickInput.
      //
      // REPLAY mode: ToolGate reads the logged ToolResultEntry by
      //              (agentId, tickSeq, toolCallIndex) — never calls adapter (INV-18).
      MemoryLayer.ephemeral.checkpoint(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'PENDING_TOOL');
      logs.push(Logger.record({ kind: 'TICK_PENDING_TOOL', agentId: input.agentId, tickSeq: input.sequenceNumber, request: result.request }));
      return { kind: 'PENDING_TOOL', request: result.request, logs };
    }

    if (result.kind === 'NEEDS_DELEGATION') {
      // Exit the tick. Checkpoint ephemeral state. Scheduler routes to
      // DelegationProtocol, which spawns the child agent and re-enqueues
      // this agent when the child produces its final output.
      MemoryLayer.ephemeral.checkpoint(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'PENDING_DELEGATION');
      logs.push(Logger.record({ kind: 'TICK_PENDING_DELEGATION', agentId: input.agentId, tickSeq: input.sequenceNumber, request: result.request }));
      return { kind: 'PENDING_DELEGATION', request: result.request, logs };
    }

    if (result.kind === 'FAILURE') {
      // Instruction evaluation produced an explicit failure.
      // Destroy ephemeral scratch. Return failure output.
      MemoryLayer.ephemeral.destroy(input.agentId, input.sequenceNumber);
      Tracer.closeSpan(span, 'FAILED');
      logs.push(Logger.record({ kind: 'TICK_FAILED', agentId: input.agentId, tickSeq: input.sequenceNumber, failure: result.failure }));
      return { kind: 'FAILED', failure: result.failure, logs };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Step overflow — deterministic hard halt
  // ═══════════════════════════════════════════════════════════
  // The only loop exit path not handled above.
  // This is always a PERMANENT failure — no retry.

  MemoryLayer.ephemeral.destroy(input.agentId, input.sequenceNumber);
  return emitFailure(span, logs, 'TICK_OVERFLOW',
    `Agent ${input.agentId} exceeded ${MAX_STEPS} steps at tick ${input.sequenceNumber}`);
}
```

---

## 5. Scheduler — `runAgentLoop()`

```typescript
// execution/scheduler.ts

// ─────────────────────────────────────────────────────────────────────
// CONCURRENCY MODEL (INV-21):
//   The reference kernel is single-threaded. The global drain loop runs
//   one tick at a time across all agents. This guarantees:
//     - No race conditions on LifecycleController state
//     - No race conditions on SharedStore version counters
//     - Logger.append() is never called concurrently
//     - busSeq counter is trivially monotonic (no CAS needed)
//   Parallelism = multiple isolated kernel instances. Not threading.
// ─────────────────────────────────────────────────────────────────────

function drainGlobalQueue(globalQueue: BoundedFIFO<ScheduledTick>): void {
  while (!globalQueue.isEmpty()) {
    const { agentId, tickInput } = globalQueue.dequeue();

    // Run the tick to completion or PENDING_* exit
    const output: TickOutput = runTick(tickInput);

    // Log all entries produced by the tick (log-first pattern)
    Logger.appendAll(output.logs);

    // Dispatch based on output kind
    switch (output.kind) {
      case 'COMPLETED':
        handleCompletion(agentId, tickInput.sequenceNumber, output.result, globalQueue);
        break;

      case 'PENDING_TOOL':
        handleToolPending(agentId, tickInput.sequenceNumber, output.request, globalQueue);
        break;

      case 'PENDING_DELEGATION':
        handleDelegationPending(agentId, tickInput.sequenceNumber, output.request, globalQueue);
        break;

      case 'FAILED':
        FailureHandler.handle(agentId, output.failure, globalQueue);
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Handler: COMPLETED
// ─────────────────────────────────────────────────────────────────────
function handleCompletion(
  agentId:    AgentId,
  tickSeq:    number,
  result:     Value,
  queue:      BoundedFIFO<ScheduledTick>
): void {
  // If the agent has more instructions queued, enqueue the next tick.
  // If the agent's task is fully done, trigger the complete() transition.
  const nextInstruction = InstructionQueue.dequeue(agentId);

  if (nextInstruction) {
    const nextSeq = tickSeq + 1;
    queue.enqueue({
      agentId,
      tickInput: buildTickInput(agentId, nextSeq, nextInstruction),
    });
  } else {
    LifecycleController.transition(agentId, 'complete');
    // Teardown sequence begins; LifecycleController moves to COMPLETING
    // then TERMINATED after teardown_ok().
    Teardown.run(agentId);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Handler: PENDING_TOOL
// ─────────────────────────────────────────────────────────────────────
function handleToolPending(
  agentId:   AgentId,
  tickSeq:   number,
  request:   ToolCallRequest,
  queue:     BoundedFIFO<ScheduledTick>
): void {
  // Transition agent to WAITING (INV-03: no tick runs while WAITING)
  LifecycleController.transition(agentId, 'await_tool');

  const mode = KernelConfig.mode;

  if (mode === 'LIVE') {
    // Execute the real tool (permission already checked inside ToolGate)
    // ToolGate logs the result BEFORE returning it (INV-14)
    const result = ToolGate.execute(agentId, tickSeq, request);

    // Re-enqueue as continuation tick with tool result
    LifecycleController.transition(agentId, 'resume');
    queue.enqueue({
      agentId,
      tickInput: {
        ...buildTickInput(agentId, tickSeq, request.continuationInstruction),
        toolResult: result,
      },
    });

  } else {
    // REPLAY mode: ToolGate reads logged result, never calls adapter (INV-18)
    const result = ToolGate.execute(agentId, tickSeq, request);  // returns logged result
    LifecycleController.transition(agentId, 'resume');
    queue.enqueue({
      agentId,
      tickInput: {
        ...buildTickInput(agentId, tickSeq, request.continuationInstruction),
        toolResult: result,
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Handler: PENDING_DELEGATION
// ─────────────────────────────────────────────────────────────────────
function handleDelegationPending(
  agentId:  AgentId,
  tickSeq:  number,
  request:  DelegationRequest,
  queue:    BoundedFIFO<ScheduledTick>
): void {
  // Transition parent to WAITING
  LifecycleController.transition(agentId, 'yield');

  // DelegationProtocol validates grants (INV-06), issues token (INV-13),
  // spawns child agent, and registers a callback: when the child reaches
  // TERMINATED, resume the parent with the child's final output.
  DelegationProtocol.handle(agentId, tickSeq, request, (childResult) => {
    LifecycleController.transition(agentId, 'resume');
    queue.enqueue({
      agentId,
      tickInput: {
        ...buildTickInput(agentId, tickSeq, request.continuationInstruction),
        delegationResult: childResult,
      },
    });
  });
}
```

---

## 6. Tick Sequence Diagram

```
Caller (Scheduler)
    │
    │  runTick(TickInput)
    ▼
┌───────────────────────────────────────────────────────┐
│  STEP 1: Assert agent is ACTIVE                       │
│          → if not: emitFailure(INVALID_STATE)         │
├───────────────────────────────────────────────────────┤
│  STEP 2: Init or restore EphemeralStore               │
│          → restore if continuation tick               │
│          → init fresh if first tick                   │
├───────────────────────────────────────────────────────┤
│  STEP 3: Evaluation loop (max N steps)                │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  log STEP event                                 │  │
│  │  result = evalInstruction(...)                  │  │
│  │                                                 │  │
│  │  PURE_VALUE       → COMPLETED (exit loop)       │  │
│  │  NEXT_INSTRUCTION → continue loop               │  │
│  │  NEEDS_TOOL       → checkpoint + PENDING_TOOL   │  │
│  │  NEEDS_DELEGATION → checkpoint + PENDING_DELEG  │  │
│  │  FAILURE          → destroy + FAILED            │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  STEP 4: steps == MAX_STEPS → TICK_OVERFLOW           │
└───────────────────────────────────────────────────────┘
    │
    │  TickOutput
    ▼
Caller (Scheduler) → Logger.appendAll(output.logs) → dispatch
```

---

## 7. `evalInstruction()` Contract

This function is intentionally left as an interface boundary. The kernel defines the contract; the agent's instruction set implements it.

```typescript
// The kernel's side of the contract (execution/tick.ts imports this)
type EvalFn = (
  instruction: Instruction,
  context:     AgentContext,   // READ-ONLY. Do not mutate.
  ephemeral:   EphemeralHandle // Read/write scratch for this tick only.
) => EvalResult;

// What the implementer must guarantee:
//
//   DETERMINISM:   evalInstruction(i, ctx, e) always returns the same EvalResult
//                  given identical i, ctx, and e contents.
//
//   PURITY:        No reads from Date, Math.random, process.env, or any
//                  global mutable object. (INV-20)
//
//   NO I/O:        No network calls, no file system, no timers.
//                  All such needs must exit as NEEDS_TOOL.
//
//   NO SIDE EFFECTS ON CONTEXT: context is frozen at tick start.
//                  Attempting to write to it must throw (use Object.freeze).
//
//   BOUNDED:       evalInstruction must return. It must not loop internally.
//                  Loops must be expressed as NEXT_INSTRUCTION chains,
//                  bounded by the kernel's MAX_STEPS counter.
```

---

## 8. Failure Paths Within the Execution Loop

| Failure Code | Trigger | EphemeralStore | TickOutput | Agent transition |
|---|---|---|---|---|
| `INVALID_STATE` | Agent not ACTIVE at tick start | Not initialized | `FAILED` | None (state unchanged) |
| `EVAL_FAILURE` | evalInstruction returns `FAILURE` | Destroyed | `FAILED` | → FAULTED via FailureHandler |
| `TICK_OVERFLOW` | steps >= MAX_STEPS | Destroyed | `FAILED` | → FAULTED via FailureHandler |
| `REPLAY_MISSING_RESULT` | REPLAY mode, no logged tool result | Destroyed | `FAILED` | → FAULTED |
| `INVARIANT_BREACH` | Any INV-* assertion fails | Destroyed | — | → TERMINATED directly |

---

## 9. LogEntry Types Emitted by the Execution Loop

```typescript
type ExecutionLogEntry =
  | { kind: 'TICK_STARTED';           agentId: AgentId; tickSeq: number; busSeq: number }
  | { kind: 'STEP';                   agentId: AgentId; tickSeq: number; step: number; instruction: Instruction; busSeq: number }
  | { kind: 'TICK_COMPLETED';         agentId: AgentId; tickSeq: number; result: Value; busSeq: number }
  | { kind: 'TICK_PENDING_TOOL';      agentId: AgentId; tickSeq: number; request: ToolCallRequest; busSeq: number }
  | { kind: 'TICK_PENDING_DELEGATION';agentId: AgentId; tickSeq: number; request: DelegationRequest; busSeq: number }
  | { kind: 'TICK_FAILED';            agentId: AgentId; tickSeq: number; failure: FailureEvent; busSeq: number }
  | { kind: 'TICK_OVERFLOW';          agentId: AgentId; tickSeq: number; stepsReached: number; busSeq: number };

// Every entry carries busSeq. This is the ordering key used by replay
// to reconstruct the exact interleaving of events across agents. (INV-16)
```

---

## 10. Implementation Checklist

Before marking the execution loop as complete, verify:

- [ ] `runTick()` is a function, not a method — no `this`, no class state
- [ ] `evalInstruction` is imported as a pure function; ESLint rule bans `Date`, `Math.random`, `fetch` inside `execution/`
- [ ] `KernelConfig.maxStepsPerTick` is read once at boot and never again (frozen)
- [ ] `EphemeralStore.init()` and `.restore()` are mutually exclusive per `(agentId, sequenceNumber)`
- [ ] `EphemeralStore.destroy()` is called on every exit path except `PENDING_*` (which calls `.checkpoint()`)
- [ ] All `LogEntry` objects are pushed to `logs[]` before the tick returns, not after
- [ ] `Logger.appendAll(output.logs)` is called by the scheduler immediately after `runTick()` returns, before any other scheduler logic
- [ ] The global drain loop has no `async/await` — it is synchronous throughout (INV-21)
- [ ] Replay mode: `ToolGate.execute()` path is covered by a test that asserts the real adapter is never called
- [ ] TICK_OVERFLOW test exists: agent with instruction that always returns `NEXT_INSTRUCTION` must produce `FAILED` after exactly `maxStepsPerTick` steps
