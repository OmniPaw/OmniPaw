---
seo:
  title: OmniPaw - Deterministic Multi-Agent Substrate
  description: Strictly governed, replayable, and cryptographically provable autonomous agent execution kernel.
---

::u-page-hero
#title
Deterministic execution substrate for [autonomous systems]{.text-primary}.

#description
OmniPaw is a multi-agent execution kernel designed for total reproducibility. Stop debugging unpredictable hallucinations and start proving every agent interaction with 100% deterministic replay.

#links
:::u-button
---
color: brand-cyan
size: xl
to: /en/getting-started/quickstart
trailing-icon: i-lucide-arrow-right
---
Get Started
:::

:::u-button
---
color: neutral
icon: simple-icons-github
size: xl
to: https://github.com/OmniPaw/OmniPaw
variant: outline
---
Star on GitHub
:::

#headline
:::u-button
---
size: sm
to: /en/getting-started/architecture
variant: outline
---

Deterministic Architecture Specification →
:::
::

::u-page-section
:::u-page-grid
::::u-page-card
---
spotlight: true
class: group col-span-2 lg:col-span-1
---
:::div{.flex.items-center.justify-center.h-48}
:u-icon{name="i-lucide-history" class="w-24 h-24 text-brand-cyan group-hover:scale-110 transition-transform"}
:::

#title
100% Deterministic Replay

#description
Rewind any agent execution loop to inspect precisely what led to a failure. No more "it worked once" bugs—if it happened, you can reproduce it perfectly.
::::

    ::::u-page-card
    ---
    spotlight: true
    class: col-span-2
    target: _blank
    to: https://ui.nuxt.com
    ---
      :::::OmniTracePreview
      :::::

    #title
    Cryptographic Tracing & Proofs

    #description
    Every state transition, memory footprint, and tool execution is dynamically hashed. Proving the integrity of autonomous actions is now a mathematical guarantee, not a logging exercise.
    ::::

    ::::u-page-card
    ---
    spotlight: true
    class: col-span-2
    ---
      :::::tabs
        ::::::tabs-item{.mt-5 icon="i-lucide-shield-check" label="Security Invariants"}
          :::::::div{.flex.flex-col.gap-4}
            ::::::::note{.my-0}
            **INV-03**: SharedStore Isolation enforced. Cross-agent leak prevented.
            ::::::::

            ::::::::tip{.my-0}
            **INV-15**: Execution Proof verified. Replay sequence matches Live exactly.
            ::::::::

            ::::::::warning{.my-0}
            **INV-09**: Zombie Prevention active. Terminated agents cannot mutate state.
            ::::::::

            ::::::::caution{.my-0}
            **INVARIANT_BREACH**: Kernel Panic initiated. Unauthorized tool call blocked.
            ::::::::
          :::::::
        ::::::

        ::::::tabs-item
        ---
        class: mt-5 mb-2 text-xs overflow-x-auto
        icon: i-lucide-code
        label: Logic Check
        ---
        ```typescript
        // Strict Invariant Checking
        kernel.on('INVARIANT_CHECK', (state) => {
          if (!proofUtility.verifyIntegrity(state)) {
            throw new KernelPanic("State corruption detected");
          }
        });
        ```
        ::::::
      :::::

    #title
    The 15 Core Invariants

    #description
    OmniPaw treats agent execution as a stateful operating system. 15 explicitly checked core invariants ensure total execution integrity. Any breach triggers a safe Kernel Panic, escaping unpredictable consequences.
    ::::

    ::::u-page-card
    ---
    class: col-span-2 md:col-span-1
    ---
    :::div{.flex.items-center.justify-center.h-48}
    :u-icon{name="i-lucide-container" class="w-24 h-24 text-brand-blue"}
    :::

    #title
    Docker-Isolation Tool Sandboxing

    #description
    Run every `bash`, `python`, or `filesystem` tool inside ephemeral Docker containers. Absolute host-level isolation for truly autonomous tool execution.
    ::::


    ::::u-page-card
    ---
    spotlight: true
    class: col-span-2 md:col-span-1 min-h-[450px]
    ---
      ::::::OmniTelemetryPreview
      ::::::

    #title
    Built-in [OpenTelemetry]{.text-primary}

    #description
    Native export for traces and metrics. Plug OmniPaw directly into Jaeger, Zipkin, or Prometheus for enterprise-grade observability.
    ::::

    ::::u-page-card
    ---
    spotlight: true
    class: col-span-2
    ---
      ::::::OmniSwarmPreview
      ::::::

    #title
    Swarm Orchestration

    #description
    Advanced agent-to-agent messaging, leader election, and consensus strategies (MAP_REDUCE, PIPELINE, CONSENSUS) built directly into the kernel bus.
    ::::

    ::::u-page-card
    ---
    spotlight: true
    class: col-span-2
    ---
      :::::OmniConfigPreview
      :::::

    #title
    Fully Customizable OS Configuration

    #description
    Update memory quotas, rate limits, and permission models globally. Tune your autonomous substrate to match your security and cost requirements.
    ::::

    ::::u-page-card
    ---
    spotlight: true
    class: col-span-2 lg:col-span-1
    ---
      :::::div{.flex-1.flex.flex-col.items-center.justify-center.py-8.text-center}
        ::::::div{.flex.flex-col.gap-3.w-full.max-w-xs}
          :::::::u-button
          ---
          block: true
          color: brand-cyan
          size: lg
          to: /en/getting-started/quickstart
          trailing-icon: i-lucide-arrow-right
          ---
          Build Your Kernel
          :::::::

          :::::::u-button
          ---
          block: true
          color: neutral
          icon: simple-icons-github
          size: lg
          target: _blank
          to: https://github.com/OmniPaw/OmniPaw
          variant: outline
          ---
          View on GitHub
          :::::::
        ::::::
      :::::

    #title
    [Ready]{.text-primary} to build?

    #description
    Explore the most secure, deterministic, and replayable execution layer for AI agents ever built.
    ::::

:::
::
