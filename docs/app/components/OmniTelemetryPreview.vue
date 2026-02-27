<script setup lang="ts">
const metrics = [
    { name: 'kernel.tick.latency', value: '12.4 ms', trend: '↓', good: true },
    { name: 'agent.memory.delta', value: '3.2 KB', trend: '→', good: true },
    { name: 'tool.execution.status', value: '100% OK', trend: '↑', good: true },
    { name: 'invariant.breach.count', value: '0', trend: '→', good: true },
]

const spans = [
    { name: 'kernel.scheduler.runAgentLoop', start: 0, width: 100, depth: 0, color: '#00E5FF', dur: '248 ms' },
    { name: 'tickEngine.runTick', start: 2, width: 60, depth: 1, color: '#3B82F6', dur: '148 ms' },
    { name: 'toolGate.execute: bash', start: 18, width: 35, depth: 2, color: '#f59e0b', dur: '87 ms' },
    { name: 'dockerSandbox.run', start: 20, width: 30, depth: 3, color: '#f59e0b', dur: '73 ms' },
    { name: 'invariantChecker.check', start: 62, width: 12, depth: 2, color: '#22c55e', dur: '29 ms' },
    { name: 'tickEngine.runTick', start: 66, width: 28, depth: 1, color: '#3B82F6', dur: '70 ms' },
    { name: 'toolGate.execute: fs.read', start: 68, width: 18, depth: 2, color: '#f59e0b', dur: '44 ms' },
    { name: 'invariantChecker.check', start: 92, width: 6, depth: 2, color: '#22c55e', dur: '14 ms' },
]
</script>

<template>
    <div class="omni-otel-preview">
        <!-- Title bar -->
        <div class="omni-titlebar">
            <div class="omni-dots">
                <span class="omni-dot dot-red" />
                <span class="omni-dot dot-yellow" />
                <span class="omni-dot dot-green" />
            </div>
            <span class="omni-title">OmniPaw — OpenTelemetry Trace</span>
            <span class="omni-export-badge">OTLP LIVE</span>
        </div>

        <!-- Metrics row -->
        <div class="omni-metrics-row">
            <div v-for="m in metrics" :key="m.name" class="omni-metric-chip">
                <span class="omni-metric-name">{{ m.name }}</span>
                <span :class="['omni-metric-val', m.good ? 'val-good' : 'val-bad']">
                    {{ m.trend }} {{ m.value }}
                </span>
            </div>
        </div>

        <!-- Trace waterfall -->
        <div class="omni-waterfall">
            <div class="omni-waterfall-header">
                <span>Span</span>
                <span>Timeline (248 ms total)</span>
                <span>Duration</span>
            </div>

            <div v-for="(span, i) in spans" :key="i" class="omni-span-row" :style="{ animationDelay: `${i * 0.1}s` }">
                <!-- Span name -->
                <div class="omni-span-name" :style="{ paddingLeft: `${span.depth * 14}px` }">
                    <span class="omni-span-dot" :style="{ background: span.color }" />
                    <span class="omni-span-label" :style="{ color: span.color }">{{ span.name }}</span>
                </div>

                <!-- Waterfall bar -->
                <div class="omni-span-track">
                    <div class="omni-span-bar" :style="{
                        left: `${span.start}%`,
                        width: `${span.width}%`,
                        background: `${span.color}`,
                        opacity: `${0.85 - span.depth * 0.12}`
                    }" />
                </div>

                <!-- Duration -->
                <div class="omni-span-dur">{{ span.dur }}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="omni-footer">
            <span class="omni-footer-label">Exporting to</span>
            <span class="omni-footer-dest">localhost:4317 (OTLP/gRPC)</span>
            <span class="omni-footer-sep">·</span>
            <span class="omni-footer-dest">Jaeger UI</span>
            <span class="omni-footer-sep">·</span>
            <span class="omni-footer-dest">Prometheus :9090</span>
        </div>
    </div>
</template>

<style scoped>
.omni-otel-preview {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: #080c14;
    border: 1px solid #1e2d45;
    border-radius: 12px;
    overflow: hidden;
    width: 100%;
    box-shadow: 0 0 48px rgba(0, 229, 255, 0.06), 0 0 0 1px rgba(59, 130, 246, 0.06);
}

:root:not(.dark) .omni-otel-preview {
    background: #f8fafc;
    border-color: #cbd5e1;
    box-shadow: 0 2px 32px rgba(59, 130, 246, 0.08);
}

/* Title bar */
.omni-titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: #0d1520;
    border-bottom: 1px solid #1e2d45;
}

:root:not(.dark) .omni-titlebar {
    background: #e2e8f0;
    border-bottom-color: #cbd5e1;
}

.omni-dots {
    display: flex;
    gap: 6px;
}

.omni-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: block;
}

.dot-red {
    background: #ef4444;
}

.dot-yellow {
    background: #f59e0b;
}

.dot-green {
    background: #22c55e;
}

.omni-title {
    font-size: 11px;
    color: #64748b;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    flex: 1;
}

.omni-export-badge {
    font-size: 9px;
    background: rgba(59, 130, 246, 0.12);
    color: #3B82F6;
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    padding: 1px 7px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.55;
    }
}

/* Metrics row */
.omni-metrics-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid #1e2d45;
}

:root:not(.dark) .omni-metrics-row {
    border-bottom-color: #e2e8f0;
}

.omni-metric-chip {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(59, 130, 246, 0.14);
    border-radius: 6px;
    padding: 5px 10px;
    gap: 2px;
    flex: 1;
    min-width: 140px;
}

:root:not(.dark) .omni-metric-chip {
    background: #fff;
    border-color: #e2e8f0;
}

.omni-metric-name {
    font-size: 8.5px;
    color: #475569;
    letter-spacing: 0.04em;
}

.omni-metric-val {
    font-size: 11px;
    font-weight: bold;
}

.val-good {
    color: #22c55e;
}

.val-bad {
    color: #ef4444;
}

/* Waterfall */
.omni-waterfall {
    padding: 8px 16px 12px;
}

.omni-waterfall-header {
    display: grid;
    grid-template-columns: 280px 1fr 60px;
    font-size: 9px;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 0 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    margin-bottom: 6px;
}

:root:not(.dark) .omni-waterfall-header {
    border-bottom-color: #e2e8f0;
}

.omni-span-row {
    display: grid;
    grid-template-columns: 280px 1fr 60px;
    align-items: center;
    padding: 3px 0;
    opacity: 0;
    animation: fadeInLine 0.25s ease forwards;
}

@keyframes fadeInLine {
    from {
        opacity: 0;
        transform: translateX(-4px);
    }

    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.omni-span-name {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
}

.omni-span-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.omni-span-label {
    font-size: 9.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.omni-span-track {
    position: relative;
    height: 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 2px;
    margin: 0 8px;
}

:root:not(.dark) .omni-span-track {
    background: #e2e8f0;
}

.omni-span-bar {
    position: absolute;
    top: 2px;
    height: 10px;
    border-radius: 2px;
    transition: width 0.6s ease;
}

.omni-span-dur {
    font-size: 9px;
    color: #64748b;
    text-align: right;
}

/* Footer */
.omni-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px;
    border-top: 1px solid #1e2d45;
    background: rgba(59, 130, 246, 0.03);
    font-size: 9.5px;
    flex-wrap: wrap;
}

:root:not(.dark) .omni-footer {
    border-top-color: #e2e8f0;
    background: rgba(59, 130, 246, 0.03);
}

.omni-footer-label {
    color: #475569;
}

.omni-footer-dest {
    color: #3B82F6;
}

.omni-footer-sep {
    color: #334155;
}
</style>
