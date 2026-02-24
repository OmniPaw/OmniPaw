# Omni Kernel — Agent Lifecycle State Machine

> **Document scope:** Authoritative spec for `lifecycle/controller.ts` and `lifecycle/types.ts`.
> **Status:** Frozen. All implementation must conform to this document. Do not modify without versioning.

---

## 1. Purpose

The lifecycle state machine is the single source of truth for what an agent is allowed to do at any moment. Every module that touches an agent — the TickEngine, MemoryLayer, ToolGate, DelegationProtocol — must consult the agent's current state before acting. No module is permitted to act on an agent that is not in an appropriate state for that action.

The `LifecycleController` is the **only** module permitted to change state. All other modules read state; they never write it directly.

---

## 2. States

```
┌─────────────────────────────────────────────────────────────────────────┐
│  State       │ Description                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  DEFINED     │ Identity record exists in AgentRegistry. No resources    │
│              │ allocated. Agent is not runnable. This is the birth      │
│              │ state — every agent starts here.                         │
├─────────────────────────────────────────────────────────────────────────┤
│  SPAWNED     │ Resources allocated. PermissionGrant list assigned.      │
│              │ TickQueue created. Agent is ready to activate but has    │
│              │ not yet received its first instruction.                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ACTIVE      │ TickEngine is running or is queued to run. The agent is  │
│              │ consuming instructions and producing outputs. This is     │
│              │ the primary working state.                                │
├─────────────────────────────────────────────────────────────────────────┤
│  WAITING     │ The agent has exited a tick with PENDING_TOOL or         │
│              │ PENDING_DELEGATION. It is blocked waiting for an         │
│              │ external result to be fed back. EphemeralStore is        │
│              │ checkpointed. No ticks may run in this state.            │
├─────────────────────────────────────────────────────────────────────────┤
│  RESUMABLE   │ The agent has been explicitly suspended (hibernated).     │
│              │ A full PersistentSnapshot exists. The agent may be       │
│              │ resumed from the log at any future time, or expire.      │
├─────────────────────────────────────────────────────────────────────────┤
│  COMPLETING  │ The agent has produced its final output and is running   │
│              │ teardown logic (releasing resources, notifying parent,   │
│              │ flushing final log entries). No new instructions.        │
├─────────────────────────────────────────────────────────────────────────┤
│  FAULTED     │ An unrecoverable or unclassified error occurred. The     │
│              │ agent is halted. Recovery may be attempted if the fault  │
│              │ class is TRANSIENT. INVARIANT_BREACH always skips        │
│              │ FAULTED and goes directly to TERMINATED.                 │
├─────────────────────────────────────────────────────────────────────────┤
│  RECOVERING  │ The FailureHandler has accepted a recovery attempt. The  │
│              │ agent is replaying from its last checkpoint. If recovery │
│              │ succeeds, transitions to ACTIVE. If exhausted, goes to   │
│              │ TERMINATED.                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  TERMINATED  │ Final state. The agent's run is complete (success or     │
│              │ failure). Identity record is retained in AgentRegistry   │
│              │ as read-only history. No further transitions possible.   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. State Diagram

```
                           ┌────────────┐
                           │   DEFINED  │
                           └─────┬──────┘
                                 │ spawn(config)
                           ┌─────▼──────┐
                           │  SPAWNED   │
                           └─────┬──────┘
                                 │ activate()
                           ┌─────▼──────┐
                ┌───────────│   ACTIVE   │◀────────────────────┐
                │           └──┬──┬──┬───┘                     │
                │              │  │  │                         │
                │  complete()  │  │  │ suspend()               │
                │              │  │  │                         │
                │   error() ◀──┘  │  └──▶ ┌───────────┐       │
                │                 │        │ RESUMABLE │       │
                │      yield() /  │        └─────┬─────┘       │
                │   await_tool()  │              │             │
                │                 │    expire()  │  resume()   │
                │           ┌─────▼──────┐       │             │
                │           │  WAITING   │       ▼             │
                │           └──────┬─────┘   TERMINATED        │
                │                  │                           │
                │  timeout()/      │ resume() ─────────────────┘
                │  error() ◀───────┘
                │
     ┌──────────▼──┐         ┌────────────┐
     │   FAULTED   │         │ COMPLETING │◀── complete() from ACTIVE
     └──────┬──────┘         └─────┬──────┘
            │                      │ teardown_ok()
   recover()│                      ▼
     ┌──────▼──────┐          TERMINATED
     │  RECOVERING │
     └──────┬──────┘
            │
     recovery_success() ──▶ ACTIVE
     recovery_exhausted() ─▶ TERMINATED
```

---

## 4. Transition Table (Exhaustive)

Every valid transition is listed here. Any transition not in this table **must be rejected** by `LifecycleController` with a logged `INVALID_TRANSITION` error. There are no implicit or default transitions.

| # | From        | To          | Trigger                  | Who may call          | Side effects on transition |
|---|-------------|-------------|--------------------------|------------------------|----------------------------|
| 1 | DEFINED     | SPAWNED     | `spawn(config)`          | Kernel / DelegationProtocol | Allocate TickQueue; assign PermissionGrants; log SPAWNED event |
| 2 | SPAWNED     | ACTIVE      | `activate()`             | Kernel scheduler       | Enqueue first instruction; log ACTIVE event |
| 3 | ACTIVE      | WAITING     | `yield()` / `await_tool()` | TickEngine (on PENDING_TOOL or PENDING_DELEGATION exit) | Checkpoint EphemeralStore; log WAITING event |
| 4 | ACTIVE      | COMPLETING  | `complete()`             | TickEngine (on COMPLETED exit with no further instructions) | Begin teardown sequence; log COMPLETING event |
| 5 | ACTIVE      | FAULTED     | `error(failure)`         | TickEngine / FailureHandler | Log FailureEvent; freeze TickQueue; log FAULTED event |
| 6 | ACTIVE      | RESUMABLE   | `suspend()`              | Kernel / parent agent  | Write PersistentSnapshot; log RESUMABLE event |
| 7 | WAITING     | ACTIVE      | `resume(result)`         | Scheduler (on tool/delegation result delivery) | Restore EphemeralStore checkpoint; enqueue continuation tick; log ACTIVE event |
| 8 | WAITING     | FAULTED     | `timeout()` / `error()`  | Scheduler / FailureHandler | Log FailureEvent; destroy EphemeralStore checkpoint; log FAULTED event |
| 9 | RESUMABLE   | ACTIVE      | `resume()`               | Kernel / parent agent  | Restore PersistentSnapshot; verify walChecksum; enqueue tick; log ACTIVE event |
|10 | RESUMABLE   | TERMINATED  | `expire()`               | Kernel (TTL expiry)    | Destroy PersistentSnapshot; auto-revoke DelegationTokens; log TERMINATED event |
|11 | COMPLETING  | TERMINATED  | `teardown_ok()`          | Teardown routine       | Release TickQueue; notify parent; log TERMINATED event |
|12 | FAULTED     | RECOVERING  | `recover()`              | FailureHandler         | Restore last checkpoint; log RECOVERING event |
|13 | FAULTED     | TERMINATED  | `abandon()`              | FailureHandler (max retries exhausted) | Revoke all child tokens; notify parent; log TERMINATED event |
|14 | RECOVERING  | ACTIVE      | `recovery_success()`     | FailureHandler         | Resume from checkpoint; log ACTIVE event |
|15 | RECOVERING  | TERMINATED  | `recovery_exhausted()`   | FailureHandler         | Revoke all child tokens; notify parent; log TERMINATED event |

---

## 5. TypeScript Types

```typescript
// lifecycle/types.ts

type AgentState =
  | 'DEFINED'
  | 'SPAWNED'
  | 'ACTIVE'
  | 'WAITING'
  | 'RESUMABLE'
  | 'COMPLETING'
  | 'FAULTED'
  | 'RECOVERING'
  | 'TERMINATED';

type TransitionTrigger =
  | 'spawn'
  | 'activate'
  | 'yield'
  | 'await_tool'
  | 'complete'
  | 'error'
  | 'suspend'
  | 'resume'
  | 'timeout'
  | 'expire'
  | 'teardown_ok'
  | 'recover'
  | 'abandon'
  | 'recovery_success'
  | 'recovery_exhausted';

type LifecycleTransition = {
  from:      AgentState;
  to:        AgentState;
  trigger:   TransitionTrigger;
  timestamp: number;          // wall clock at transition time (for logging only — never for logic)
  busSeq:    number;          // kernel bus sequence at transition time
  meta?:     Record<string, unknown>;  // failure details, config, etc.
};

// The exhaustive transition map — checked at runtime by LifecycleController
const VALID_TRANSITIONS: ReadonlyArray<[AgentState, TransitionTrigger, AgentState]> = [
  ['DEFINED',    'spawn',                'SPAWNED'   ],
  ['SPAWNED',    'activate',             'ACTIVE'    ],
  ['ACTIVE',     'yield',                'WAITING'   ],
  ['ACTIVE',     'await_tool',           'WAITING'   ],
  ['ACTIVE',     'complete',             'COMPLETING'],
  ['ACTIVE',     'error',                'FAULTED'   ],
  ['ACTIVE',     'suspend',              'RESUMABLE' ],
  ['WAITING',    'resume',               'ACTIVE'    ],
  ['WAITING',    'timeout',              'FAULTED'   ],
  ['WAITING',    'error',                'FAULTED'   ],
  ['RESUMABLE',  'resume',               'ACTIVE'    ],
  ['RESUMABLE',  'expire',               'TERMINATED'],
  ['COMPLETING', 'teardown_ok',          'TERMINATED'],
  ['FAULTED',    'recover',              'RECOVERING'],
  ['FAULTED',    'abandon',              'TERMINATED'],
  ['RECOVERING', 'recovery_success',     'ACTIVE'    ],
  ['RECOVERING', 'recovery_exhausted',   'TERMINATED'],
] as const;

type AgentLifecycleRecord = {
  agentId:     AgentId;
  transitions: LifecycleTransition[];  // append-only; ordered by busSeq
};
```

---

## 6. LifecycleController Interface

```typescript
// lifecycle/controller.ts

interface LifecycleController {
  // Returns the current state. Never throws — DEFINED is the default if unknown.
  getState(agentId: AgentId): AgentState;

  // Attempts a transition. Logs the attempt before applying.
  // Returns the new state on success.
  // Throws TransitionRejectedError (logged) if the transition is invalid.
  transition(
    agentId:  AgentId,
    trigger:  TransitionTrigger,
    meta?:    Record<string, unknown>
  ): AgentState;

  // Returns the full ordered transition history for an agent.
  getRecord(agentId: AgentId): AgentLifecycleRecord;

  // Returns true if the agent exists and is in one of the given states.
  isIn(agentId: AgentId, ...states: AgentState[]): boolean;
}
```

---

## 7. Per-State Action Permissions

What each module is allowed to do in each state. Anything not listed as ALLOWED is DENIED by default.

```
State        │ TickEngine  │ MemoryLayer  │ ToolGate  │ DelegationProtocol
─────────────┼─────────────┼──────────────┼───────────┼───────────────────
DEFINED      │ DENIED      │ DENIED       │ DENIED    │ DENIED
SPAWNED      │ DENIED      │ Read only    │ DENIED    │ DENIED
ACTIVE       │ ALLOWED     │ ALLOWED      │ ALLOWED   │ ALLOWED
WAITING      │ DENIED      │ Checkpoint   │ DENIED    │ DENIED
             │             │ read only    │           │
RESUMABLE    │ DENIED      │ Snapshot     │ DENIED    │ DENIED
             │             │ read only    │           │
COMPLETING   │ Teardown    │ Read + flush │ DENIED    │ DENIED
             │ only        │ only         │           │
FAULTED      │ DENIED      │ DENIED       │ DENIED    │ Token revocation
             │             │             │           │ only
RECOVERING   │ Replay only │ Restore only │ Replay    │ DENIED
             │             │             │ only      │
TERMINATED   │ DENIED      │ DENIED       │ DENIED    │ DENIED
```

---

## 8. Invariants Specific to the State Machine

These are a subset of the full system invariants (see `invariants.md`) that apply directly to lifecycle:

- **SM-INV-01:** `LifecycleController` is the only module that may call a state-mutating method. All other modules call `getState()` or `isIn()` only.
- **SM-INV-02:** Every transition is logged to the `ExecutionLogger` via the Kernel Bus **before** the in-memory state map is updated. Log-first, always.
- **SM-INV-03:** `TERMINATED` is a sink state. No transition out of `TERMINATED` exists or may be added.
- **SM-INV-04:** An agent's `AgentLifecycleRecord` is append-only. Past transitions are never modified or deleted.
- **SM-INV-05:** In `REPLAY` mode, `LifecycleController` validates that each transition matches the logged sequence. Any deviation is `REPLAY_DIVERGENCE`.
- **SM-INV-06:** `INVARIANT_BREACH` failures bypass `FAULTED` entirely. The agent transitions directly to `TERMINATED` and all child `DelegationToken`s are revoked synchronously before any other action.

---

## 9. Edge Cases and Clarifications

**Q: What if activate() is called on an already ACTIVE agent?**
`INVALID_TRANSITION`. Logged and rejected. The agent stays ACTIVE.

**Q: What if an agent in WAITING times out AND receives a result at the same moment?**
The single-threaded scheduler prevents true simultaneity. Whichever event the global TickQueue processes first wins. The second event is discarded with a logged `STALE_RESULT` notice.

**Q: Can an agent transition from FAULTED back to ACTIVE directly?**
No. The path is always `FAULTED → RECOVERING → ACTIVE`. This enforces that a recovery checkpoint is always established before execution resumes.

**Q: Can COMPLETING fail?**
Yes. If teardown throws, the agent transitions `COMPLETING → FAULTED`. Recovery may then be attempted. If recovery succeeds, teardown is retried from a checkpoint. If recovery is exhausted, the agent is `TERMINATED` with teardown marked incomplete in the log.

**Q: What happens to child agents when a parent reaches TERMINATED?**
`DelegationProtocol` receives a `ParentTerminatedEvent` via the Kernel Bus. It immediately sets `revoked = true` on all `DelegationToken`s whose `parentAgentId` matches. Each child agent's next tick begins with a `TOKEN_REVOKED` failure injected at the head of its TickQueue.
