<script setup lang="ts">
const configGroups = [
  {
    name: 'Kernel Governance',
    icon: 'i-lucide-shield-check',
    params: [
      { name: 'invariants.strict', value: 'true', type: 'bool' },
      { name: 'kernel.panic_mode', value: 'HALT', type: 'enum' },
      { name: 'replay.verify_hashes', value: 'true', type: 'bool' },
    ]
  },
  {
    name: 'Resource Isolation',
    icon: 'i-lucide-box',
    params: [
      { name: 'sandbox.provider', value: 'DOCKER', type: 'enum' },
      { name: 'memory.max_heap', value: '512MB', type: 'size' },
      { name: 'cpu.limit_per_agent', value: '0.5', type: 'float' },
    ]
  },
  {
    name: 'Swarm Networking',
    icon: 'i-lucide-share-2',
    params: [
      { name: 'bus.strategy', value: 'CONSENSUS', type: 'enum' },
      { name: 'mesh.heartbeat_ms', value: '100', type: 'int' },
      { name: 'p2p.encryption', value: 'AES-256-GCM', type: 'str' },
    ]
  }
]
</script>

<template>
  <div class="omni-config-preview">
    <div class="omni-titlebar">
      <div class="omni-dots">
        <span class="omni-dot dot-red" />
        <span class="omni-dot dot-yellow" />
        <span class="omni-dot dot-green" />
      </div>
      <span class="omni-title">OmniPaw — OS Configuration</span>
      <span class="omni-badge-sm">CONFIG_ACTIVE</span>
    </div>

    <div class="omni-body">
      <div class="omni-sidebar">
        <div 
          v-for="(group, i) in configGroups" 
          :key="group.name"
          class="omni-nav-item"
          :class="{ active: i === 0 }"
        >
          <UIcon :name="group.icon" class="omni-nav-icon" />
          <span>{{ group.name }}</span>
        </div>
      </div>

      <div class="omni-content">
        <div class="omni-editor-header">
          <span class="omni-file-path">kernel.config.yaml</span>
        </div>
        
        <div class="omni-editor-body">
          <div v-for="(group, gi) in configGroups" :key="`g-${gi}`" class="omni-editor-group">
            <div class="omni-comment"># {{ group.name }} settings</div>
            <div v-for="(param, pi) in group.params" :key="`p-${pi}`" class="omni-param-line">
              <span class="omni-key">{{ param.name }}:</span>
              <span :class="['omni-val', `val-${param.type}`]">{{ param.value }}</span>
            </div>
          </div>
          
          <div class="omni-cursor-line">
            <span class="omni-cursor" />
          </div>
        </div>
      </div>
    </div>
    
    <div class="omni-status-bar">
      <span>UTF-8</span>
      <span>Line 12, Col 21</span>
      <span>Spaces: 2</span>
      <span class="omni-sync-status">✔ Synced with Kernel</span>
    </div>
  </div>
</template>

<style scoped>
.omni-config-preview {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: #080c14;
  border: 1px solid #1e2d45;
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
  box-shadow: 0 0 48px rgba(0, 229, 255, 0.05), 0 0 0 1px rgba(0, 229, 255, 0.04);
}

:root:not(.dark) .omni-config-preview {
  background: #f8fafc;
  border-color: #cbd5e1;
  box-shadow: 0 2px 32px rgba(59, 130, 246, 0.08);
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
}

.omni-body {
  display: flex;
  min-height: 280px;
}

.omni-sidebar {
  width: 180px;
  background: #0a0f18;
  border-right: 1px solid #1e2d45;
  padding: 12px 0;
}

:root:not(.dark) .omni-sidebar {
  background: #f1f5f9;
  border-right-color: #e2e8f0;
}

.omni-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  font-size: 11px;
  color: #64748b;
  cursor: default;
}

.omni-nav-item.active {
  background: rgba(0, 229, 255, 0.08);
  color: #00E5FF;
  border-right: 2px solid #00E5FF;
}

:root:not(.dark) .omni-nav-item.active {
  background: rgba(59, 130, 246, 0.08);
  color: #3B82F6;
  border-right-color: #3B82F6;
}

.omni-nav-icon {
  font-size: 14px;
}

.omni-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.omni-editor-header {
  padding: 8px 16px;
  background: #0d1520;
  border-bottom: 1px solid #1e2d45;
}

:root:not(.dark) .omni-editor-header {
  background: #e2e8f0;
  border-bottom-color: #cbd5e1;
}

.omni-file-path {
  font-size: 10px;
  color: #475569;
}

.omni-editor-body {
  padding: 16px;
  flex: 1;
  font-size: 12px;
  line-height: 1.6;
}

.omni-editor-group {
  margin-bottom: 16px;
}

.omni-comment { color: #475569; font-style: italic; }
.omni-param-line { padding-left: 12px; }
.omni-key { color: #94a3b8; margin-right: 8px; }
.omni-val { font-weight: bold; }

.val-bool { color: #f59e0b; }
.val-enum { color: #3B82F6; }
.val-size { color: #22c55e; }
.val-float { color: #f43f5e; }
.val-int { color: #00E5FF; }
.val-str { color: #10b981; }

.omni-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: #00E5FF;
  animation: blink 1s step-end infinite;
}

@keyframes blink { 50% { opacity: 0; } }

.omni-status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  background: #0d1520;
  border-top: 1px solid #1e2d45;
  font-size: 9px;
  color: #475569;
}

:root:not(.dark) .omni-status-bar {
  background: #e2e8f0;
  border-top-color: #cbd5e1;
}

.omni-sync-status {
  flex: 1;
  text-align: right;
  color: #22c55e;
}

@media (max-width: 640px) {
  .omni-sidebar { display: none; }
}
</style>
