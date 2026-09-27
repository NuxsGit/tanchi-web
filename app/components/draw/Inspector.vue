<script setup lang="ts">
import { BACKGROUNDS, PALETTE, soften, type Align, type BackgroundId, type Dash, type Routing } from '~~/shared/draw/model'

/**
 * Panneau de réglage.
 *
 * Il suit la sélection : une flèche, une ou plusieurs formes, ou — quand rien
 * n'est retenu — la planche elle-même. C'est le seul endroit où l'on règle une
 * couleur, ce qui évite d'éparpiller les commandes dans la barre d'outils.
 */

const draw = useDraw()
const { selectedShapes, selectedShape, selectedConnector, selectedIds, page, brush } = draw

const fillMode = ref<'doux' | 'plein'>('doux')

const applyFill = (hex: string) => draw.setStyle({ fill: fillMode.value === 'doux' ? soften(hex) : hex })

/** Style affiché : celui de la sélection, ou le pinceau à défaut. */
const style = computed(() => selectedConnector.value?.style ?? selectedShape.value?.style ?? brush.value)

const kindLabel = computed(() => {
  if (selectedConnector.value) return 'Flèche'
  if (selectedIds.value.length > 1) return `${selectedIds.value.length} éléments`

  const labels: Record<string, string> = {
    icon: 'Icône', rect: 'Rectangle', ellipse: 'Ellipse', diamond: 'Losange',
    zone: 'Zone', note: 'Post-it', text: 'Texte'
  }
  return labels[selectedShape.value?.kind ?? ''] ?? 'Planche'
})

const DASHES: { id: Dash, label: string, icon: string }[] = [
  { id: 'solid', label: 'Plein', icon: 'i-lucide-minus' },
  { id: 'dashed', label: 'Tirets', icon: 'i-lucide-dot-square' },
  { id: 'dotted', label: 'Pointillés', icon: 'i-lucide-ellipsis' }
]

const ALIGNS: { id: Align, label: string, icon: string }[] = [
  { id: 'left', label: 'À gauche', icon: 'i-lucide-align-left' },
  { id: 'center', label: 'Centré', icon: 'i-lucide-align-center' },
  { id: 'right', label: 'À droite', icon: 'i-lucide-align-right' }
]

const ROUTINGS: { id: Routing, label: string, icon: string }[] = [
  { id: 'curved', label: 'Courbe', icon: 'i-lucide-spline' },
  { id: 'straight', label: 'Droite', icon: 'i-lucide-move-right' },
  { id: 'elbow', label: 'Coudée', icon: 'i-lucide-corner-down-right' }
]

const ORDERS = [
  { id: 'front', label: 'Premier plan', icon: 'i-lucide-bring-to-front' },
  { id: 'forward', label: 'Avancer', icon: 'i-lucide-arrow-up' },
  { id: 'backward', label: 'Reculer', icon: 'i-lucide-arrow-down' },
  { id: 'back', label: 'Arrière-plan', icon: 'i-lucide-send-to-back' }
] as const

const ALIGNMENTS = [
  { id: 'left', label: 'Aligner à gauche', icon: 'i-lucide-align-start-vertical' },
  { id: 'center-x', label: 'Centrer horizontalement', icon: 'i-lucide-align-center-vertical' },
  { id: 'right', label: 'Aligner à droite', icon: 'i-lucide-align-end-vertical' },
  { id: 'top', label: 'Aligner en haut', icon: 'i-lucide-align-start-horizontal' },
  { id: 'center-y', label: 'Centrer verticalement', icon: 'i-lucide-align-center-horizontal' },
  { id: 'bottom', label: 'Aligner en bas', icon: 'i-lucide-align-end-horizontal' }
] as const

/* Géométrie : la saisie chiffrée reste le moyen le plus sûr de caler un plan. */

function geometry(field: 'x' | 'y' | 'w' | 'h') {
  return computed({
    get: () => Math.round(selectedShape.value?.[field] ?? 0),
    set: (value: number | string) => {
      const shape = selectedShape.value
      const parsed = Number(value)
      if (!shape || !Number.isFinite(parsed)) return
      draw.updateShape(shape.id, { [field]: field === 'w' || field === 'h' ? Math.max(16, parsed) : parsed })
    }
  })
}

const posX = geometry('x')
const posY = geometry('y')
const sizeW = geometry('w')
const sizeH = geometry('h')

const connectorLabel = computed({
  get: () => selectedConnector.value?.label ?? '',
  set: (value: string) => {
    const connector = selectedConnector.value
    if (connector) draw.updateConnector(connector.id, { label: value.trim() || undefined })
  }
})

const pageName = computed({
  get: () => page.value.name,
  set: (value: string) => draw.renamePage(page.value.id, value)
})

const locked = computed(() => selectedShapes.value.length > 0 && selectedShapes.value.every(shape => shape.locked))
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon
          :name="selectedConnector ? 'i-lucide-move-right' : selectedShape ? 'i-lucide-shapes' : 'i-lucide-file'"
          class="size-4 shrink-0 text-accent"
        />
        <p class="truncate text-sm font-medium text-ink">{{ kindLabel }}</p>
      </div>

      <UButton
        v-if="selectedShape || selectedConnector"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Désélectionner"
        @click="draw.clearSelection()"
      />
    </header>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      <!-- ------------------------------------------------ Réglages de page -->
      <template v-if="!selectedShape && !selectedConnector">
        <section class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Nom de la planche</p>
          <UInput v-model="pageName" size="sm" placeholder="Page 1" />
        </section>

        <section class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Fond</p>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="item in BACKGROUNDS"
              :key="item.id"
              type="button"
              class="h-9 rounded-md border-2 transition"
              :class="page.background === item.id ? 'border-accent' : 'border-line hover:border-line-strong'"
              :style="{ background: item.color }"
              :title="item.label"
              :aria-label="item.label"
              @click="draw.setBackground(item.id as BackgroundId)"
            />
          </div>
        </section>

        <section class="flex items-center justify-between gap-2">
          <span class="text-xs text-ink-muted">Trame de repère</span>
          <USwitch :model-value="page.grid" size="sm" @update:model-value="draw.toggleGrid()" />
        </section>

        <p class="rounded-md border border-line bg-canvas p-2.5 text-[11px] leading-relaxed text-ink-dim">
          Sélectionnez un élément pour régler sa couleur, sa taille et son texte.
          Double-cliquez sur la planche pour écrire, tirez un point bleu pour relier.
        </p>
      </template>

      <!-- ------------------------------------------------------- Flèche -->
      <template v-else-if="selectedConnector">
        <section class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Tracé</p>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="item in ROUTINGS"
              :key="item.id"
              type="button"
              class="flex h-8 items-center justify-center rounded-md border transition"
              :class="selectedConnector.routing === item.id
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-accent hover:text-accent'"
              :title="item.label"
              @click="draw.updateConnector(selectedConnector.id, { routing: item.id })"
            >
              <UIcon :name="item.icon" class="size-4" />
            </button>
          </div>
        </section>

        <section class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Pointes</p>
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-arrow-left"
              size="xs"
              :color="selectedConnector.startArrow ? 'primary' : 'neutral'"
              :variant="selectedConnector.startArrow ? 'soft' : 'outline'"
              label="Départ"
              @click="draw.updateConnector(selectedConnector.id, { startArrow: !selectedConnector.startArrow })"
            />
            <UButton
              icon="i-lucide-arrow-right"
              size="xs"
              :color="selectedConnector.endArrow ? 'primary' : 'neutral'"
              :variant="selectedConnector.endArrow ? 'soft' : 'outline'"
              label="Arrivée"
              @click="draw.updateConnector(selectedConnector.id, { endArrow: !selectedConnector.endArrow })"
            />
          </div>
        </section>

        <section class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Étiquette</p>
          <UInput v-model="connectorLabel" size="sm" placeholder="VPN, 1 Gb/s, HTTPS…" />
        </section>
      </template>

      <!-- ---------------------------------------------- Texte de la forme -->
      <template v-else>
        <section v-if="selectedIds.length === 1" class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Position et taille</p>
          <div class="grid grid-cols-2 gap-1.5">
            <UInput v-model="posX" type="number" size="xs" :ui="{ base: 'font-mono' }">
              <template #leading><span class="font-mono text-[10px] text-ink-dim">X</span></template>
            </UInput>
            <UInput v-model="posY" type="number" size="xs" :ui="{ base: 'font-mono' }">
              <template #leading><span class="font-mono text-[10px] text-ink-dim">Y</span></template>
            </UInput>
            <UInput v-model="sizeW" type="number" size="xs" :ui="{ base: 'font-mono' }">
              <template #leading><span class="font-mono text-[10px] text-ink-dim">L</span></template>
            </UInput>
            <UInput v-model="sizeH" type="number" size="xs" :ui="{ base: 'font-mono' }">
              <template #leading><span class="font-mono text-[10px] text-ink-dim">H</span></template>
            </UInput>
          </div>
        </section>
      </template>

      <!-- ------------------------------------- Réglages communs de style -->
      <template v-if="selectedShape || selectedConnector">
        <section class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">
            {{ selectedConnector ? 'Couleur du trait' : 'Couleur du texte et des icônes' }}
          </p>
          <div class="grid grid-cols-9 gap-1">
            <button
              v-for="swatch in PALETTE"
              :key="swatch.id"
              type="button"
              class="aspect-square rounded border transition hover:scale-110"
              :class="style.color === swatch.hex ? 'border-accent ring-1 ring-accent' : 'border-line'"
              :style="{ background: swatch.hex }"
              :title="swatch.label"
              :aria-label="swatch.label"
              @click="draw.setStyle(selectedConnector ? { color: swatch.hex, stroke: swatch.hex } : { color: swatch.hex })"
            />
          </div>
        </section>

        <section v-if="!selectedConnector" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Remplissage</p>
            <div class="flex gap-1">
              <button
                v-for="mode in (['doux', 'plein'] as const)"
                :key="mode"
                type="button"
                class="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase transition"
                :class="fillMode === mode ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-raised'"
                @click="fillMode = mode"
              >{{ mode }}</button>
              <button
                type="button"
                class="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-dim transition hover:bg-raised"
                title="Aucun remplissage"
                @click="draw.setStyle({ fill: 'none' })"
              >aucun</button>
            </div>
          </div>
          <div class="grid grid-cols-9 gap-1">
            <button
              v-for="swatch in PALETTE"
              :key="swatch.id"
              type="button"
              class="aspect-square rounded border border-line transition hover:scale-110"
              :style="{ background: fillMode === 'doux' ? soften(swatch.hex) : swatch.hex }"
              :title="swatch.label"
              :aria-label="swatch.label"
              @click="applyFill(swatch.hex)"
            />
          </div>
        </section>

        <section v-if="!selectedConnector" class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Contour</p>
          <div class="grid grid-cols-9 gap-1">
            <button
              v-for="swatch in PALETTE"
              :key="swatch.id"
              type="button"
              class="aspect-square rounded border transition hover:scale-110"
              :class="style.stroke === swatch.hex ? 'border-accent ring-1 ring-accent' : 'border-line'"
              :style="{ background: swatch.hex }"
              :title="swatch.label"
              :aria-label="swatch.label"
              @click="draw.setStyle({ stroke: swatch.hex, strokeWidth: Math.max(1, style.strokeWidth) })"
            />
          </div>
        </section>

        <section class="space-y-1.5">
          <div class="flex items-center justify-between">
            <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Épaisseur</p>
            <span class="font-mono text-[10px] text-ink-dim">{{ style.strokeWidth }} px</span>
          </div>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            :value="style.strokeWidth"
            class="w-full accent-[var(--t-accent)]"
            @input="draw.setStyle({ strokeWidth: Number(($event.target as HTMLInputElement).value) })"
          >
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="item in DASHES"
              :key="item.id"
              type="button"
              class="flex h-7 items-center justify-center rounded-md border transition"
              :class="style.dash === item.id
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-accent hover:text-accent'"
              :title="item.label"
              @click="draw.setStyle({ dash: item.id })"
            >
              <UIcon :name="item.icon" class="size-3.5" />
            </button>
          </div>
        </section>

        <section class="space-y-1.5">
          <div class="flex items-center justify-between">
            <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Texte</p>
            <span class="font-mono text-[10px] text-ink-dim">{{ style.fontSize }} px</span>
          </div>
          <input
            type="range"
            min="10"
            max="64"
            step="1"
            :value="style.fontSize"
            class="w-full accent-[var(--t-accent)]"
            @input="draw.setStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
          >
          <div class="flex gap-1">
            <button
              type="button"
              class="flex h-7 flex-1 items-center justify-center rounded-md border transition"
              :class="style.bold
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-accent hover:text-accent'"
              title="Gras"
              @click="draw.setStyle({ bold: !style.bold })"
            >
              <UIcon name="i-lucide-bold" class="size-3.5" />
            </button>
            <button
              v-for="item in ALIGNS"
              :key="item.id"
              type="button"
              class="flex h-7 flex-1 items-center justify-center rounded-md border transition"
              :class="style.align === item.id
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-accent hover:text-accent'"
              :title="item.label"
              @click="draw.setStyle({ align: item.id })"
            >
              <UIcon :name="item.icon" class="size-3.5" />
            </button>
          </div>
        </section>

        <section v-if="!selectedConnector" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Coins arrondis</p>
            <span class="font-mono text-[10px] text-ink-dim">{{ style.radius }} px</span>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="2"
            :value="style.radius"
            class="w-full accent-[var(--t-accent)]"
            @input="draw.setStyle({ radius: Number(($event.target as HTMLInputElement).value) })"
          >
        </section>

        <section class="space-y-1.5">
          <div class="flex items-center justify-between">
            <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Opacité</p>
            <span class="font-mono text-[10px] text-ink-dim">{{ Math.round(style.opacity * 100) }} %</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            :value="Math.round(style.opacity * 100)"
            class="w-full accent-[var(--t-accent)]"
            @input="draw.setStyle({ opacity: Number(($event.target as HTMLInputElement).value) / 100 })"
          >
        </section>

        <!-- ------------------------------------------------- Disposition -->
        <section v-if="selectedShapes.length" class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Superposition</p>
          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="item in ORDERS"
              :key="item.id"
              type="button"
              class="flex h-7 items-center justify-center rounded-md border border-line text-ink-muted transition hover:border-accent hover:text-accent"
              :title="item.label"
              @click="draw.reorder(item.id)"
            >
              <UIcon :name="item.icon" class="size-3.5" />
            </button>
          </div>
        </section>

        <section v-if="selectedShapes.length > 1" class="space-y-1.5">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Alignement</p>
          <div class="grid grid-cols-6 gap-1">
            <button
              v-for="item in ALIGNMENTS"
              :key="item.id"
              type="button"
              class="flex h-7 items-center justify-center rounded-md border border-line text-ink-muted transition hover:border-accent hover:text-accent"
              :title="item.label"
              @click="draw.align(item.id)"
            >
              <UIcon :name="item.icon" class="size-3.5" />
            </button>
          </div>
          <div v-if="selectedShapes.length > 2" class="grid grid-cols-2 gap-1">
            <UButton
              icon="i-lucide-columns-3"
              color="neutral"
              variant="outline"
              size="xs"
              label="Répartir"
              title="Écarts égaux à l'horizontale"
              @click="draw.distribute('x')"
            />
            <UButton
              icon="i-lucide-rows-3"
              color="neutral"
              variant="outline"
              size="xs"
              label="Répartir"
              title="Écarts égaux à la verticale"
              @click="draw.distribute('y')"
            />
          </div>
        </section>

        <!-- --------------------------------------------------- Actions -->
        <section class="grid grid-cols-2 gap-1.5 border-t border-line pt-3">
          <UButton
            v-if="selectedShapes.length"
            :icon="locked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
            color="neutral"
            variant="outline"
            size="xs"
            :label="locked ? 'Déverrouiller' : 'Verrouiller'"
            title="Un élément verrouillé ne se déplace plus"
            @click="draw.toggleLock()"
          />
          <UButton
            v-if="selectedShapes.length"
            icon="i-lucide-copy"
            color="neutral"
            variant="outline"
            size="xs"
            label="Dupliquer"
            @click="draw.duplicate()"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            size="xs"
            label="Supprimer"
            class="col-span-2"
            @click="draw.removeSelection()"
          />
        </section>
      </template>
    </div>
  </div>
</template>
