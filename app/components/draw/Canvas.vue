<script setup lang="ts">
import {
  ANCHOR_GAP,
  PAGE_H,
  PAGE_W,
  anchorOf,
  arrowHead,
  autoSide,
  connectorGeometry,
  dashArray,
  iconGlyphRect,
  textLayout,
  type Connector,
  type Endpoint,
  type Shape,
  type ShapeKind,
  type Side
} from '~~/shared/draw/model'

/**
 * Planche de TanchiDraw.
 *
 * Tout est dessiné en SVG, y compris les icônes : c'est la condition pour que
 * l'export en image soit exactement ce que l'on voit à l'écran. Les éléments
 * d'interface (trame, poignées, repères) portent `data-ui` et sont retirés au
 * moment de l'export.
 */

const draw = useDraw()
const {
  page, background, viewport, tool, pendingIcon, selectedIds, selectedConnectorId,
  editingId, snapping, presenting, shapeById, selectedShape, isSelected, iconBody
} = draw

const host = ref<HTMLElement>()
const surface = ref<SVGSVGElement>()

defineExpose({ host, surface })

/* --------------------------------------------------- Repère et échelle */

function toWorld(clientX: number, clientY: number) {
  const rect = surface.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: (clientX - rect.left - viewport.value.x) / viewport.value.scale,
    y: (clientY - rect.top - viewport.value.y) / viewport.value.scale
  }
}

/** Taille constante à l'écran quel que soit le zoom. */
const px = (value: number) => value / viewport.value.scale

const sceneTransform = computed(
  () => `translate(${viewport.value.x}, ${viewport.value.y}) scale(${viewport.value.scale})`
)

/* ------------------------------------------------------------- Formes */

const layoutOf = (shape: Shape) => textLayout(shape)

const diamondPoints = (shape: Shape) =>
  `${shape.x + shape.w / 2},${shape.y} ${shape.x + shape.w},${shape.y + shape.h / 2} `
  + `${shape.x + shape.w / 2},${shape.y + shape.h} ${shape.x},${shape.y + shape.h / 2}`

const glyphTransform = (shape: Shape) => {
  const rect = iconGlyphRect(shape)
  return `translate(${rect.x}, ${rect.y}) scale(${rect.size / 24})`
}

const boxKinds: ShapeKind[] = ['rect', 'note', 'zone']

/* ----------------------------------------------------------- Liaisons */

const geometries = computed(() =>
  page.value.connectors.map(connector => ({
    connector,
    geometry: connectorGeometry(connector, shapeById.value)
  }))
)

const headSize = (connector: Connector) => Math.max(9, connector.style.strokeWidth * 4)

/* ------------------------------------------------- Déplacement de formes */

interface Move { x: number, y: number, moved: boolean }
let move: Move | null = null

function onShapePointerDown(shape: Shape, event: PointerEvent) {
  if (event.button !== 0 || editingId.value || presenting.value) return
  event.stopPropagation()

  // Avec l'outil flèche, une forme est un point de départ, pas une cible à
  // déplacer : on tire la liaison depuis son bord.
  if (tool.value === 'arrow') {
    startCabling({ shapeId: shape.id, side: 'auto', x: 0, y: 0 }, event)
    return
  }

  // Tout autre outil l'emporte sur la sélection : viser au-dessus d'une forme
  // existante pose quand même l'objet, et la main déplace la planche.
  if (tool.value !== 'select') {
    onSurfacePointerDown(event)
    return
  }

  if (shape.locked) {
    draw.clearSelection()
    return
  }

  if (!isSelected(shape.id)) draw.select(shape.id, event.shiftKey)
  else if (event.shiftKey) draw.select(shape.id, true)

  const world = toWorld(event.clientX, event.clientY)
  move = { x: world.x, y: world.y, moved: false }

  window.addEventListener('pointermove', onMoveDrag)
  window.addEventListener('pointerup', onMoveEnd, { once: true })
}

function onMoveDrag(event: PointerEvent) {
  if (!move) return
  const world = toWorld(event.clientX, event.clientY)
  const dx = world.x - move.x
  const dy = world.y - move.y
  if (!dx && !dy) return

  // Un seul point d'annulation pour tout le geste.
  if (!move.moved) {
    draw.checkpoint()
    move.moved = true
  }

  draw.moveSelection(dx, dy, false)
  move.x = world.x
  move.y = world.y
}

function onMoveEnd() {
  window.removeEventListener('pointermove', onMoveDrag)
  if (move?.moved) draw.snapSelection()
  move = null
}

/* ----------------------------------------------------- Redimensionnement */

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLES: { id: Handle, fx: number, fy: number, cursor: string }[] = [
  { id: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { id: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { id: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { id: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { id: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { id: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { id: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { id: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' }
]

let resize: { handle: Handle, origin: { x: number, y: number, w: number, h: number }, moved: boolean } | null = null

function onHandlePointerDown(handle: Handle, event: PointerEvent) {
  const shape = selectedShape.value
  if (!shape || event.button !== 0) return
  event.stopPropagation()

  resize = { handle, origin: { x: shape.x, y: shape.y, w: shape.w, h: shape.h }, moved: false }

  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd, { once: true })
}

function onResizeMove(event: PointerEvent) {
  const shape = selectedShape.value
  if (!resize || !shape) return

  if (!resize.moved) {
    draw.checkpoint()
    resize.moved = true
  }

  const world = toWorld(event.clientX, event.clientY)
  const origin = resize.origin
  let { x, y, w, h } = origin

  if (resize.handle.includes('e')) w = world.x - origin.x
  if (resize.handle.includes('s')) h = world.y - origin.y
  if (resize.handle.includes('w')) {
    w = origin.x + origin.w - world.x
    x = world.x
  }
  if (resize.handle.includes('n')) {
    h = origin.y + origin.h - world.y
    y = world.y
  }

  // Maj conserve les proportions : indispensable pour ne pas déformer une icône.
  if (event.shiftKey && resize.handle.length === 2) {
    const ratio = origin.w / origin.h
    if (Math.abs(w) > Math.abs(h * ratio)) h = w / ratio
    else w = h * ratio
    if (resize.handle.includes('w')) x = origin.x + origin.w - w
    if (resize.handle.includes('n')) y = origin.y + origin.h - h
  }

  const step = (value: number) => (snapping.value && !event.altKey ? Math.round(value / draw.grid) * draw.grid : Math.round(value))

  draw.resizeShape(shape.id, {
    x: step(x),
    y: step(y),
    w: Math.max(16, step(w)),
    h: Math.max(16, step(h))
  })
}

function onResizeEnd() {
  window.removeEventListener('pointermove', onResizeMove)
  resize = null
}

/* ---------------------------------------------------------- Câblage */

const hovered = ref<string | null>(null)
const cabling = ref<{ from: Endpoint, x: number, y: number } | null>(null)

const SIDES: { id: Exclude<Side, 'auto'>, fx: number, fy: number }[] = [
  { id: 'top', fx: 0.5, fy: 0 },
  { id: 'right', fx: 1, fy: 0.5 },
  { id: 'bottom', fx: 0.5, fy: 1 },
  { id: 'left', fx: 0, fy: 0.5 }
]

function startCabling(from: Endpoint, event: PointerEvent) {
  event.stopPropagation()
  const world = toWorld(event.clientX, event.clientY)
  cabling.value = { from, x: world.x, y: world.y }

  window.addEventListener('pointermove', onCablingMove)
  window.addEventListener('pointerup', onCablingEnd, { once: true })
}

function onCablingMove(event: PointerEvent) {
  if (!cabling.value) return
  const world = toWorld(event.clientX, event.clientY)
  cabling.value = { ...cabling.value, x: world.x, y: world.y }
}

/** Le lâcher décide : sur une forme la flèche s'accroche, sinon elle reste libre. */
function onCablingEnd(event: PointerEvent) {
  window.removeEventListener('pointermove', onCablingMove)

  const source = cabling.value
  cabling.value = null
  hovered.value = null
  if (!source) return

  const element = document.elementFromPoint(event.clientX, event.clientY) as Element | null
  const target = element?.closest('[data-shape]') as (SVGElement & { dataset: DOMStringMap }) | null
  const world = toWorld(event.clientX, event.clientY)

  const shapeId = target?.dataset.shape
  const side = (target?.dataset.side as Side | undefined) ?? 'auto'

  if (shapeId && shapeId === source.from.shapeId) return

  const to: Endpoint = shapeId
    ? { shapeId, side, x: 0, y: 0 }
    : { side: 'auto', x: Math.round(world.x), y: Math.round(world.y) }

  draw.addConnector(source.from, to)
}

/** Aperçu du trait pendant la pose : il part déjà de la bonne face. */
const cablingPath = computed(() => {
  const source = cabling.value
  if (!source) return ''

  const shape = source.from.shapeId ? shapeById.value.get(source.from.shapeId) : undefined
  if (!shape) return `M ${source.from.x} ${source.from.y} L ${source.x} ${source.y}`

  const side = source.from.side === 'auto' ? autoSide(shape, source) : source.from.side
  const anchor = anchorOf(shape, side)

  return `M ${anchor.x + anchor.nx * ANCHOR_GAP} ${anchor.y + anchor.ny * ANCHOR_GAP} `
    + `L ${source.x} ${source.y}`
})

/* ------------------------------------------------- Plateau et outils */

const marquee = ref<{ x: number, y: number, w: number, h: number } | null>(null)
const drafting = ref<{ kind: ShapeKind, x: number, y: number, w: number, h: number } | null>(null)
const panning = ref(false)

function startPan(event: PointerEvent) {
  const origin = { x: event.clientX, y: event.clientY, vx: viewport.value.x, vy: viewport.value.y }
  panning.value = true

  const onMove = (moveEvent: PointerEvent) => {
    viewport.value = {
      ...viewport.value,
      x: origin.vx + (moveEvent.clientX - origin.x),
      y: origin.vy + (moveEvent.clientY - origin.y)
    }
  }

  const onEnd = () => {
    window.removeEventListener('pointermove', onMove)
    panning.value = false
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd, { once: true })
}

function onSurfacePointerDown(event: PointerEvent) {
  // En présentation, la planche ne se manipule plus : elle se regarde.
  if (presenting.value) return

  // Un clic ailleurs valide la saisie en cours plutôt que de la perdre.
  if (editingId.value) {
    commitEditing()
    return
  }

  // Clic milieu, Alt ou outil main : on déplace la planche.
  if (event.button === 1 || event.altKey || tool.value === 'hand') {
    event.preventDefault()
    startPan(event)
    return
  }

  if (event.button !== 0) return
  const world = toWorld(event.clientX, event.clientY)

  if (tool.value === 'icon' && pendingIcon.value) {
    draw.addIcon(pendingIcon.value, world.x, world.y)
    if (!event.shiftKey) {
      // Maj maintenue : on enchaîne les poses, sinon on revient à la sélection.
      draw.tool.value = 'select'
      draw.pendingIcon.value = null
    }
    return
  }

  if (tool.value === 'arrow') {
    startCabling({ side: 'auto', x: Math.round(world.x), y: Math.round(world.y) }, event)
    return
  }

  if (tool.value !== 'select') {
    startDrafting(tool.value as ShapeKind, world, event)
    return
  }

  if (!event.shiftKey) draw.clearSelection()
  startMarquee(world, event.shiftKey)
}

function startMarquee(world: { x: number, y: number }, additive: boolean) {
  marquee.value = { x: world.x, y: world.y, w: 0, h: 0 }

  const onMove = (event: PointerEvent) => {
    if (!marquee.value) return
    const point = toWorld(event.clientX, event.clientY)
    marquee.value = { ...marquee.value, w: point.x - marquee.value.x, h: point.y - marquee.value.y }
  }

  const onEnd = () => {
    window.removeEventListener('pointermove', onMove)
    if (marquee.value && (Math.abs(marquee.value.w) > 4 || Math.abs(marquee.value.h) > 4)) {
      draw.selectInRect(marquee.value, additive)
    }
    marquee.value = null
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd, { once: true })
}

/** Tracé d'une forme au glissement ; un simple clic pose la taille par défaut. */
function startDrafting(kind: ShapeKind, world: { x: number, y: number }, event: PointerEvent) {
  drafting.value = { kind, x: world.x, y: world.y, w: 0, h: 0 }

  const onMove = (moveEvent: PointerEvent) => {
    if (!drafting.value) return
    const point = toWorld(moveEvent.clientX, moveEvent.clientY)
    drafting.value = { ...drafting.value, w: point.x - drafting.value.x, h: point.y - drafting.value.y }
  }

  const onEnd = () => {
    window.removeEventListener('pointermove', onMove)
    const draft = drafting.value
    drafting.value = null
    if (!draft) return

    const wide = Math.abs(draft.w) > 12 && Math.abs(draft.h) > 12
    const shape = wide
      ? draw.addShape(kind, Math.min(draft.x, draft.x + draft.w), Math.min(draft.y, draft.y + draft.h), {
        w: Math.round(Math.abs(draft.w)),
        h: Math.round(Math.abs(draft.h))
      })
      : draw.addShape(kind, draft.x, draft.y)

    if (!event.shiftKey) draw.tool.value = 'select'
    // Une forme neuve attend son texte : on ouvre la saisie directement.
    if (kind !== 'zone') startEditing(shape.id)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd, { once: true })
}

function onWheel(event: WheelEvent) {
  if (presenting.value) return
  event.preventDefault()

  if (event.ctrlKey || event.metaKey) {
    const rect = surface.value?.getBoundingClientRect()
    draw.zoomBy(
      event.deltaY < 0 ? 1.12 : 1 / 1.12,
      event.clientX - (rect?.left ?? 0),
      event.clientY - (rect?.top ?? 0)
    )
    return
  }

  draw.panBy(-event.deltaX, -event.deltaY)
}

/* --------------------------------------------------- Dépôt du catalogue */

function onDrop(event: DragEvent) {
  event.preventDefault()

  const icon = event.dataTransfer?.getData('text/tanchi-icon')
  const label = event.dataTransfer?.getData('text/tanchi-label') ?? ''
  const kind = event.dataTransfer?.getData('text/tanchi-shape')

  const world = toWorld(event.clientX, event.clientY)

  if (icon) draw.addIcon(icon, world.x, world.y, label)
  else if (kind) draw.addShape(kind as ShapeKind, world.x, world.y, { text: label })
}

/* --------------------------------------------------------- Saisie texte */

const draft = ref('')
const editor = ref<HTMLTextAreaElement>()

function startEditing(id: string) {
  if (presenting.value) return
  const shape = page.value.shapes.find(item => item.id === id)
  if (!shape || shape.locked) return

  draft.value = shape.text ?? ''
  draw.editingId.value = id
  nextTick(() => {
    editor.value?.focus()
    editor.value?.select()
  })
}

function commitEditing() {
  const id = editingId.value
  if (!id) return
  draw.editingId.value = null

  const shape = page.value.shapes.find(item => item.id === id)
  if (shape && (shape.text ?? '') !== draft.value) draw.setText(id, draft.value)
}

/** Boîte de saisie posée exactement sur la forme, à l'échelle du zoom. */
const editorBox = computed(() => {
  const shape = page.value.shapes.find(item => item.id === editingId.value)
  if (!shape) return null

  const scale = viewport.value.scale
  return {
    left: `${viewport.value.x + shape.x * scale}px`,
    top: `${viewport.value.y + shape.y * scale}px`,
    width: `${shape.w * scale}px`,
    height: `${shape.h * scale}px`,
    fontSize: `${shape.style.fontSize * scale}px`,
    lineHeight: `${shape.style.fontSize * 1.35 * scale}px`,
    color: shape.style.color,
    fontWeight: shape.style.bold ? 700 : 400,
    textAlign: shape.style.align,
    // L'icône garde son glyphe visible : seul le libellé passe en saisie.
    paddingTop: shape.kind === 'icon'
      ? `${Math.max(0, shape.h - shape.style.fontSize * 2.4) * scale}px`
      : shape.kind === 'text' || shape.kind === 'zone'
        ? `${8 * scale}px`
        : `${Math.max(0, shape.h / 2 - shape.style.fontSize) * scale}px`
  }
})

/* ------------------------------------------------ Étiquette de liaison */

const connectorEditing = ref<string | null>(null)
const connectorDraft = ref('')

function startConnectorLabel(connector: Connector) {
  connectorEditing.value = connector.id
  connectorDraft.value = connector.label ?? ''
}

function commitConnectorLabel() {
  const id = connectorEditing.value
  if (!id) return
  connectorEditing.value = null
  draw.updateConnector(id, { label: connectorDraft.value.trim() || undefined })
}

const connectorBox = computed(() => {
  const entry = geometries.value.find(item => item.connector.id === connectorEditing.value)
  if (!entry) return null

  const scale = viewport.value.scale
  return {
    left: `${viewport.value.x + entry.geometry.mid.x * scale - 90}px`,
    top: `${viewport.value.y + entry.geometry.mid.y * scale - 16}px`
  }
})

/* -------------------------------------------------------- Curseur */

const cursor = computed(() => {
  if (panning.value) return 'grabbing'
  if (tool.value === 'hand') return 'grab'
  if (tool.value === 'select') return 'default'
  return 'crosshair'
})
</script>

<template>
  <div
    ref="host"
    class="relative min-h-0 flex-1 overflow-hidden"
    :style="{ background: 'var(--t-canvas)' }"
    @dragover.prevent
    @drop="onDrop"
  >
    <svg
      ref="surface"
      class="absolute inset-0 size-full touch-none select-none"
      :style="{ cursor }"
      @pointerdown="onSurfacePointerDown"
      @wheel="onWheel"
      @contextmenu.prevent
    >
      <defs>
        <pattern id="draw-grid" :width="draw.grid * 4" :height="draw.grid * 4" patternUnits="userSpaceOnUse">
          <circle :cx="0.5" :cy="0.5" r="1" :fill="background.grid" />
        </pattern>
      </defs>

      <g data-scene :transform="sceneTransform">
        <!-- Planche : fond et trame sont de l'interface, l'export les repose -->
        <!-- Ombre portée : ce qui déborde de la feuille ne sera pas exporté -->
        <rect
          data-ui
          x="6"
          y="8"
          :width="PAGE_W"
          :height="PAGE_H"
          fill="rgba(0,0,0,0.35)"
        />
        <rect
          data-ui
          :width="PAGE_W"
          :height="PAGE_H"
          :fill="background.color"
          stroke="var(--t-line-strong)"
          stroke-width="1"
        />
        <rect
          v-if="page.grid && !presenting"
          data-ui
          :width="PAGE_W"
          :height="PAGE_H"
          fill="url(#draw-grid)"
        />

        <!-- Liaisons, sous les formes : une flèche ne masque jamais une icône -->
        <g v-for="{ connector, geometry } in geometries" :key="connector.id" :opacity="connector.style.opacity">
          <path
            :d="geometry.d"
            fill="none"
            stroke="transparent"
            :stroke-width="Math.max(16, connector.style.strokeWidth * 6)"
            :style="{ cursor: presenting ? 'default' : 'pointer', pointerEvents: presenting ? 'none' : 'auto' }"
            @pointerdown.stop="draw.selectConnector(connector.id)"
            @dblclick.stop="startConnectorLabel(connector)"
          />
          <path
            :d="geometry.d"
            fill="none"
            class="pointer-events-none"
            :stroke="connector.style.stroke"
            :stroke-width="connector.style.strokeWidth + (selectedConnectorId === connector.id ? 1.5 : 0)"
            :stroke-dasharray="dashArray(connector.style.dash, connector.style.strokeWidth)"
            stroke-linecap="round"
          />
          <path
            v-if="connector.endArrow"
            class="pointer-events-none"
            :d="arrowHead(geometry.b, geometry.angleB, headSize(connector))"
            :fill="connector.style.stroke"
          />
          <path
            v-if="connector.startArrow"
            class="pointer-events-none"
            :d="arrowHead(geometry.a, geometry.angleA + Math.PI, headSize(connector))"
            :fill="connector.style.stroke"
          />
          <text
            v-if="connector.label"
            class="pointer-events-none"
            :x="geometry.mid.x"
            :y="geometry.mid.y"
            text-anchor="middle"
            dominant-baseline="middle"
            font-family="Inter, ui-sans-serif, system-ui, sans-serif"
            :font-size="connector.style.fontSize"
            :fill="connector.style.color"
            paint-order="stroke"
            :stroke="background.color"
            stroke-width="5"
            stroke-linejoin="round"
          >{{ connector.label }}</text>
        </g>

        <!-- Formes, dans l'ordre de superposition -->
        <g
          v-for="shape in page.shapes"
          :key="shape.id"
          :opacity="shape.style.opacity"
          @pointerenter="hovered = shape.id"
          @pointerleave="hovered = hovered === shape.id ? null : hovered"
        >
          <rect
            v-if="boxKinds.includes(shape.kind)"
            :x="shape.x"
            :y="shape.y"
            :width="shape.w"
            :height="shape.h"
            :rx="shape.style.radius"
            :fill="shape.style.fill"
            :stroke="shape.style.stroke"
            :stroke-width="shape.style.strokeWidth"
            :stroke-dasharray="dashArray(shape.style.dash, shape.style.strokeWidth)"
          />
          <ellipse
            v-else-if="shape.kind === 'ellipse'"
            :cx="shape.x + shape.w / 2"
            :cy="shape.y + shape.h / 2"
            :rx="shape.w / 2"
            :ry="shape.h / 2"
            :fill="shape.style.fill"
            :stroke="shape.style.stroke"
            :stroke-width="shape.style.strokeWidth"
            :stroke-dasharray="dashArray(shape.style.dash, shape.style.strokeWidth)"
          />
          <polygon
            v-else-if="shape.kind === 'diamond'"
            :points="diamondPoints(shape)"
            :fill="shape.style.fill"
            :stroke="shape.style.stroke"
            :stroke-width="shape.style.strokeWidth"
            :stroke-dasharray="dashArray(shape.style.dash, shape.style.strokeWidth)"
          />

          <!-- Glyphe : tracé Lucide inséré tel quel, teinté par `color` -->
          <g
            v-if="shape.kind === 'icon' && iconBody(shape.icon)"
            class="pointer-events-none"
            :transform="glyphTransform(shape)"
            :style="{ color: shape.style.color }"
            v-html="iconBody(shape.icon)"
          />
          <rect
            v-else-if="shape.kind === 'icon'"
            class="pointer-events-none"
            :x="iconGlyphRect(shape).x"
            :y="iconGlyphRect(shape).y"
            :width="iconGlyphRect(shape).size"
            :height="iconGlyphRect(shape).size"
            rx="8"
            fill="none"
            :stroke="shape.style.color"
            stroke-width="1.5"
            stroke-dasharray="4 4"
          />

          <text
            v-if="layoutOf(shape) && editingId !== shape.id"
            class="pointer-events-none"
            :x="layoutOf(shape)!.x"
            :y="layoutOf(shape)!.y"
            :text-anchor="layoutOf(shape)!.anchor"
            font-family="Inter, ui-sans-serif, system-ui, sans-serif"
            :font-size="shape.style.fontSize"
            :font-weight="shape.style.bold ? 700 : 400"
            :fill="shape.style.color"
          >
            <tspan
              v-for="(line, index) in layoutOf(shape)!.lines"
              :key="index"
              :x="layoutOf(shape)!.x"
              :dy="index === 0 ? 0 : layoutOf(shape)!.lineHeight"
            >{{ line }}</tspan>
          </text>

          <!-- Cible de saisie : couvre la forme, y compris quand elle est vide -->
          <rect
            :data-shape="shape.id"
            :x="shape.x"
            :y="shape.y"
            :width="shape.w"
            :height="shape.h"
            fill="transparent"
            :style="{ cursor: shape.locked ? 'not-allowed' : tool === 'arrow' ? 'crosshair' : 'move' }"
            @pointerdown="onShapePointerDown(shape, $event)"
            @dblclick.stop="startEditing(shape.id)"
          />

          <!-- Contour de sélection et cadenas -->
          <rect
            v-if="isSelected(shape.id) && !presenting"
            data-ui
            class="pointer-events-none"
            :x="shape.x - px(2)"
            :y="shape.y - px(2)"
            :width="shape.w + px(4)"
            :height="shape.h + px(4)"
            fill="none"
            stroke="var(--t-accent)"
            :stroke-width="px(1.5)"
            :rx="px(3)"
          />
          <rect
            v-if="shape.locked && isSelected(shape.id)"
            data-ui
            class="pointer-events-none"
            :x="shape.x"
            :y="shape.y"
            :width="shape.w"
            :height="shape.h"
            fill="none"
            stroke="var(--t-ink-dim)"
            :stroke-width="px(1)"
            :stroke-dasharray="`${px(6)} ${px(4)}`"
          />

          <!-- Points d'accroche : visibles au survol, ils tirent une flèche -->
          <template v-if="(hovered === shape.id || isSelected(shape.id)) && !shape.locked && !editingId && !presenting && tool !== 'hand'">
            <circle
              v-for="side in SIDES"
              :key="side.id"
              data-ui
              :data-shape="shape.id"
              :data-side="side.id"
              :cx="shape.x + shape.w * side.fx"
              :cy="shape.y + shape.h * side.fy"
              :r="px(5)"
              fill="var(--t-accent)"
              stroke="var(--t-canvas)"
              :stroke-width="px(1.5)"
              style="cursor: crosshair"
              @pointerdown.stop="startCabling({ shapeId: shape.id, side: side.id, x: 0, y: 0 }, $event)"
            />
          </template>
        </g>

        <!-- Poignées de redimensionnement : une seule forme à la fois -->
        <template v-if="selectedShape && selectedIds.length === 1 && !selectedShape.locked && !editingId && !presenting">
          <rect
            v-for="handle in HANDLES"
            :key="handle.id"
            data-ui
            :x="selectedShape.x + selectedShape.w * handle.fx - px(4)"
            :y="selectedShape.y + selectedShape.h * handle.fy - px(4)"
            :width="px(8)"
            :height="px(8)"
            fill="var(--t-canvas)"
            stroke="var(--t-accent)"
            :stroke-width="px(1.5)"
            :style="{ cursor: handle.cursor }"
            @pointerdown="onHandlePointerDown(handle.id, $event)"
          />
        </template>

        <!-- Flèche en cours de pose -->
        <path
          v-if="cablingPath"
          data-ui
          class="pointer-events-none"
          :d="cablingPath"
          fill="none"
          stroke="var(--t-accent)"
          :stroke-width="px(2)"
          :stroke-dasharray="`${px(6)} ${px(4)}`"
        />

        <!-- Forme en cours de tracé -->
        <rect
          v-if="drafting"
          data-ui
          class="pointer-events-none"
          :x="Math.min(drafting.x, drafting.x + drafting.w)"
          :y="Math.min(drafting.y, drafting.y + drafting.h)"
          :width="Math.abs(drafting.w)"
          :height="Math.abs(drafting.h)"
          fill="var(--t-accent-soft)"
          fill-opacity="0.4"
          stroke="var(--t-accent)"
          :stroke-width="px(1.5)"
        />

        <!-- Rectangle de sélection -->
        <rect
          v-if="marquee"
          data-ui
          class="pointer-events-none"
          :x="Math.min(marquee.x, marquee.x + marquee.w)"
          :y="Math.min(marquee.y, marquee.y + marquee.h)"
          :width="Math.abs(marquee.w)"
          :height="Math.abs(marquee.h)"
          fill="var(--t-accent)"
          fill-opacity="0.08"
          stroke="var(--t-accent)"
          :stroke-width="px(1)"
        />
      </g>
    </svg>

    <!-- Saisie du texte, posée sur la forme -->
    <textarea
      v-if="editingId && editorBox"
      ref="editor"
      v-model="draft"
      class="absolute z-20 resize-none overflow-hidden rounded-sm border-2 border-accent bg-transparent px-2 outline-none"
      :style="editorBox"
      spellcheck="false"
      @blur="commitEditing"
      @keydown.escape.prevent="commitEditing"
      @keydown.stop
    />

    <!-- Saisie de l'étiquette d'une flèche -->
    <div
      v-if="connectorEditing && connectorBox"
      class="absolute z-20 w-44"
      :style="connectorBox"
    >
      <input
        v-model="connectorDraft"
        autofocus
        class="w-full rounded border border-accent bg-surface px-2 py-1 text-xs text-ink outline-none"
        placeholder="Étiquette de la flèche"
        @blur="commitConnectorLabel"
        @keydown.enter.prevent="commitConnectorLabel"
        @keydown.escape.prevent="connectorEditing = null"
        @keydown.stop
      >
    </div>

    <!-- Repères de navigation -->
    <div v-if="!presenting" data-ui class="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2">
      <span class="rounded border border-line bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
        {{ Math.round(viewport.scale * 100) }} %
      </span>
      <span
        v-if="selectedIds.length > 1"
        class="rounded border border-accent bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent"
      >
        {{ selectedIds.length }} éléments
      </span>
      <span
        v-if="pendingIcon"
        class="rounded border border-accent bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent"
      >
        Cliquez pour poser l'icône · Maj pour enchaîner
      </span>
    </div>

    <!-- Planche vide : on dit quoi faire, pas ce qui manque -->
    <div
      v-if="!page.shapes.length && !page.connectors.length && !presenting"
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
    >
      <UIcon name="i-lucide-shapes" class="size-10 text-ink-dim" />
      <p class="mt-4 text-sm text-ink-muted">Glissez une icône depuis le catalogue, ou posez un modèle tout prêt.</p>
      <p class="mt-1 font-mono text-[11px] text-ink-dim">
        Double-clic pour écrire · tirez un point bleu pour relier deux éléments
      </p>
    </div>
  </div>
</template>
