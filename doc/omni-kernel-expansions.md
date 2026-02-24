# Omni Agent OS — Kernel Expansions

The core deterministic runtime of the Omni Agent OS is functionally complete. However, to transform it from an in-memory execution engine into a practical ecosystem, we must implement several external adapters. 

These expansions deliberately sit *outside* the core kernel invariants, acting as host-level plugins that wrap the `OmniKernel` entry point.

## Expansion 1: Persistent File Storage & Durability
Currently, the `ExecutionLogger` and `PersistentStore` are strictly in-memory maps. If the Node.js process restarts, the OS loses its entire identity registry, delegation trees, and WAL sequences.
- **Goal:** Implement a durable file-backed `HostLogger` that writes `.jsonl` audit trails to disk synchronously, allowing the OS to resume from cold boots flawlessly using the `REPLAY` architecture.

## Expansion 2: AI Instruction Evaluator (The "Brain")
The `TickEngine` currently processes hardcoded mock `Instruction` payloads. We need to bridge the gap between abstract agent goals and concrete `Instruction` objects.
- **Goal:** Create an LLM Adapter that receives the current `MemoryLayer` snapshot, the `AgentState`, and emits a structured `TickInput` containing real `CALL_TOOL`, `DELEGATE`, or `NOOP` commands.

## Expansion 3: Concrete Side-Effect Tools
The `ToolGate` perfectly sandboxes execution, but the `ToolRegistry` currently only holds simulated mocks.
- **Goal:** Implement real, sandboxed utilities (e.g., `fs.read_file`, `sys.bash`, `net.fetch`) inside the Host layer, registering them dynamically into the Kernel while retaining complete deterministic replayability.

## Expansion 4: Terminal User Interface (TUI)
Observability of a multi-agent system is complex. A graphical terminal interface will map the Kernel Bus to visual components natively.
- **Goal:** Build a robust TUI using `blessed` or `ink` to watch Agents spawn, see their state transitions (`ACTIVE` → `WAITING`), and observe memory snapshots dynamically.
