# Omni Agent OS: Integration & Execution Tasks

The foundation is complete. All 12 deterministic memory, security, routing, and execution modules are implemented safely without abstraction leaks according to the frozen architecture specifications.

To bring the OS to life as a functional unit, we need to handle the wiring and evaluation layer.

## Phase 1: The Kernel Bus & Bootstrapper (Wiring)
- [ ] **`kernel/bus.ts`**: Implement the `KernelBus` typed event spine (the central PubSub that links decoupled modules without direct function calls).
- [ ] **`kernel/index.ts`**: Create the `OmniKernel` class that instantiates all 12 modules (`AgentRegistry`, `ExecutionLogger`, `PermissionModel`, `TickEngine`, etc.) and seamlessly injects dependencies cleanly at boot.

## Phase 2: The Agent Instruction Evaluator (Logic)
- [ ] **Define Base Instructions (`execution/types.ts`)**: Define standard system commands agents can emit natively (e.g., `pure_compute`, `call_tool`, `delegate_task`).
- [ ] **Implement `evalInstruction` (`execution/evaluator.ts`)**: The pure evaluation function matching `Instruction` contexts dynamically inside the `TickEngine` returning `PURE_VALUE`, `NEEDS_TOOL`, `NEEDS_DELEGATION`, or `FAILURE` constraints.

## Phase 3: The Tool Registry (Capabilities)
- [ ] **`tools/types.ts`**: Define `ToolManifest` typing.
- [ ] **`tools/registry.ts`**: Implement a registry for external tool loading.
- [ ] **Implement Core OS Tools**:
  - `system.read_file`: Sandboxed file loader.
  - `system.fetch`: Simulated network outbound call.
  - `system.ask_user`: A blocking wait-for-input constraint.

## Phase 4: Full End-to-End OS Simulation
- [ ] **`simulation.ts`**: Build a full integration script mimicking a real-world runtime.
  1. Boot `OmniKernel`.
  2. Spawn a Root Agent via `AgentRegistry`.
  3. Emit an initial complex Instruction.
  4. Flush the `Scheduler` queue completely (watch it load ephemeral memory, check permissions, execute tools via WAL, log events).
  5. Restart the OS into `REPLAY` mode using the logs generated from step 4 to assert `INV-15` perfect deterministic recreation.
