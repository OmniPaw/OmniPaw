# OmniPaw — System Invariants

> **Document scope:** Authoritative list of all runtime invariants for the OmniPaw kernel.
> **Status:** Frozen. Every invariant is checked at runtime by `invariants/checker.ts`.
> Violation of any invariant triggers `INVARIANT_BREACH`, which halts the affected agent
> and escalates to its parent. There are no warnings — only enforcement.

---

## 1. What an Invariant Is

An invariant is a condition that must be true **at all times**, not just at system startup or at certain checkpoints. If an invariant is ever false, the kernel is in a corrupt state. The only safe response is to halt the affected agent, freeze its child delegation tokens, write to the immutable audit log, and escalate to the parent.

Invariants are not guidelines. They are not "try to do this." They are **non-negotiable rules** that define what OmniPaw is. Removing or weakening an invariant changes the fundamental guarantees of the system.

---

## 2. Invariant Classification

| Class | Meaning |
|---|---|
| **LOG** | Guarantees about the append-only execution log |
| **STATE** | Guarantees about agent lifecycle state |
| **EXEC** | Guarantees about tick execution |
| **MEM** | Guarantees about memory scopes |
| **PERM** | Guarantees about the permission model |
| **DELEG** | Guarantees about delegation |
| **BUS** | Guarantees about the Kernel Bus |
| **REPLAY** | Guarantees about replay correctness |
| **CONC** | Guarantees about concurrency |

---

## 3. Full Invariant List

```
════════════════════════════════════════════════════════
  LOG — Execution Log Invariants
════════════════════════════════════════════════════════

INV-01  [LOG]
  Every state transition must be recorded in the execution log
  BEFORE the in-memory state is updated.
  Log-first. Always. No exceptions.

  Enforcement: LifecycleController.transition() calls Logger.append()
               synchronously before mutating its state map.

INV-07  [LOG]
  Every LogEntry is immutable once appended.
  No log compaction, modification, or deletion is permitted
  within an agent's active lifetime.

  Enforcement: Logger exposes append-only interface.
               No delete() or update() method exists.

INV-14  [LOG]
  Tool call results are recorded in the log BEFORE being returned
  to the calling tick.

  Enforcement: ToolGate.execute() calls Logger.append(toolResultEntry)
               before returning result to runTick().


════════════════════════════════════════════════════════
  STATE — Lifecycle State Invariants
════════════════════════════════════════════════════════

INV-02  [STATE]
  No module may read or write an agent's lifecycle state
  outside of the LifecycleController's defined interface.

  Enforcement: No other module imports lifecycle/controller internals.
               All cross-module state access goes through bus.ts.

INV-09  [STATE]
  An agent in TERMINATED state cannot execute ticks,
  access memory, or perform tool calls.

  Enforcement: TickEngine checks LifecycleController.isIn(agentId, 'ACTIVE')
               as step 1 of every runTick(). MemoryLayer and ToolGate
               perform the same check before any operation.


════════════════════════════════════════════════════════
  EXEC — Execution Loop Invariants
════════════════════════════════════════════════════════

INV-03  [EXEC]
  A TickEngine instance processes exactly one tick at a time per agent.
  No tick may begin for agent A while another tick for agent A is running.

  Enforcement: TickQueue is a bounded FIFO per agent.
               The scheduler dequeues one item, runs it to completion
               (or PENDING_* exit), then dequeues the next.

INV-12  [EXEC]
  The TickEngine's step count per tick is bounded by
  KernelConfig.maxStepsPerTick.
  This value is set at kernel boot and is immutable at runtime.

  Enforcement: KernelConfig is frozen (Object.freeze) after boot.
               runTick() halts with TICK_OVERFLOW if steps exceed the limit.

INV-20  [EXEC]
  evalInstruction must be a pure, deterministic function.
  It must not read Date.now(), Math.random(), process.env,
  or any global mutable state.
  It must not perform I/O of any kind.
  All non-determinism must exit the tick as a NEEDS_TOOL request
  and pass through ToolGate.

  Banned operations:
    Date.now() / new Date()          → use tool: 'clock.now'
    Math.random()                    → use tool: 'rng.next'
    process.env.*                    → inject via AgentContext.env
    fetch() / fs.readFile() / etc.   → exit as NEEDS_TOOL
    module-level mutable singletons  → pass via context or ephemeral

  Enforcement: ESLint rule on execution/ module.
               Fuzz test: run same tick twice, assert identical output.
               REPLAY_DIVERGENCE detection catches violations post-hoc.


════════════════════════════════════════════════════════
  MEM — Memory Layer Invariants
════════════════════════════════════════════════════════

INV-05  [MEM]
  EphemeralStore data never persists past the tick that created it,
  unless explicitly checkpointed for resumption (PENDING_TOOL /
  PENDING_DELEGATION exit only).

  Enforcement: EphemeralStore.destroy() is called on COMPLETED and
               FAILED exits. Checkpoint is only written on PENDING_* exits.

INV-11  [MEM]
  All values stored in any memory scope (Ephemeral, Persistent, Shared)
  must be serializable to JSON.
  Non-serializable values are rejected at write time with a
  SERIALIZATION_ERROR, never silently coerced.

  Enforcement: All store write methods call JSON.stringify(value) in a
               try/catch before accepting the write.

INV-19  [MEM]
  SharedStore writes must include an expectedVersion.
  A write whose expectedVersion does not match the current stored
  version is rejected with WRITE_CONFLICT and never applied.
  Both the attempt and the rejection are recorded in the log.

  Enforcement: SharedStore.write() compares expectedVersion to current
               version atomically (safe because scheduler is single-threaded).

INV-22  [MEM]
  PersistentStore.snapshot() must always be derived by replaying WAL
  entries up to the specified busSeqAt boundary.
  Raw in-memory copies not derived from the WAL are prohibited.
  On restore, walChecksum must be verified before any tick is allowed
  to proceed. Checksum mismatch → INVARIANT_BREACH.

  Formal definition:
    snapshot(agentId, busSeqAt) ≡ replay(WAL[agentId], {busSeq ≤ busSeqAt})


════════════════════════════════════════════════════════
  PERM — Permission Model Invariants
════════════════════════════════════════════════════════

INV-04  [PERM]
  PermissionModel.evaluate() must be called before every ToolGate
  execution, every SharedStore write, and every DelegationProtocol
  request.
  No action that crosses a module or scope boundary may bypass
  the permission gate.

  Enforcement: ToolGate, SharedStore, and DelegationProtocol each call
               PermissionModel.evaluate() as their first operation.
               There is no bypass path.


════════════════════════════════════════════════════════
  DELEG — Delegation Invariants
════════════════════════════════════════════════════════

INV-06  [DELEG]
  DelegationToken.grants must always be a strict subset (⊆) of
  the delegating agent's PermissionGrants at the moment of delegation.
  A delegatee can never receive more permission than its delegator holds.

  Enforcement: DelegationProtocol.validateRequest() computes
               grantSubset ⊆ parent.currentGrants before issuing a token.
               Any superset is rejected with PRIVILEGE_ESCALATION_ATTEMPT,
               which is logged and classified as POLICY_VIOLATION.

INV-08  [DELEG]
  The DelegationTree contains no cycles.
  Every agent has at most one parent.

  Enforcement: DelegationProtocol.addNode() checks for cycles
               by walking the tree upward before inserting.
               Any cycle attempt is INVARIANT_BREACH.

INV-13  [DELEG]
  No agent may spawn a sub-agent without an active, non-revoked
  DelegationToken issued by its parent.

  Enforcement: DelegationProtocol.handleRequest() verifies the token
               exists, is not revoked, and has not expired (ttl check
               uses the logged busSeq timestamp, not wall clock).


════════════════════════════════════════════════════════
  BUS — Kernel Bus Invariants
════════════════════════════════════════════════════════

INV-10  [BUS]
  The Kernel Bus is the only channel through which modules communicate.
  No module holds a direct reference to another module's internals.
  All cross-module interaction is mediated by typed bus events.

  Enforcement: Each module folder exports only its types.ts and one
               implementation file. No module imports from another
               module's implementation file directly.

INV-16  [BUS]
  All Kernel Bus events are assigned a globally unique, monotonically
  increasing busSeq before being delivered.
  No two events share a busSeq value.
  Any attempt to emit an event with a busSeq lower than the current
  counter is INVARIANT_BREACH.

  Enforcement: KernelBus maintains a single integer counter.
               busSeq is assigned at emit time, before delivery.
               Counter is never decremented or reset during a session.


════════════════════════════════════════════════════════
  REPLAY — Replay Correctness Invariants
════════════════════════════════════════════════════════

INV-15  [REPLAY]
  Replay of (agentId, sequenceRange) from the execution log must
  produce identical TickOutputs for all COMPLETED ticks,
  given the same tool result stubs from the log.
  Any divergence is REPLAY_DIVERGENCE — a hard failure, never silently skipped.

INV-17  [REPLAY]
  KernelMode (LIVE | REPLAY) is immutable after kernel boot.
  No module may switch mode at runtime.

  Enforcement: KernelConfig is frozen after boot.
               KernelMode is broadcast as the first bus event.
               Any attempt to mutate it post-boot is INVARIANT_BREACH.

INV-18  [REPLAY]
  In REPLAY mode, ToolGate must never invoke a real tool adapter.
  Any code path that would call adapter.execute() in REPLAY mode
  is INVARIANT_BREACH.

  Enforcement: ToolGate checks KernelMode at the top of execute().
               In REPLAY mode, it calls Logger.getToolResult() only.
               The real adapter call is guarded by an if-branch with
               an invariant assertion on the else path.


════════════════════════════════════════════════════════
  CONC — Concurrency Invariants
════════════════════════════════════════════════════════

INV-21  [CONC]
  The reference kernel processes exactly one runAgentLoop() call at a time.
  No concurrent tick execution within a single kernel instance is permitted.
  Parallelism requires separate kernel instances with separate, isolated state.

  Enforcement: The global TickQueue drain loop is synchronous.
               No async concurrency primitives (Promise.all, Worker threads,
               etc.) are used within the single kernel instance boundary.
```

---

## 4. Invariant Dependency Map

Some invariants reinforce each other. Violating one often implies violation of another.

```
INV-01 (log-first transitions)
  └── required by INV-15 (replay correctness)
       └── required by INV-20 (eval purity) + INV-18 (no real tools in replay)

INV-16 (busSeq uniqueness)
  └── required by INV-19 (SharedStore OCC ordering)
       └── required by INV-15 (replay correctness)

INV-21 (single-threaded)
  └── makes INV-19 safe (no concurrent version counter mutation)
  └── makes INV-16 trivial (no CAS needed for busSeq)

INV-06 (grant subset)
  └── required by INV-04 (permission gate always called)
  └── prevents privilege escalation across INV-08 (no cycles)

INV-22 (WAL-derived snapshots)
  └── required by INV-15 (replay correctness)
  └── depends on INV-07 (log immutability)
```

---

## 5. Checker Implementation Contract

`invariants/checker.ts` exports a single object with one method per invariant:

```typescript
// invariants/checker.ts

interface InvariantChecker {
  // Called by LifecycleController before updating state
  assertLogFirst(agentId: AgentId, logWriteConfirmed: boolean): void;

  // Called by TickEngine at the top of runTick()
  assertAgentActive(agentId: AgentId, state: AgentState): void;

  // Called by TickEngine before and after each step
  assertStepBound(steps: number, max: number): void;

  // Called by ToolGate before every execute()
  assertPermissionEvaluated(evaluationResult: PolicyResult): void;

  // Called by ToolGate at the top of execute()
  assertNotReplayModeRealTool(mode: KernelMode): void;

  // Called by SharedStore.write() after version check
  assertVersionMatched(expected: number, actual: number, txId: TxId): void;

  // Called by DelegationProtocol before issuing token
  assertGrantSubset(parentGrants: PermissionGrant[], childGrants: PermissionGrant[]): void;

  // Called by DelegationProtocol before inserting a new node
  assertNoCycle(tree: DelegationTree, newChildId: AgentId, parentId: AgentId): void;

  // Called by KernelBus before delivering every event
  assertBusSeqMonotonic(previous: number, next: number): void;

  // Called by PersistentStore.snapshot() before returning
  assertSnapshotWALDerived(snapshot: PersistentSnapshot): void;

  // Called after every replayed tick
  assertReplayOutputMatch(logged: TickOutput, replayed: TickOutput): void;
}

// Every assertion method follows the same contract:
//   - If the invariant holds: returns void silently
//   - If the invariant is violated: throws InvariantBreachError
//     which FailureHandler catches and routes as INVARIANT_BREACH,
//     halting the agent and escalating to parent
```

---

## 6. What Happens on INVARIANT_BREACH

```
InvariantBreachError thrown
        │
        ▼
FailureHandler.handle(agentId, {
  class: 'INVARIANT_BREACH',
  code:  <invariant id e.g. 'INV-06'>,
  ...
})
        │
        ├── 1. Log to immutable audit log (separate from execution log;
        │       cannot be replayed over or compacted)
        │
        ├── 2. Transition agent directly to TERMINATED
        │       (bypasses FAULTED and RECOVERING entirely)
        │
        ├── 3. Revoke all DelegationTokens where parentAgentId = agentId
        │       (depth-first, synchronous, before returning)
        │
        ├── 4. Emit CHILD_BREACH_EVENT to parent agent's TickQueue
        │       (parent tick resumes with this event as input)
        │
        └── 5. Return. No retry. No recovery. Done.
```

The audit log entry for an `INVARIANT_BREACH` contains:
- The invariant ID that was violated (`INV-XX`)
- The agent ID
- The tick sequence number
- The busSeq at the moment of breach
- The full serialized context that triggered the breach
- A stack trace of the `InvariantBreachError`

This record is permanent and cannot be altered by any kernel operation.
