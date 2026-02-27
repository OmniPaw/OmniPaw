<script setup lang="ts">
const agents = [
  { id: 'coordinator-1', x: 260, y: 80,  status: 'ACTIVE', role: 'Coordinator', color: '#00E5FF' },
  { id: 'explorer-1',   x: 100, y: 210, status: 'ACTIVE', role: 'Explorer',    color: '#3B82F6' },
  { id: 'planner-2',    x: 420, y: 210, status: 'ACTIVE', role: 'Planner',     color: '#3B82F6' },
  { id: 'executor-3',   x: 100, y: 340, status: 'ACTIVE', role: 'Executor',    color: '#22c55e' },
  { id: 'verifier-4',   x: 420, y: 340, status: 'ACTIVE', role: 'Verifier',    color: '#22c55e' },
]

const edges = [
  { x1: 260, y1: 80,  x2: 100, y2: 210, label: 'MAP',      delay: '0s' },
  { x1: 260, y1: 80,  x2: 420, y2: 210, label: 'REDUCE',   delay: '0.4s' },
  { x1: 100, y1: 210, x2: 100, y2: 340, label: 'PIPELINE', delay: '0.8s' },
  { x1: 420, y1: 210, x2: 420, y2: 340, label: 'PIPELINE', delay: '1.2s' },
  { x1: 100, y1: 340, x2: 420, y2: 340, label: 'CONSENSUS',delay: '1.6s' },
]

const messages = [
  { from: 'coordinator-1', to: 'explorer-1',  strategy: 'MAP',      time: '09:12:00.210' },
  { from: 'coordinator-1', to: 'planner-2',   strategy: 'MAP',      time: '09:12:00.212' },
  { from: 'explorer-1',    to: 'executor-3',  strategy: 'PIPELINE',  time: '09:12:00.644' },
  { from: 'planner-2',     to: 'verifier-4',  strategy: 'PIPELINE',  time: '09:12:00.645' },
  { from: 'executor-3',    to: 'verifier-4',  strategy: 'CONSENSUS', time: '09:12:01.102' },
]
</script>

<template>
  <div class="omni-swarm-preview">
    <div class="omni-titlebar">
      <div class="omni-dots">
        <span class="omni-dot dot-red" />
        <span class="omni-dot dot-yellow" />
        <span class="omni-dot dot-green" />
      </div>
      <span class="omni-title">OmniSwarm — Agent Network</span>
      <span class="omni-badge-sm">{{ agents.length }} agents</span>
    </div>

    <div class="omni-body">
      <!-- Graph -->
      <div class="omni-graph-panel">
        <svg viewBox="0 0 520 430" class="omni-svg">
          <!-- Grid lines -->
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,229,255,0.05)" stroke-width="0.5"/>
            </pattern>
          </defs>
          <rect width="520" height="430" fill="url(#grid)" />

          <!-- Edges -->
          <g v-for="(edge, i) in edges" :key="`e-${i}`">
            <line
              :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
              stroke="rgba(59,130,246,0.25)" stroke-width="1.5" stroke-dasharray="6 4"
            />
            <!-- Animated packet dot -->
            <circle r="4" fill="#00E5FF" opacity="0.9">
              <animateMotion
                :dur="`${2.5 + i * 0.3}s`"
                :begin="edge.delay"
                repeatCount="indefinite"
                :path="`M${edge.x1},${edge.y1} L${edge.x2},${edge.y2}`"
              />
            </circle>
            <!-- Edge label -->
            <text
              :x="(edge.x1 + edge.x2) / 2 + 8"
              :y="(edge.y1 + edge.y2) / 2 - 6"
              font-size="8"
              fill="#3B82F6"
              font-family="monospace"
              opacity="0.7"
            >{{ edge.label }}</text>
          </g>

          <!-- Agent nodes -->
          <g v-for="agent in agents" :key="agent.id">
            <!-- Outer pulse ring -->
            <circle
              :cx="agent.x" :cy="agent.y" r="28"
              :fill="`${agent.color}10`"
              :stroke="agent.color"
              stroke-width="0.8"
              opacity="0.5"
            >
              <animate attributeName="r" values="26;32;26" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <!-- Node circle -->
            <circle :cx="agent.x" :cy="agent.y" r="22" :fill="`${agent.color}18`" :stroke="agent.color" stroke-width="1.5"/>
            <!-- Role label -->
            <text :x="agent.x" :y="agent.y - 4" text-anchor="middle" font-size="7.5" font-family="monospace" font-weight="bold" :fill="agent.color">{{ agent.role }}</text>
            <text :x="agent.x" :y="agent.y + 7" text-anchor="middle" font-size="6.5" font-family="monospace" fill="rgba(148,163,184,0.8)">{{ agent.id }}</text>
            <!-- Status dot -->
            <circle :cx="agent.x + 16" :cy="agent.y - 16" r="4" fill="#22c55e">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </g>
        </svg>
      </div>

      <!-- Message feed -->
      <div class="omni-msg-feed">
        <div class="omni-feed-title">Message Bus</div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="omni-feed-item"
          :style="{ animationDelay: `${i * 0.2 + 0.5}s` }"
        >
          <span class="omni-feed-time">{{ msg.time }}</span>
          <span class="omni-feed-from">{{ msg.from }}</span>
          <span class="omni-feed-arrow">→</span>
          <span class="omni-feed-to">{{ msg.to }}</span>
          <span class="omni-feed-strategy">{{ msg.strategy }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.omni-swarm-preview {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: #080c14;
  border: 1px solid #1e2d45;
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
  box-shadow: 0 0 48px rgba(59, 130, 246, 0.08), 0 0 0 1px rgba(0, 229, 255, 0.04);
}

:root:not(.dark) .omni-swarm-preview {
  background: #f1f5fa;
  border-color: #cbd5e1;
}

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
.omni-dot { width: 12px; height: 12px; border-radius: 50%; }
.dot-red    { background: #ef4444; }
.dot-yellow { background: #f59e0b; }
.dot-green  { background: #22c55e; }

.omni-title {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex: 1;
}

.omni-badge-sm {
  font-size: 9px;
  background: rgba(0,229,255,0.1);
  color: #00E5FF;
  border: 1px solid rgba(0,229,255,0.25);
  border-radius: 4px;
  padding: 1px 7px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.omni-body {
  display: flex;
  flex-direction: row;
}

.omni-graph-panel {
  flex: 1;
  padding: 8px;
}

.omni-svg { width: 100%; height: auto; display: block; }

/* Message feed */
.omni-msg-feed {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid #1e2d45;
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 6px;
}

:root:not(.dark) .omni-msg-feed { border-left-color: #e2e8f0; }

.omni-feed-title {
  font-size: 9px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.omni-feed-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 9px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(59,130,246,0.12);
  border-radius: 6px;
  padding: 5px 8px;
  opacity: 0;
  animation: fadeInLine 0.3s ease forwards;
}

@keyframes fadeInLine {
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
}

.omni-feed-time  { color: #475569; font-size: 8.5px; }
.omni-feed-from  { color: #00E5FF; }
.omni-feed-arrow { color: #64748b; }
.omni-feed-to    { color: #3B82F6; }
.omni-feed-strategy {
  color: #f59e0b;
  font-weight: bold;
  font-size: 9px;
  letter-spacing: 0.06em;
  margin-top: 2px;
}

@media (max-width: 640px) {
  .omni-body { flex-direction: column; }
  .omni-msg-feed { width: 100%; border-left: none; border-top: 1px solid #1e2d45; }
}
</style>
