<script setup lang="ts">
import {
  GRID_COLS,
  GRID_ROWS,
  WIDGET_CATALOG,
  specOf,
  type Rect,
  type WidgetInstance,
  type WidgetType
} from '~~/shared/dashboard'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Tableau de bord — Tanchi Web' })

const { user } = useAuth()
const dash = useDashboard()
const { widgets, data, loaded, editing, saving, ghost, occupancy } = dash

onMounted(dash.load)
onBeforeUnmount(dash.stopPersisting)

/* --------------------------------------------------------- Géométrie grille */

const surface = ref<HTMLElement>()
const GAP = 8
const ROW_HEIGHT = 68

const cell = ref({ width: 120, height: ROW_HEIGHT, gap: GAP })

function measure() {
  const width = surface.value?.clientWidth ?? 0
  if (!width) return
  cell.value = {
    width: (width - GAP * (GRID_COLS - 1)) / GRID_COLS,
    height: ROW_HEIGHT,
    gap: GAP
  }
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => window.removeEventListener('resize', measure))

const surfaceHeight = computed(() => GRID_ROWS * ROW_HEIGHT + (GRID_ROWS - 1) * GAP)

/* ------------------------------------------- Déplacement / redimensionnement */

interface Drag {
  id: string
  mode: 'move' | 'resize'
  originX: number
  originY: number
  start: WidgetInstance
}

let drag: Drag | null = null

/** Conversion d'un déplacement en pixels vers un delta en cases. */
function toCells(dx: number, dy: number) {
  return {
    dx: Math.round(dx / (cell.value.width + GAP)),
    dy: Math.round(dy / (cell.value.height + GAP))
  }
}

function overlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function begin(widget: WidgetInstance, mode: Drag['mode'], event: PointerEvent) {
  if (!editing.value) return
  event.preventDefault()

  drag = { id: widget.id, mode, originX: event.clientX, originY: event.clientY, start: { ...widget } }
  ghost.value = { x: widget.x, y: widget.y, w: widget.w, h: widget.h, valid: true }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
}

function onPointerMove(event: PointerEvent) {
  if (!drag) return
  const { dx, dy } = toCells(event.clientX - drag.originX, event.clientY - drag.originY)

  const rect: Rect = drag.mode === 'move'
    ? dash.previewMove(drag.start, dx, dy)
    : dash.previewResize(drag.start, dx, dy)

  const free = widgets.value.every(item => item.id === drag!.id || !overlap(rect, item))
  ghost.value = { ...rect, valid: free }
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove)

  if (drag && ghost.value?.valid) {
    dash.apply(drag.id, { x: ghost.value.x, y: ghost.value.y, w: ghost.value.w, h: ghost.value.h })
  }

  drag = null
  ghost.value = null
}

const ghostStyle = computed(() => {
  if (!ghost.value) return {}
  const { width, height } = cell.value
  return {
    left: `${ghost.value.x * (width + GAP)}px`,
    top: `${ghost.value.y * (height + GAP)}px`,
    width: `${ghost.value.w * width + (ghost.value.w - 1) * GAP}px`,
    height: `${ghost.value.h * height + (ghost.value.h - 1) * GAP}px`
  }
})

/* ----------------------------------------------------------------- Palette */

const paletteOpen = ref(false)

function add(type: WidgetType) {
  if (dash.place(type)) paletteOpen.value = false
}

/* ------------------------------------------------------ Portée d'un widget */

const configuring = ref<WidgetInstance | null>(null)
const scopeValue = ref('')

const scopeItems = computed(() => {
  const spec = configuring.value ? specOf(configuring.value.type) : undefined

  if (spec?.scope === 'team') {
    return (data.value?.teams ?? []).map(team => ({ label: team.name, value: String(team.id) }))
  }

  return ((data.value?.projects ?? []) as Record<string, number | string>[])
    .map(project => ({ label: `${project.teamName} · ${project.name}`, value: String(project.id) }))
})

function openConfigure(widget: WidgetInstance) {
  configuring.value = widget
  const spec = specOf(widget.type)
  scopeValue.value = String(
    (spec?.scope === 'team' ? widget.options?.teamId : widget.options?.projectId) ?? ''
  )
}

function applyScope() {
  if (!configuring.value || !scopeValue.value) return

  const spec = specOf(configuring.value.type)
  dash.updateOptions(
    configuring.value.id,
    spec?.scope === 'team'
      ? { teamId: Number(scopeValue.value) }
      : { projectId: Number(scopeValue.value) }
  )
  configuring.value = null
}

const catalog = WIDGET_CATALOG
</script>

<template>
  <div class="space-y-4">
    <!-- Barre de tête -->
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-ink">
          Bonjour {{ user?.username }}
        </h1>
        <p class="mt-1 font-mono text-[11px] text-ink-dim">
          grille {{ GRID_COLS }}×{{ GRID_ROWS }} ·
          {{ widgets.length }} widget{{ widgets.length > 1 ? 's' : '' }} ·
          {{ occupancy }} % occupé<span v-if="saving"> · enregistrement…</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          v-if="editing"
          icon="i-lucide-plus"
          color="primary"
          size="sm"
          label="Ajouter un widget"
          @click="paletteOpen = true"
        />
        <UButton
          v-if="editing"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          size="sm"
          label="Réinitialiser"
          @click="dash.reset()"
        />
        <UButton
          :icon="editing ? 'i-lucide-check' : 'i-lucide-pencil-ruler'"
          :color="editing ? 'primary' : 'neutral'"
          :variant="editing ? 'solid' : 'outline'"
          size="sm"
          :label="editing ? 'Terminer' : 'Personnaliser'"
          @click="editing = !editing"
        />
      </div>
    </header>

    <!-- Grille -->
    <div
      ref="surface"
      class="relative w-full select-none rounded-xl transition"
      :class="editing ? 'ring-1 ring-accent/20' : ''"
      :style="{ height: `${surfaceHeight}px` }"
    >
      <!-- Trame visible uniquement en personnalisation -->
      <div
        v-if="editing"
        class="pointer-events-none absolute inset-0 rounded-xl opacity-50"
        :style="{
          backgroundImage: 'linear-gradient(to right, var(--t-line) 1px, transparent 1px), linear-gradient(to bottom, var(--t-line) 1px, transparent 1px)',
          backgroundSize: `${cell.width + GAP}px ${cell.height + GAP}px`
        }"
      />

      <!-- Prévisualisation du dépôt -->
      <div
        v-if="ghost"
        class="pointer-events-none absolute rounded-xl border-2 border-dashed"
        :class="ghost.valid ? 'border-accent bg-accent-soft/40' : 'border-error-500 bg-error-500/10'"
        :style="ghostStyle"
      />

      <DashboardFrame
        v-for="widget in widgets"
        :key="widget.id"
        :widget="widget"
        :editing="editing"
        :cell="cell"
        @move-start="begin(widget, 'move', $event)"
        @resize-start="begin(widget, 'resize', $event)"
        @remove="dash.remove(widget.id)"
        @configure="openConfigure(widget)"
      >
        <DashboardWidget :widget="widget" />
      </DashboardFrame>

      <!-- Grille vide -->
      <div
        v-if="loaded && !widgets.length"
        class="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-dashed border-line"
      >
        <UIcon name="i-lucide-layout-dashboard" class="size-8 text-ink-dim" />
        <h2 class="mt-4 font-medium text-ink">Tableau de bord vide</h2>
        <p class="mt-2 max-w-sm text-center text-sm text-ink-muted">
          Passez en mode personnalisation pour poser vos premiers widgets sur la grille.
        </p>
        <UButton
          class="mt-6"
          icon="i-lucide-plus"
          color="primary"
          label="Ajouter un widget"
          @click="editing = true; paletteOpen = true"
        />
      </div>

      <div v-else-if="!loaded" class="absolute inset-0 animate-pulse rounded-xl bg-surface" />
    </div>

    <!-- Palette de widgets -->
    <UModal v-model:open="paletteOpen" title="Ajouter un widget" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="spec in catalog"
            :key="spec.type"
            type="button"
            class="rounded-lg border border-line bg-surface p-3 text-left transition hover:border-accent/60"
            @click="add(spec.type)"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="spec.icon" class="size-4 shrink-0 text-accent" />
              <span class="text-sm font-medium text-ink">{{ spec.label }}</span>
              <span class="ml-auto shrink-0 font-mono text-[10px] text-ink-dim">
                {{ spec.defaultSize.w }}×{{ spec.defaultSize.h }}
              </span>
            </div>
            <p class="mt-1.5 text-xs leading-relaxed text-ink-muted">{{ spec.description }}</p>
            <p class="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
              {{ spec.source }}
            </p>
          </button>
        </div>
      </template>
    </UModal>

    <!-- Source d'un widget contextuel -->
    <UModal
      :open="Boolean(configuring)"
      title="Source du widget"
      @update:open="value => !value && (configuring = null)"
    >
      <template #body>
        <UFormField :label="specOf(configuring?.type ?? '')?.scope === 'team' ? 'Équipe' : 'Projet'">
          <USelect v-model="scopeValue" :items="scopeItems" size="lg" class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="configuring = null" />
          <UButton color="primary" :disabled="!scopeValue" label="Appliquer" @click="applyScope" />
        </div>
      </template>
    </UModal>
  </div>
</template>
