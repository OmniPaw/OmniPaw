<script setup lang="ts">
const logs = [
  { type: 'info',    text: 'OmniKernel v1.0.0 booting...', time: '09:12:00.001' },
  { type: 'success', text: '✔ TickEngine initialized', time: '09:12:00.012' },
  { type: 'success', text: '✔ ToolGate: DockerSandbox ready', time: '09:12:00.043' },
  { type: 'tick',    text: 'TICK #001 | agent: explorer-1 | hash: 0xAF3E9B2C', time: '09:12:00.121' },
  { type: 'inv',     text: 'INV-01 PASSED  Instruction integrity OK', time: '09:12:00.205' },
  { type: 'inv',     text: 'INV-03 PASSED  SharedStore isolation OK', time: '09:12:00.207' },
  { type: 'tool',    text: 'TOOL  host.system.bash   sandbox: docker  exit: 0', time: '09:12:00.891' },
  { type: 'tick',    text: 'TICK #002 | agent: explorer-1 | hash: 0xC7D412FA', time: '09:12:01.003' },
  { type: 'inv',     text: 'INV-07 PASSED  Tick atomicity confirmed', time: '09:12:01.018' },
  { type: 'inv',     text: 'INV-09 PASSED  Zombie prevention active', time: '09:12:01.020' },
  { type: 'tool',    text: 'TOOL  host.fs.read        sandbox: chroot  exit: 0', time: '09:12:01.344' },
  { type: 'tick',    text: 'TICK #003 | agent: explorer-1 | hash: 0x1BF80A3D', time: '09:12:01.900' },
  { type: 'success', text: '✔ State snapshot written to WAL', time: '09:12:01.944' },
  { type: 'inv',     text: 'INV-15 PASSED  Replay parity verified', time: '09:12:01.950' },
]

const colorMap: Record<string, string> = {
  info:    'text-slate-400',
  success: 'text-emerald-400',
  tick:    'text-[#00E5FF]',
  inv:     'text-[#3B82F6]',
  tool:    'text-amber-400',
}
</script>

<template>
  <div class="omni-trace-preview">
    <!-- Title bar -->
    <div class="omni-titlebar">
      <div class="omni-dots">
        <span class="omni-dot dot-red" />
        <span class="omni-dot dot-yellow" />
        <span class="omni-dot dot-green" />
      </div>
      <span class="omni-title">OmniKernel — Deterministic Trace</span>
    </div>

    <!-- Log body -->
    <div class="omni-log-body">
      <div
        v-for="(log, i) in logs"
        :key="i"
        class="omni-log-line"
        :style="{ animationDelay: `${i * 0.12}s` }"
      >
        <span class="omni-time">{{ log.time }}</span>
        <span :class="['omni-msg', colorMap[log.type]]">{{ log.text }}</span>
      </div>

      <!-- Blinking cursor -->
      <div class="omni-log-line">
        <span class="omni-time">09:12:02.001</span>
        <span class="text-[#00E5FF]">█<span class="omni-cursor" /></span>
      </div>
    </div>

    <!-- Footer hash bar -->
    <div class="omni-hashbar">
      <span class="omni-hash-label">CHAIN HEAD</span>
      <span class="omni-hash-val">0x1BF80A3D → verified ✔</span>
      <span class="omni-badge">LIVE</span>
    </div>
  </div>
</template>

<style scoped>
.omni-trace-preview {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: #080c14;
  border: 1px solid #1e2d45;
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
  box-shadow: 0 0 48px rgba(0, 229, 255, 0.08), 0 0 0 1px rgba(0, 229, 255, 0.06);
}

:root:not(.dark) .omni-trace-preview {
  background: #f1f5fa;
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

.omni-dots { display: flex; gap: 6px; }
.omni-dot { width: 12px; height: 12px; border-radius: 50%; display: block; }
.dot-red    { background: #ef4444; }
.dot-yellow { background: #f59e0b; }
.dot-green  { background: #22c55e; }

.omni-title {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Log body */
.omni-log-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 280px;
  overflow: hidden;
}

.omni-log-line {
  display: flex;
  gap: 12px;
  font-size: 11.5px;
  line-height: 1.6;
  opacity: 0;
  animation: fadeInLine 0.3s ease forwards;
}

@keyframes fadeInLine {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.omni-time {
  color: #334155;
  flex-shrink: 0;
  font-size: 10px;
  padding-top: 1px;
}

:root:not(.dark) .omni-time { color: #94a3b8; }

.omni-msg { word-break: break-all; }

/* Cursor */
.omni-cursor {
  display: inline-block;
  width: 7px;
  height: 13px;
  background: #00E5FF;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* Hash bar */
.omni-hashbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(0, 229, 255, 0.04);
  border-top: 1px solid #1e2d45;
  font-size: 10.5px;
}

:root:not(.dark) .omni-hashbar {
  background: rgba(59, 130, 246, 0.04);
  border-top-color: #e2e8f0;
}

.omni-hash-label {
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 9px;
}

.omni-hash-val { color: #00E5FF; flex: 1; }

:root:not(.dark) .omni-hash-val { color: #3B82F6; }

.omni-badge {
  background: rgba(0, 229, 255, 0.12);
  color: #00E5FF;
  border: 1px solid rgba(0, 229, 255, 0.3);
  border-radius: 4px;
  padding: 1px 7px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
