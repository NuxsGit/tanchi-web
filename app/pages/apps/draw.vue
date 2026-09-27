<script setup lang="ts">
import { DRAW_TEMPLATES } from '~~/shared/draw/templates'
import { GRID } from '~~/shared/draw/model'
import type { DrawTool } from '~/composables/useDraw'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'TanchiDraw — Tanchi Web' })

const draw = useDraw()
const {
  title, pages, page, pageIndex, activePageId, loaded, tool, pendingIcon,
  scope, teamId, conflict, savedLabel, snapping, libraryOpen, inspectorOpen,
  fullscreen, presenting, canUndo, canRedo, selectedIds, viewport
} = draw

const canvas = ref<{ host?: HTMLElement, surface?: SVGSVGElement } | null>(null)
const fileInput = ref<HTMLInputElement>()

const { teams, ensure } = useTeams()

onMounted(async () => {
  await Promise.all([draw.load(), draw.ensureIcons(), ensure()])
  await nextTick()
  fitPage()
})

/** Cadre la planche entière dans la zone de travail. */
function fitPage() {
  const rect = canvas.value?.host?.getBoundingClientRect()
  if (rect) draw.fitPage(rect.width, rect.height)
}

function fitContent() {
  const rect = canvas.value?.host?.getBoundingClientRect()
  if (rect) draw.fitContent(rect.width, rect.height)
}

/* -------------------------------------------------------- Partage */

const scopeItems = computed(() => [
  { label: 'Personnel', value: 'user' },
  ...teams.value.map(team => ({ label: `Équipe · ${team.name}`, value: `team:${team.id}` }))
])

const scopeModel = computed({
  get: () => (scope.value === 'team' && teamId.value ? `team:${teamId.value}` : 'user'),
  set: (value: string) => {
    if (value === 'user') return void draw.switchScope('user')
    void draw.switchScope('team', Number(value.split(':')[1]))
  }
})

/* --------------------------------------------------- Autosauvegarde */

let timer: ReturnType<typeof setTimeout> | undefined

watch([pages, title], () => {
  if (!loaded.value) return
  clearTimeout(timer)
  timer = setTimeout(() => draw.save(), 1200)
}, { deep: true })

onBeforeUnmount(() => clearTimeout(timer))

/* --------------------------------------------------------- Outils */

const TOOLS: { id: DrawTool, label: string, icon: string, key: string }[] = [
  { id: 'select', label: 'Sélection', icon: 'i-lucide-mouse-pointer-2', key: 'V' },
  { id: 'hand', label: 'Déplacer la planche', icon: 'i-lucide-hand', key: 'H' },
  { id: 'arrow', label: 'Flèche', icon: 'i-lucide-move-right', key: 'F' },
  { id: 'text', label: 'Texte', icon: 'i-lucide-type', key: 'T' },
  { id: 'rect', label: 'Rectangle', icon: 'i-lucide-square', key: 'R' },
  { id: 'ellipse', label: 'Ellipse', icon: 'i-lucide-circle', key: 'O' },
  { id: 'zone', label: 'Zone', icon: 'i-lucide-square-dashed', key: 'Z' },
  { id: 'note', label: 'Post-it', icon: 'i-lucide-sticky-note', key: 'N' }
]

function pick(next: DrawTool) {
  tool.value = tool.value === next && next !== 'select' ? 'select' : next
  if (next !== 'icon') pendingIcon.value = null
}

/* -------------------------------------------------------- Export */

const exportItems = computed(() => [
  [
    {
      label: 'Image PNG — planche affichée',
      icon: 'i-lucide-image',
      onSelect: () => canvas.value?.surface && draw.exportPng(canvas.value.surface)
    },
    {
      label: `Images PNG — les ${pages.value.length} planches`,
      icon: 'i-lucide-images',
      onSelect: () => canvas.value?.surface && draw.exportAllPng(canvas.value.surface)
    },
    {
      label: 'Vectoriel SVG — planche affichée',
      icon: 'i-lucide-shapes',
      onSelect: () => canvas.value?.surface && draw.exportSvg(canvas.value.surface)
    }
  ],
  [
    {
      label: 'Fichier TanchiDraw (JSON)',
      icon: 'i-lucide-file-json',
      onSelect: () => draw.exportJson()
    }
  ]
])

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await draw.importJson(file)
}

/* --------------------------------------------------- Présentation */

async function startPresenting() {
  presenting.value = true
  fullscreen.value = true

  try {
    await document.documentElement.requestFullscreen?.()
  } catch {
    // Le mode plein écran du navigateur peut être refusé : l'affichage en
    // surimpression suffit à présenter.
  }

  await nextTick()
  fitPage()
}

async function stopPresenting() {
  presenting.value = false
  fullscreen.value = false

  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    // Sans importance : on est déjà revenu à l'atelier.
  }

  await nextTick()
  fitPage()
}

function step(direction: -1 | 1) {
  draw.goToPage(pageIndex.value + direction)
  if (presenting.value) nextTick(fitPage)
}

/* --------------------------------------------------------- Modèles */

const templatesOpen = ref(false)
const templateMode = ref<'newPage' | 'append'>('newPage')

function applyTemplate(id: string) {
  draw.applyTemplate(id, templateMode.value)
  templatesOpen.value = false
  nextTick(fitPage)
}

/* ------------------------------------------------------ Raccourcis */

const shortcutsOpen = ref(false)

const SHORTCUTS = [
  { keys: ['V'], label: 'Outil sélection' },
  { keys: ['H'], label: 'Déplacer la planche' },
  { keys: ['F'], label: 'Tracer une flèche' },
  { keys: ['T'], label: 'Zone de texte' },
  { keys: ['R'], label: 'Rectangle' },
  { keys: ['O'], label: 'Ellipse' },
  { keys: ['Z'], label: 'Zone (site, VLAN…)' },
  { keys: ['N'], label: 'Post-it' },
  { keys: ['Double-clic'], label: 'Écrire dans une forme' },
  { keys: ['Glisser', 'point bleu'], label: 'Relier deux éléments' },
  { keys: ['Maj', 'clic'], label: 'Étendre la sélection' },
  { keys: ['Ctrl', 'Z'], label: 'Annuler' },
  { keys: ['Ctrl', 'Y'], label: 'Rétablir' },
  { keys: ['Ctrl', 'C'], label: 'Copier' },
  { keys: ['Ctrl', 'V'], label: 'Coller' },
  { keys: ['Ctrl', 'D'], label: 'Dupliquer' },
  { keys: ['Ctrl', 'A'], label: 'Tout sélectionner' },
  { keys: ['Ctrl', 'S'], label: 'Enregistrer' },
  { keys: ['Suppr'], label: 'Supprimer la sélection' },
  { keys: ['←↑↓→'], label: 'Déplacer de 10 px' },
  { keys: ['Maj', '←↑↓→'], label: 'Déplacer de 50 px' },
  { keys: ['Ctrl', '1'], label: 'Ajuster la planche' },
  { keys: ['Ctrl', '2'], label: 'Ajuster le contenu' },
  { keys: ['Ctrl', '0'], label: 'Zoom 100 %' },
  { keys: ['Ctrl', 'molette'], label: 'Zoomer' },
  { keys: ['Molette'], label: 'Défiler' },
  { keys: ['Clic milieu'], label: 'Déplacer la planche' },
  { keys: ['P'], label: 'Mode présentation' },
  { keys: ['Page ↑', 'Page ↓'], label: 'Planche précédente / suivante' },
  { keys: ['?'], label: 'Cette aide' }
]

const TOOL_KEYS: Record<string, DrawTool> = {
  v: 'select', h: 'hand', f: 'arrow', t: 'text', r: 'rect', o: 'ellipse', z: 'zone', n: 'note'
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const inField = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable

  if (event.key === 'Escape') {
    if (presenting.value) return void stopPresenting()
    if (shortcutsOpen.value || templatesOpen.value) {
      shortcutsOpen.value = false
      templatesOpen.value = false
      return
    }
    draw.clearSelection()
    return
  }

  // En présentation, seule la navigation répond.
  if (presenting.value) {
    if ([' ', 'ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(event.key)) {
      event.preventDefault()
      step(1)
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) {
      event.preventDefault()
      step(-1)
    }
    return
  }

  if (inField) return

  const mod = event.ctrlKey || event.metaKey

  if (mod) {
    switch (event.key.toLowerCase()) {
      case 'z': event.preventDefault(); event.shiftKey ? draw.redo() : draw.undo(); return
      case 'y': event.preventDefault(); draw.redo(); return
      case 'c': event.preventDefault(); draw.copy(); return
      case 'x': event.preventDefault(); draw.cut(); return
      case 'v': event.preventDefault(); draw.paste(); return
      case 'd': event.preventDefault(); draw.duplicate(); return
      case 'a': event.preventDefault(); draw.selectAll(); return
      case 's': event.preventDefault(); void draw.save(false); return
      case '0': event.preventDefault(); viewport.value = { ...viewport.value, scale: 1 }; return
      case '1': event.preventDefault(); fitPage(); return
      case '2': event.preventDefault(); fitContent(); return
      case '+': case '=': event.preventDefault(); draw.zoomBy(1.2); return
      case '-': event.preventDefault(); draw.zoomBy(1 / 1.2); return
    }
    return
  }

  const nudge = event.shiftKey ? GRID * 5 : GRID
  const arrows: Record<string, [number, number]> = {
    ArrowUp: [0, -nudge], ArrowDown: [0, nudge], ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0]
  }

  if (arrows[event.key] && selectedIds.value.length) {
    event.preventDefault()
    draw.moveSelection(...arrows[event.key]!)
    return
  }

  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      event.preventDefault()
      draw.removeSelection()
      return
    case 'PageDown': event.preventDefault(); step(1); return
    case 'PageUp': event.preventDefault(); step(-1); return
    case '?': shortcutsOpen.value = true; return
  }

  const key = event.key.toLowerCase()
  if (TOOL_KEYS[key]) {
    pick(TOOL_KEYS[key]!)
    return
  }
  if (key === 'p') void startPresenting()
  if (key === 'g') draw.toggleGrid()
  if (key === 'l') draw.connectSelection()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

/* La planche suit la fenêtre : sortir du plein écran ne doit rien décadrer. */
function onResize() {
  if (presenting.value) fitPage()
}

onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const renaming = ref(false)
</script>

<template>
  <div
    class="flex flex-col gap-2"
    :class="fullscreen ? 'fixed inset-0 z-50 bg-canvas p-2' : 'h-[calc(100vh-6.5rem)]'"
  >
    <!-- Barre d'outils : masquée en présentation, l'écran est au client -->
    <header
      v-if="!presenting"
      class="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5"
    >
      <NuxtLink to="/apps" class="flex items-center gap-1.5 text-ink-dim transition hover:text-ink" title="Retour aux applications">
        <UIcon name="i-lucide-pen-tool" class="size-4 text-accent" />
        <span class="font-mono text-[11px] uppercase tracking-wider">draw</span>
      </NuxtLink>

      <div class="h-4 w-px bg-line" />

      <UInput
        v-if="renaming"
        v-model="title"
        size="xs"
        autofocus
        class="w-52"
        @blur="renaming = false"
        @keydown.enter="renaming = false"
      />
      <button
        v-else
        type="button"
        class="max-w-52 truncate rounded px-1.5 py-0.5 text-sm font-medium text-ink transition hover:bg-raised"
        title="Renommer la présentation"
        @click="renaming = true"
      >
        {{ title }}
      </button>

      <div class="h-4 w-px bg-line" />

      <!-- Outils de tracé -->
      <div class="flex items-center gap-0.5">
        <button
          v-for="item in TOOLS"
          :key="item.id"
          type="button"
          class="flex size-7 items-center justify-center rounded-md transition"
          :class="tool === item.id ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-raised hover:text-ink'"
          :title="`${item.label} (${item.key})`"
          :aria-label="item.label"
          @click="pick(item.id)"
        >
          <UIcon :name="item.icon" class="size-4" />
        </button>
      </div>

      <div class="h-4 w-px bg-line" />

      <UButton
        icon="i-lucide-undo-2" color="neutral" variant="ghost" size="xs"
        :disabled="!canUndo" aria-label="Annuler" title="Annuler (Ctrl+Z)" @click="draw.undo()"
      />
      <UButton
        icon="i-lucide-redo-2" color="neutral" variant="ghost" size="xs"
        :disabled="!canRedo" aria-label="Rétablir" title="Rétablir (Ctrl+Y)" @click="draw.redo()"
      />
      <UButton
        icon="i-lucide-spline" color="neutral" variant="ghost" size="xs"
        :disabled="selectedIds.length < 2" aria-label="Relier la sélection"
        title="Relier la sélection au premier élément (L)" @click="draw.connectSelection()"
      />

      <div class="h-4 w-px bg-line" />

      <UButton
        icon="i-lucide-scan" color="neutral" variant="ghost" size="xs"
        aria-label="Ajuster la planche" title="Ajuster la planche (Ctrl+1)" @click="fitPage"
      />
      <UButton
        icon="i-lucide-maximize" color="neutral" variant="ghost" size="xs"
        aria-label="Ajuster au contenu" title="Ajuster au contenu (Ctrl+2)" @click="fitContent"
      />
      <button
        type="button"
        class="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition hover:bg-raised"
        :class="snapping ? 'text-accent' : 'text-ink-dim'"
        title="Aimanter sur la trame"
        @click="snapping = !snapping"
      >
        <UIcon name="i-lucide-grid-2x2" class="size-3.5" />
        {{ snapping ? 'aimant' : 'libre' }}
      </button>

      <span class="font-mono text-[11px] text-ink-dim">
        {{ page.shapes.length }} objets · {{ page.connectors.length }} flèches
      </span>

      <div class="ml-auto flex items-center gap-1.5">
        <span class="hidden font-mono text-[10px] text-ink-dim lg:block">{{ savedLabel }}</span>
        <USelect v-model="scopeModel" :items="scopeItems" icon="i-lucide-users" size="xs" class="w-36" />

        <UButton
          icon="i-lucide-upload" color="neutral" variant="ghost" size="xs"
          aria-label="Importer" title="Importer une présentation JSON" @click="fileInput?.click()"
        />
        <UDropdownMenu :items="exportItems" :popper="{ placement: 'bottom-end' }">
          <UButton icon="i-lucide-download" color="neutral" variant="ghost" size="xs" aria-label="Exporter" title="Exporter" />
        </UDropdownMenu>
        <UButton
          icon="i-lucide-save" color="neutral" variant="ghost" size="xs"
          aria-label="Enregistrer" title="Enregistrer (Ctrl+S)" @click="draw.save(false)"
        />

        <UButton
          icon="i-lucide-presentation" color="primary" variant="soft" size="xs"
          label="Présenter" title="Présenter plein écran (P)" @click="startPresenting"
        />
        <UButton
          :icon="fullscreen ? 'i-lucide-minimize-2' : 'i-lucide-expand'"
          color="neutral" variant="ghost" size="xs"
          :aria-label="fullscreen ? 'Quitter le plein écran' : 'Plein écran'"
          @click="fullscreen = !fullscreen"
        />
        <UButton
          :icon="inspectorOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
          color="neutral" variant="ghost" size="xs"
          :aria-label="inspectorOpen ? 'Replier les réglages' : 'Afficher les réglages'"
          title="Panneau de réglage"
          @click="inspectorOpen = !inspectorOpen"
        />
        <UButton
          icon="i-lucide-keyboard" color="neutral" variant="ghost" size="xs"
          aria-label="Raccourcis clavier" title="Raccourcis (?)" @click="shortcutsOpen = true"
        />
      </div>
    </header>

    <UAlert
      v-if="conflict && !presenting"
      color="warning"
      variant="subtle"
      icon="i-lucide-git-merge"
      title="Modifié par un coéquipier"
      :description="`${conflict.updatedBy ?? 'Quelqu\'un'} a enregistré cette présentation pendant votre édition.`"
      :ui="{ root: 'shrink-0' }"
    >
      <template #actions>
        <UButton size="xs" color="warning" label="Reprendre leur version" @click="draw.acceptRemote()" />
        <UButton size="xs" color="neutral" variant="outline" label="Imposer la mienne" @click="draw.overwriteRemote()" />
      </template>
    </UAlert>

    <!-- Espace de travail -->
    <div
      class="relative flex min-h-0 flex-1 overflow-hidden"
      :class="presenting ? '' : 'rounded-lg border border-line'"
    >
      <!-- Réglages, à gauche : on lit de gauche à droite, on règle puis on dessine -->
      <aside
        v-if="inspectorOpen && !presenting"
        class="hidden w-72 shrink-0 border-r border-line bg-surface lg:block"
      >
        <DrawInspector />
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <DrawCanvas ref="canvas" />

        <!-- Bande des planches : l'ordre de la présentation -->
        <div v-if="!presenting" class="flex shrink-0 items-center gap-1 border-t border-line bg-surface px-2 py-1.5">
          <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <button
              v-for="(item, index) in pages"
              :key="item.id"
              type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left transition"
              :class="item.id === activePageId
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-accent/50 hover:text-ink'"
              :title="`${item.shapes.length} objets`"
              @click="draw.goToPage(index)"
            >
              <span class="font-mono text-[10px] opacity-70">{{ index + 1 }}</span>
              <span class="max-w-32 truncate text-xs">{{ item.name }}</span>
            </button>
          </div>

          <div class="flex shrink-0 items-center gap-0.5 border-l border-line pl-1">
            <UButton
              icon="i-lucide-plus" color="neutral" variant="ghost" size="xs"
              aria-label="Nouvelle planche" title="Nouvelle planche" @click="draw.addPage()"
            />
            <UButton
              icon="i-lucide-copy-plus" color="neutral" variant="ghost" size="xs"
              aria-label="Dupliquer la planche" title="Dupliquer la planche" @click="draw.duplicatePage()"
            />
            <UButton
              icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs"
              :disabled="pageIndex === 0" aria-label="Reculer la planche"
              title="Déplacer vers la gauche" @click="draw.movePage(activePageId, -1)"
            />
            <UButton
              icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs"
              :disabled="pageIndex === pages.length - 1" aria-label="Avancer la planche"
              title="Déplacer vers la droite" @click="draw.movePage(activePageId, 1)"
            />
            <UButton
              icon="i-lucide-trash-2" color="neutral" variant="ghost" size="xs"
              :disabled="pages.length === 1" aria-label="Supprimer la planche"
              title="Supprimer la planche" @click="draw.removePage(activePageId)"
            />
          </div>
        </div>
      </div>

      <DrawLibrary v-if="!presenting" @templates="templatesOpen = true" />

      <!-- Commandes de présentation : discrètes, elles s'effacent devant la planche -->
      <div
        v-if="presenting"
        class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-surface/80 px-2 py-1 opacity-30 backdrop-blur transition hover:opacity-100"
      >
        <UButton
          icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs"
          :disabled="pageIndex === 0" aria-label="Planche précédente" @click="step(-1)"
        />
        <span class="font-mono text-[11px] text-ink-muted">{{ pageIndex + 1 }} / {{ pages.length }}</span>
        <UButton
          icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs"
          :disabled="pageIndex === pages.length - 1" aria-label="Planche suivante" @click="step(1)"
        />
        <div class="mx-1 h-4 w-px bg-line" />
        <UButton
          icon="i-lucide-x" color="neutral" variant="ghost" size="xs"
          label="Quitter" title="Quitter la présentation (Échap)" @click="stopPresenting"
        />
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onImport"
    >

    <!-- Modèles de planches -->
    <UModal v-model:open="templatesOpen" title="Modèles de planches" :ui="{ content: 'max-w-3xl' }">
      <template #body>
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="text-sm text-ink-muted">
            Des architectures complètes, légendées et prêtes à renommer avec les
            équipements du client.
          </p>
          <USelect
            v-model="templateMode"
            :items="[
              { label: 'Nouvelle planche', value: 'newPage' },
              { label: 'Ajouter à la planche', value: 'append' }
            ]"
            size="sm"
            class="w-48 shrink-0"
          />
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="template in DRAW_TEMPLATES"
            :key="template.id"
            type="button"
            class="rounded-lg border border-line bg-surface p-3 text-left transition hover:border-accent/60"
            @click="applyTemplate(template.id)"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="template.icon" class="size-4 shrink-0 text-accent" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ template.label }}</span>
              <span class="shrink-0 font-mono text-[10px] text-ink-dim">
                {{ template.spots.length }}·{{ template.wires.length }}
              </span>
            </div>
            <p class="mt-1.5 text-xs leading-relaxed text-ink-muted">{{ template.description }}</p>
            <p class="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
              {{ template.audience }}
            </p>
          </button>
        </div>
      </template>
    </UModal>

    <!-- Raccourcis clavier -->
    <UModal v-model:open="shortcutsOpen" title="Raccourcis clavier" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <div
            v-for="shortcut in SHORTCUTS"
            :key="shortcut.label"
            class="flex items-center justify-between gap-3 border-b border-line py-1"
          >
            <span class="text-xs text-ink-muted">{{ shortcut.label }}</span>
            <span class="flex shrink-0 items-center gap-0.5">
              <kbd
                v-for="key in shortcut.keys"
                :key="key"
                class="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-ink"
              >{{ key }}</kbd>
            </span>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
