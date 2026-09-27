<script setup lang="ts">
import {
  GRID, NODE_HEIGHT, NODE_WIDTH,
  portSlots, slotPosition, slotUsage,
  type BoardNode, type PortSlot
} from '~~/shared/topology/model'
import { CATALOG, findMedium } from '~~/shared/topology/catalog'

const topo = useTopology()
const {
  board, selectedIds, selectedLinkId, linkingFrom, viewport,
  diagnosticsByNode, diagnosticsByLink, itemOf, isSelected
} = topo

const surface = ref<HTMLElement>()

defineExpose({ surface })

/* ------------------------------------------------ Repère et conversion */

/** Coordonnées écran vers coordonnées du plan. */
function toWorld(clientX: number, clientY: number) {
  const rect = surface.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: (clientX - rect.left - viewport.value.x) / viewport.value.scale,
    y: (clientY - rect.top - viewport.value.y) / viewport.value.scale
  }
}

/* --------------------------------------------- Déplacement des nœuds */

interface NodeDrag { startX: number, startY: number, moved: boolean }
let nodeDrag: NodeDrag | null = null

function onNodePointerDown(node: BoardNode, event: PointerEvent) {
  if (event.button !== 0) return
  event.stopPropagation()

  // Shift étend la sélection, sinon on repart de ce seul composant.
  if (!isSelected(node.id)) topo.select(node.id, event.shiftKey)
  else if (event.shiftKey) topo.select(node.id, true)

  if (linkingFrom.value) return

  const world = toWorld(event.clientX, event.clientY)
  nodeDrag = { startX: world.x, startY: world.y, moved: false }

  window.addEventListener('pointermove', onNodeDragMove)
  window.addEventListener('pointerup', onNodeDragEnd, { once: true })
}

function onNodeDragMove(event: PointerEvent) {
  if (!nodeDrag) return
  const world = toWorld(event.clientX, event.clientY)
  const dx = world.x - nodeDrag.startX
  const dy = world.y - nodeDrag.startY
  if (!dx && !dy) return

  // Un seul point d'historique pour tout le geste.
  if (!nodeDrag.moved) {
    topo.checkpoint()
    nodeDrag.moved = true
  }

  topo.nudge(dx, dy, false)
  nodeDrag.startX = world.x
  nodeDrag.startY = world.y
}

function onNodeDragEnd() {
  window.removeEventListener('pointermove', onNodeDragMove)
  nodeDrag = null
}

/* ----------------------------------------------- Panoramique du plan */

interface Pan { originX: number, originY: number, viewX: number, viewY: number }
let pan: Pan | null = null
const panning = ref(false)

const marquee = ref<{ x: number, y: number, w: number, h: number } | null>(null)

/**
 * Clic milieu : panoramique. Clic gauche sur le vide : rectangle de sélection,
 * ou panoramique si l'on maintient Alt.
 */
function onSurfacePointerDown(event: PointerEvent) {
  const middle = event.button === 1
  const emptyLeft = event.button === 0 && event.target === event.currentTarget

  if (!middle && !emptyLeft) return

  if (emptyLeft && !event.altKey) {
    if (!event.shiftKey) topo.clearSelection()

    const world = toWorld(event.clientX, event.clientY)
    marquee.value = { x: world.x, y: world.y, w: 0, h: 0 }
    const additive = event.shiftKey

    const move = (moveEvent: PointerEvent) => {
      if (!marquee.value) return
      const point = toWorld(moveEvent.clientX, moveEvent.clientY)
      marquee.value = { ...marquee.value, w: point.x - marquee.value.x, h: point.y - marquee.value.y }
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      if (marquee.value && (Math.abs(marquee.value.w) > 4 || Math.abs(marquee.value.h) > 4)) {
        topo.selectInRect(marquee.value, additive)
      }
      marquee.value = null
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    event.preventDefault()
    return
  }

  event.preventDefault()
  pan = {
    originX: event.clientX,
    originY: event.clientY,
    viewX: viewport.value.x,
    viewY: viewport.value.y
  }
  panning.value = true

  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanEnd, { once: true })
}

function onPanMove(event: PointerEvent) {
  if (!pan) return
  viewport.value = {
    ...viewport.value,
    x: pan.viewX + (event.clientX - pan.originX),
    y: pan.viewY + (event.clientY - pan.originY)
  }
}

function onPanEnd() {
  window.removeEventListener('pointermove', onPanMove)
  pan = null
  panning.value = false
}

/** Molette : défilement du plan, ou zoom avec Ctrl. */
function onWheel(event: WheelEvent) {
  event.preventDefault()

  if (event.ctrlKey || event.metaKey) {
    const rect = surface.value?.getBoundingClientRect()
    topo.zoomBy(
      event.deltaY < 0 ? 1.12 : 1 / 1.12,
      event.clientX - (rect?.left ?? 0),
      event.clientY - (rect?.top ?? 0)
    )
    return
  }

  topo.panBy(-event.deltaX, -event.deltaY)
}

/* ------------------------------------------------------ Dépôt du dock */

function onDrop(event: DragEvent) {
  event.preventDefault()
  const typeId = event.dataTransfer?.getData('text/tanchi-node')
  if (!typeId) return

  const world = toWorld(event.clientX, event.clientY)
  topo.addNode(typeId, world.x - NODE_WIDTH / 2, world.y - NODE_HEIGHT / 2)
}

/* --------------------------------------------------------- Câblage */

interface Cabling {
  nodeId: string
  portId: string
  connector: string
  x: number
  y: number
}

const cabling = ref<Cabling | null>(null)
const hoverSlot = ref<string | null>(null)

/** Point de départ : on saisit une prise et on tire le câble. */
function onPortPointerDown(node: BoardNode, slot: PortSlot, event: PointerEvent) {
  if (event.button !== 0) return
  event.stopPropagation()
  event.preventDefault()

  const world = toWorld(event.clientX, event.clientY)
  cabling.value = {
    nodeId: node.id,
    portId: slot.id,
    connector: slot.connector,
    x: world.x,
    y: world.y
  }

  window.addEventListener('pointermove', onCablingMove)
  window.addEventListener('pointerup', onCablingEnd, { once: true })
}

function onCablingMove(event: PointerEvent) {
  if (!cabling.value) return
  const world = toWorld(event.clientX, event.clientY)
  cabling.value = { ...cabling.value, x: world.x, y: world.y }
}

/** Lâcher : si l'on est sur une prise, le câble se pose. */
function onCablingEnd(event: PointerEvent) {
  window.removeEventListener('pointermove', onCablingMove)

  const source = cabling.value
  cabling.value = null
  hoverSlot.value = null
  if (!source) return

  const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
  const target = element?.closest('[data-port]') as HTMLElement | null
  if (!target) return

  const nodeId = target.dataset.node
  const portId = target.dataset.portId
  if (!nodeId || !portId) return

  topo.connect(source.nodeId, source.portId, nodeId, portId)
}

/** Câble en cours de pose, tiré depuis la prise vers le curseur. */
const cablingPath = computed(() => {
  const source = cabling.value
  if (!source) return ''

  const node = nodeById.value.get(source.nodeId)
  if (!node) return ''

  const start = slotPosition(node, source.portId)
  const dx = Math.abs(source.x - start.x) * 0.4
  return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${source.x - dx} ${source.y}, ${source.x} ${source.y}`
})

const slotColor: Record<string, string> = {
  data: 'bg-accent',
  power: 'bg-warning-500',
  console: 'bg-info-500'
}

const slotRing: Record<string, string> = {
  data: 'ring-accent/40',
  power: 'ring-warning-500/40',
  console: 'ring-info-500/40'
}

function slotTitle(node: BoardNode, slot: PortSlot): string {
  const used = slotUsage(board.value.links, node.id, slot.id)
  const kind = slot.family === 'power' ? 'Alimentation' : slot.family === 'console' ? 'Console' : 'Données'
  return `${kind} · ${slot.connector.toUpperCase()}${slot.speedGbps ? ` ${slot.speedGbps} Gb/s` : ''}\n${used}/${slot.count} occupé(s)\nTirez vers une autre prise`
}

const slotsOf = (node: BoardNode) => portSlots(node)

/* ------------------------------------------------------------ Liens */

function onNodeClick(node: BoardNode) {
  // Reste utile pour le mode « relier » déclenché au clavier (touche L).
  if (linkingFrom.value) topo.completeLink(node.id)
}

const center = (node: BoardNode) => ({ x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 })
const nodeById = computed(() => new Map(board.value.nodes.map(node => [node.id, node])))

/** Le tracé part de la prise réelle quand la liaison en désigne une. */
function linkPath(link: { from: string, to: string, fromPort?: string, toPort?: string }): string {
  const from = nodeById.value.get(link.from)
  const to = nodeById.value.get(link.to)
  if (!from || !to) return ''

  const a = link.fromPort ? slotPosition(from, link.fromPort) : center(from)
  const b = link.toPort ? slotPosition(to, link.toPort) : center(to)
  const dx = Math.abs(b.x - a.x) * 0.4

  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

function linkColor(linkId: string, medium: string): string {
  const issues = diagnosticsByLink.value.get(linkId) ?? []
  if (issues.some(issue => issue.severity === 'error')) return 'var(--color-error-500)'
  if (issues.some(issue => issue.severity === 'warning')) return 'var(--color-warning-500)'

  const family = findMedium(medium)?.family
  if (family === 'fibre') return 'var(--t-accent)'
  if (family === 'énergie') return 'var(--t-ink-dim)'
  return 'var(--t-line-strong)'
}

function nodeSeverity(id: string): 'error' | 'warning' | 'info' | null {
  const issues = diagnosticsByNode.value.get(id) ?? []
  if (issues.some(issue => issue.severity === 'error')) return 'error'
  if (issues.some(issue => issue.severity === 'warning')) return 'warning'
  if (issues.length) return 'info'
  return null
}

const ringClass: Record<string, string> = {
  error: 'ring-2 ring-error-500',
  warning: 'ring-2 ring-warning-500',
  info: 'ring-1 ring-info-500'
}

/** La trame suit le panoramique et le zoom, ce qui rend le plan sans fin. */
const gridStyle = computed(() => {
  const step = GRID * viewport.value.scale
  return {
    backgroundImage: 'radial-gradient(var(--t-line) 1px, transparent 1px)',
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${viewport.value.x}px ${viewport.value.y}px`
  }
})

const layerStyle = computed(() => ({
  transform: `translate(${viewport.value.x}px, ${viewport.value.y}px) scale(${viewport.value.scale})`,
  transformOrigin: '0 0'
}))
</script>

<template>
  <div
    ref="surface"
    class="relative min-h-0 flex-1 overflow-hidden bg-canvas"
    :class="panning ? 'cursor-grabbing' : 'cursor-default'"
    :style="gridStyle"
    @pointerdown="onSurfacePointerDown"
    @wheel="onWheel"
    @dragover.prevent
    @drop="onDrop"
    @contextmenu.prevent
  >
    <!-- Couche transformée : le plan lui-même n'a pas de bornes -->
    <div class="absolute left-0 top-0 origin-top-left" :style="layerStyle">
      <svg
        class="absolute overflow-visible"
        :style="{ left: '-20000px', top: '-20000px', width: '40000px', height: '40000px' }"
        aria-hidden="true"
      >
        <g :transform="'translate(20000, 20000)'">
          <g v-for="link in board.links" :key="link.id">
            <!-- Trait large invisible : cible de clic confortable -->
            <path
              :d="linkPath(link)"
              fill="none"
              stroke="transparent"
              stroke-width="14"
              class="cursor-pointer"
              @pointerdown.stop
              @click.stop="topo.selectLink(link.id)"
            />
            <path
              :d="linkPath(link)"
              fill="none"
              class="pointer-events-none"
              :stroke="linkColor(link.id, link.medium)"
              :stroke-width="selectedLinkId === link.id ? 4 : 2"
              :stroke-dasharray="findMedium(link.medium)?.family === 'énergie' ? '4 4' : undefined"
              :opacity="selectedLinkId === link.id ? 1 : 0.9"
            />
          </g>
          <path
            v-if="cablingPath"
            :d="cablingPath"
            fill="none"
            stroke="var(--t-accent)"
            stroke-width="2"
            stroke-dasharray="6 4"
          />
        </g>
      </svg>

      <div
        v-for="node in board.nodes"
        :key="node.id"
        class="absolute cursor-grab select-none rounded-lg border bg-surface p-2 transition-shadow active:cursor-grabbing"
        :class="[
          isSelected(node.id) ? 'border-accent shadow-lg' : 'border-line',
          linkingFrom === node.id ? 'ring-2 ring-accent' : '',
          ringClass[nodeSeverity(node.id) ?? ''] ?? ''
        ]"
        :style="{ left: `${node.x}px`, top: `${node.y}px`, width: `${NODE_WIDTH}px` }"
        @pointerdown="onNodePointerDown(node, $event)"
        @click.stop="onNodeClick(node)"
      >
        <div class="flex items-center gap-1.5">
          <UIcon :name="itemOf(node)?.icon ?? 'i-lucide-box'" class="size-3.5 shrink-0 text-accent" />
          <span class="min-w-0 flex-1 truncate text-[11px] font-medium text-ink">{{ node.label }}</span>
        </div>

        <p v-if="node.config.ip" class="mt-1 truncate font-mono text-[9px] text-ink-dim">
          {{ node.config.ip }}<span v-if="node.config.vlan"> · VLAN {{ node.config.vlan }}</span>
        </p>
        <p v-else-if="node.config.cpu" class="mt-1 truncate font-mono text-[9px] text-ink-dim">
          {{ node.config.cpu }}
        </p>

        <!-- Prises : données à droite, énergie et console en bas -->
        <button
          v-for="slot in slotsOf(node)"
          :key="slot.id"
          type="button"
          data-port
          :data-node="node.id"
          :data-port-id="slot.id"
          class="absolute size-3 rounded-full ring-2 ring-offset-1 ring-offset-[var(--t-surface)] transition hover:scale-150"
          :class="[
            slotColor[slot.family],
            slotRing[slot.family],
            cabling && hoverSlot === `${node.id}:${slot.id}` ? 'scale-150' : ''
          ]"
          :style="{
            left: `${slot.dx - 6}px`,
            top: `${slot.dy - 6}px`,
            cursor: 'crosshair'
          }"
          :title="slotTitle(node, slot)"
          :aria-label="slotTitle(node, slot)"
          @pointerdown="onPortPointerDown(node, slot, $event)"
          @pointerenter="hoverSlot = `${node.id}:${slot.id}`"
          @pointerleave="hoverSlot = null"
          @click.stop
        />
      </div>
    </div>

    <!-- Rectangle de sélection -->
    <div
      v-if="marquee"
      class="pointer-events-none absolute border border-accent bg-accent-soft/30"
      :style="{
        left: `${viewport.x + Math.min(marquee.x, marquee.x + marquee.w) * viewport.scale}px`,
        top: `${viewport.y + Math.min(marquee.y, marquee.y + marquee.h) * viewport.scale}px`,
        width: `${Math.abs(marquee.w) * viewport.scale}px`,
        height: `${Math.abs(marquee.h) * viewport.scale}px`
      }"
    />

    <!-- Plateau vide -->
    <div
      v-if="!board.nodes.length"
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
    >
      <UIcon name="i-lucide-network" class="size-10 text-ink-dim" />
      <p class="mt-4 text-sm text-ink-muted">Glissez un composant depuis le dock de droite.</p>
      <p class="mt-1 font-mono text-[11px] text-ink-dim">
        {{ CATALOG.length }} équipements · tirez une prise vers une autre pour câbler
      </p>
    </div>

    <!-- Repères de navigation -->
    <!-- Légende des prises -->
    <div class="pointer-events-none absolute right-2 top-2 flex flex-col gap-1 rounded-md border border-line bg-surface/90 px-2 py-1.5">
      <span class="flex items-center gap-1.5 font-mono text-[9px] text-ink-dim">
        <span class="size-2 rounded-full bg-accent" /> données
      </span>
      <span class="flex items-center gap-1.5 font-mono text-[9px] text-ink-dim">
        <span class="size-2 rounded-full bg-warning-500" /> alimentation
      </span>
      <span class="flex items-center gap-1.5 font-mono text-[9px] text-ink-dim">
        <span class="size-2 rounded-full bg-info-500" /> console
      </span>
    </div>

    <div class="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2">
      <span class="rounded border border-line bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
        {{ Math.round(viewport.scale * 100) }} %
      </span>
      <span
        v-if="selectedIds.length > 1"
        class="rounded border border-accent bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent"
      >
        {{ selectedIds.length }} sélectionnés
      </span>
    </div>

    <div
      v-if="linkingFrom"
      class="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs text-accent"
    >
      Cliquez le composant de destination · Échap pour annuler
    </div>
  </div>
</template>
