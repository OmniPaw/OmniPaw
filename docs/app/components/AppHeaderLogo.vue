<script setup lang="ts">
const props = defineProps<{
  white?: boolean
}>()

const colorMode = useColorMode()
const logoSrc = computed(() =>
  colorMode.value === 'light' ? '/omnipaw_logo_dark.png' : '/omnipaw_logo_light.png'
)
const isBlinking = ref(false)
const isHovering = ref(false)
const isPressed = ref(false)
const isTouchDevice = ref(false)
const particles = ref<{ id: number; x: number; y: number; angle: number; color: string }[]>([])
const isWiggling = ref(false)

let blinkCleanup: (() => void) | undefined
let particleIdCounter = 0

const PARTICLE_COLORS = ['#00E5FF', '#3B82F6', '#00E5FF', '#3B82F6', '#FFFFFF']

// ── Computed ──────────────────────────────────────────────────────────────
const textColor = computed(() =>
  props.white ? 'text-white' : 'text-black dark:text-white'
)

const { contextMenuItems } = useLogoAssets()

// ── Blink loop ────────────────────────────────────────────────────────────
function setupBlinking(): () => void {
  const delay = Math.random() * 4000 + 2500
  const outer = setTimeout(() => {
    isBlinking.value = true
    const inner = setTimeout(() => {
      isBlinking.value = false
      blinkCleanup = setupBlinking()
    }, 160)
    blinkCleanup = () => clearTimeout(inner)
  }, delay)
  return () => clearTimeout(outer)
}

// ── Idle wiggle ───────────────────────────────────────────────────────────
function setupWiggle() {
  const delay = Math.random() * 8000 + 5000
  setTimeout(() => {
    if (!isHovering.value) {
      isWiggling.value = true
      setTimeout(() => {
        isWiggling.value = false
        setupWiggle()
      }, 600)
    } else {
      setupWiggle()
    }
  }, delay)
}

// ── Particle burst on click ───────────────────────────────────────────────
function handleClick(e: MouseEvent) {
  const el = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const cx = e.clientX - el.left
  const cy = e.clientY - el.top
  const count = 10
  for (let i = 0; i < count; i++) {
    const id = particleIdCounter++
    const angle = (360 / count) * i + Math.random() * 20 - 10
    const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
    particles.value.push({ id, x: cx, y: cy, angle, color })
    setTimeout(() => {
      particles.value = particles.value.filter(p => p.id !== id)
    }, 700)
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  blinkCleanup = setupBlinking()
  setupWiggle()
  isTouchDevice.value = 'ontouchstart' in window
})

onBeforeUnmount(() => blinkCleanup?.())
</script>

<template>
  <UContextMenu :items="contextMenuItems">
    <button
      class="logo-root"
      :class="[
        textColor,
        { 'is-hovering': isHovering, 'is-pressed': isPressed }
      ]"
      @mouseenter="isHovering = true"
      @mouseleave="isHovering = false; isPressed = false"
      @mousedown="isPressed = true"
      @mouseup="isPressed = false"
      @click="handleClick"
    >
      <!-- Particle burst layer -->
      <span class="particle-container" aria-hidden="true">
        <span
          v-for="p in particles"
          :key="p.id"
          class="particle"
          :style="{
            left: `${p.x}px`,
            top: `${p.y}px`,
            '--angle': `${p.angle}deg`,
            '--color': p.color,
          }"
        />
      </span>

      <!-- Hover shimmer background -->
      <span class="logo-bg" aria-hidden="true" />

      <!-- Paw image -->
      <span
        class="logo-img-wrap"
        :class="{ blink: isBlinking, wiggle: isWiggling }"
      >
        <img
          :src="logoSrc"
          alt="OmniPaw logo"
          class="logo-img w-16 h-16"
          draggable="false"
          
        />
        <span class="paw-halo" aria-hidden="true" />
      </span>

      <!-- Wordmark -->
      <span class="logo-wordmark">
        <text 
        x="38"
        y="24"
        fill="currentColor"
        style="font-family: sans-serif; font-weight: 700; font-size: 24px; letter-spacing: -1px;"
      >Omni</text>
        <span class="logo-text logo-text--accent" :class="{ 'logo-text--white': white }">Paw🐾</span>
        <span class="logo-dot" aria-hidden="true" />
      </span>
    </button>
  </UContextMenu>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');

/* ── Root ──────────────────────────────────────────────────────────────── */
.logo-root {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px 5px 5px;
  border: none;
  height: 34px;
  background: transparent;
  cursor: pointer;
  border-radius: 18px;
  overflow: hidden;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.25s ease;
}

.logo-root.is-pressed {
  transform: scale(0.93);
}

.logo-root:focus-visible {
  outline: 2.5px solid currentColor;
  outline-offset: 3px;
}

/* ── Hover shimmer bg ────────────────────────────────────────────────────── */
.logo-bg {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(0, 229, 255, 0.08) 0%,
    rgba(59, 130, 246, 0.1) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.logo-root:hover .logo-bg {
  opacity: 1;
}

/* ── Particles ───────────────────────────────────────────────────────────── */
.particle-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  border-radius: inherit;
}

.particle {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color);
  transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0px) scale(1);
  animation: particle-fly 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  box-shadow: 0 0 4px var(--color);
}

@keyframes particle-fly {
  0% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0px) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-52px) scale(0);
    opacity: 0;
  }
}

/* ── Paw image ───────────────────────────────────────────────────────────── */
.logo-img-wrap {
  position: relative;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.logo-root:hover .logo-img-wrap {
  transform: rotate(-10deg) scale(1.12);
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  transition: opacity 0.07s ease;
  position: relative;
  z-index: 1;
}

/* Blink: fast opacity dip */
.blink .logo-img {
  opacity: 0.1;
}

/* Idle wiggle */
.wiggle .logo-img-wrap,
.logo-img-wrap.wiggle {
  animation: wiggle-idle 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes wiggle-idle {
  0%   { transform: rotate(0deg) scale(1); }
  20%  { transform: rotate(-7deg) scale(1.06); }
  40%  { transform: rotate(7deg) scale(1.06); }
  60%  { transform: rotate(-4deg) scale(1.03); }
  80%  { transform: rotate(4deg) scale(1.03); }
  100% { transform: rotate(0deg) scale(1); }
}

/* Warm glow halo on hover */
.paw-halo {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(0, 229, 255, 0.45) 0%,
    rgba(59, 130, 246, 0.2) 55%,
    transparent 75%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 0;
}

.logo-root:hover .paw-halo {
  opacity: 1;
}

/* ── Wordmark ────────────────────────────────────────────────────────────── */
.logo-wordmark {
  display: inline-flex;
  align-items: baseline;
  gap: 0;
  position: relative;
}

.logo-text {
  font-family: 'Nunito', 'Varela Round', sans-serif;
  font-weight: 900;
  font-size: 1.38rem;
  letter-spacing: -0.04em;
  line-height: 1;
  background: linear-gradient(145deg, #1c1c1c 0%, #4a4a4a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: filter 0.25s ease;
}

.logo-text--accent {
  background: linear-gradient(145deg, #00E5FF 0%, #3B82F6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* White override — flat bright white, no gradient shift needed */
.logo-text--white {
  background: linear-gradient(145deg, #fff 0%, rgba(255, 255, 255, 0.82) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* The accent "Paw" stays warm even on white backgrounds */
.logo-text--white.logo-text--accent {
  background: linear-gradient(145deg, #00E5FF 0%, #3B82F6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Dark mode auto-swap for "Omni" */
@media (prefers-color-scheme: dark) {
  .logo-text:not(.logo-text--accent):not(.logo-text--white) {
    background: linear-gradient(145deg, #fff 0%, rgba(255, 255, 255, 0.72) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

/* Tiny decorative dot after "Paw" */
.logo-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00E5FF, #3B82F6);
  margin-left: 3px;
  margin-bottom: 2px;
  align-self: flex-end;
  opacity: 0;
  transform: scale(0);
  transition:
    opacity 0.25s ease 0.05s,
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s;
}

.logo-root:hover .logo-dot {
  opacity: 1;
  transform: scale(1);
}

/* Hover brightens both text spans */
.logo-root:hover .logo-text {
  filter: brightness(1.1);
}
</style>