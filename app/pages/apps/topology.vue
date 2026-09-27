<script setup lang="ts">
import { NODE_HEIGHT, NODE_WIDTH } from '~~/shared/topology/model'
import { CATEGORY_ICONS, CATEGORY_LABELS, type DiagCategory } from '~~/shared/topology/diagnostics'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'TopologyBoard — Tanchi Web' })

const topo = useTopology()
const {
  boards, activeBoardId, board, loaded, report,
  scope, teamId, conflict, savedLabel, selectedNodeId, selectedIds, selectedLinkId,
  dockOpen, diagnosticsOpen, fullscreen, canUndo, canRedo
} = topo

const fileInput = ref<HTMLInputElement>()

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await topo.importJson(file)
}

const { teams, ensure } = useTeams()

onMounted(async () => {
  await Promise.all([topo.load(), ensure()])
})

/* -------------------------------------------------------- Partage */

const scopeItems = computed(() => [
  { label: 'Personnel', value: 'user' },
  ...teams.value.map(team => ({ label: `Équipe · ${team.name}`, value: `team:${team.id}` }))
])

const scopeModel = computed({
  get: () => (scope.value === 'team' && teamId.value ? `team:${teamId.value}` : 'user'),
  set: (value: string) => {
    if (value === 'user') return void topo.switchScope('user')
    void topo.switchScope('team', Number(value.split(':')[1]))
  }
})

const boardItems = computed(() =>
  boards.value.map(item => ({ label: `${item.name} (${item.nodes.length})`, value: item.id }))
)

const boardModel = computed({
  get: () => activeBoardId.value,
  set: (value: string) => {
    activeBoardId.value = value
    selectedNodeId.value = null
  }
})

/* --------------------------------------------------- Autosauvegarde */

let timer: ReturnType<typeof setTimeout> | undefined

watch(boards, () => {
  if (!loaded.value) return
  clearTimeout(timer)
  timer = setTimeout(() => topo.save(), 900)
}, { deep: true })

onBeforeUnmount(() => clearTimeout(timer))

/* ------------------------------------------------------ Raccourcis */

const canvas = ref<{ surface?: HTMLElement } | null>(null)

/** Raccourcis du plateau. Ignorés dès qu'une saisie a le focus. */
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const inField = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable

  if (event.key === 'Escape') {
    topo.clearSelection()
    shortcutsOpen.value = false
    return
  }

  if (inField) return

  const mod = event.ctrlKey || event.metaKey
  const step = event.shiftKey ? 80 : 20

  // Déplacement de la sélection au clavier
  const arrows: Record<string, [number, number]> = {
    ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0]
  }
  if (arrows[event.key] && selectedIds.value.length) {
    event.preventDefault()
    topo.nudge(...arrows[event.key]!)
    return
  }

  if (mod) {
    switch (event.key.toLowerCase()) {
      case 'z':
        event.preventDefault()
        event.shiftKey ? topo.redo() : topo.undo()
        return
      case 'y': event.preventDefault(); topo.redo(); return
      case 'c': event.preventDefault(); topo.copy(); return
      case 'x': event.preventDefault(); topo.cut(); return
      case 'v': event.preventDefault(); topo.paste(); return
      case 'd': event.preventDefault(); topo.duplicateSelection(); return
      case 'a': event.preventDefault(); topo.selectAll(); return
      case 's': event.preventDefault(); topo.save(false); return
      case '0': event.preventDefault(); topo.resetView(); return
      case '+': case '=': event.preventDefault(); topo.zoomBy(1.2); return
      case '-': event.preventDefault(); topo.zoomBy(1 / 1.2); return
    }
    return
  }

  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      if (selectedLinkId.value) {
        event.preventDefault()
        topo.removeLink(selectedLinkId.value)
        topo.selectLink(null)
      } else if (selectedIds.value.length) {
        event.preventDefault()
        topo.removeSelection()
      }
      return
    case 'l': case 'L':
      if (selectedIds.value.length === 1) topo.startLink(selectedIds.value[0]!)
      else topo.linkSelection()
      return
    case 'f': case 'F': {
      const rect = canvas.value?.surface?.getBoundingClientRect()
      if (rect) topo.fitToContent(rect.width, rect.height)
      return
    }
    case 'g': case 'G': modelsOpen.value = true; return
    case 'r': case 'R': runRepair(); return
    case 'p': case 'P': dockOpen.value = !dockOpen.value; return
    case 'e': case 'E': diagnosticsOpen.value = !diagnosticsOpen.value; return
    case 'z': case 'Z': fullscreen.value = !fullscreen.value; return
    case '?': shortcutsOpen.value = true; return
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

const shortcutsOpen = ref(false)

const SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], label: 'Annuler' },
  { keys: ['Ctrl', 'Y'], label: 'Rétablir' },
  { keys: ['Ctrl', 'C'], label: 'Copier la sélection' },
  { keys: ['Ctrl', 'X'], label: 'Couper' },
  { keys: ['Ctrl', 'V'], label: 'Coller' },
  { keys: ['Ctrl', 'D'], label: 'Dupliquer' },
  { keys: ['Ctrl', 'A'], label: 'Tout sélectionner' },
  { keys: ['Ctrl', 'S'], label: 'Enregistrer' },
  { keys: ['Suppr'], label: 'Supprimer la sélection' },
  { keys: ['Maj', 'clic'], label: 'Étendre la sélection' },
  { keys: ['←↑↓→'], label: 'Déplacer de 20 px' },
  { keys: ['Maj', '←↑↓→'], label: 'Déplacer de 80 px' },
  { keys: ['L'], label: 'Relier depuis la sélection' },
  { keys: ['F'], label: 'Recadrer sur le contenu' },
  { keys: ['G'], label: 'Générer un modèle' },
  { keys: ['R'], label: 'Régler le schéma' },
  { keys: ['P'], label: 'Afficher ou replier le dock' },
  { keys: ['E'], label: 'Afficher les diagnostics' },
  { keys: ['Z'], label: 'Mode plein écran' },
  { keys: ['Ctrl', '0'], label: 'Réinitialiser la vue' },
  { keys: ['Ctrl', 'molette'], label: 'Zoomer' },
  { keys: ['Molette'], label: 'Défiler le plan' },
  { keys: ['Clic milieu'], label: 'Déplacer le plan' },
  { keys: ['Clic'], label: 'Sélectionner un câble' },
  { keys: ['Alt', 'glisser'], label: 'Déplacer le plan' },
  { keys: ['Glisser'], label: 'Rectangle de sélection' },
  { keys: ['?'], label: 'Cette aide' }
]

/** Dépose au centre approximatif du plateau, pour le double-clic du dock. */
function placeCentered(typeId: string) {
  const count = board.value.nodes.length
  topo.addNode(typeId, 240 + (count % 6) * (NODE_WIDTH + 40), 140 + Math.floor(count / 6) * (NODE_HEIGHT + 60))
}

const renaming = ref(false)
const draftName = ref('')

function startRename() {
  renaming.value = true
  draftName.value = board.value.name
}

function commitRename() {
  topo.renameBoard(activeBoardId.value, draftName.value)
  renaming.value = false
}

/* ------------------------------------------------------- Correction */

const repairMode = ref<'newBoard' | 'inPlace'>('newBoard')

function runRepair() {
  topo.analyseRepair()
}

/** Changements regroupés par domaine, pour un compte rendu lisible. */
const repairGroups = computed(() => {
  const changes = topo.repair.value?.changes ?? []
  const groups = new Map<DiagCategory, typeof changes>()
  for (const change of changes) {
    groups.set(change.category, [...(groups.get(change.category) ?? []), change])
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
})

/* --------------------------------------------------------- Modèles */

const modelsOpen = ref(false)
const modelMode = ref<'append' | 'newBoard'>('append')

function generate(id: string) {
  topo.generate(id, modelMode.value)
  modelsOpen.value = false
}

function fit() {
  const rect = canvas.value?.surface?.getBoundingClientRect()
  if (rect) topo.fitToContent(rect.width, rect.height)
}

const scoreColor = computed(() => {
  if (report.value.score >= 85) return 'text-success-500'
  if (report.value.score >= 60) return 'text-warning-500'
  return 'text-error-500'
})
</script>

<template>
  <!-- Barre d'outils compacte : tout l'espace restant va au plateau -->
  <div
    class="flex flex-col gap-2"
    :class="fullscreen ? 'fixed inset-0 z-50 bg-canvas p-2' : 'h-[calc(100vh-6.5rem)]'"
  >
    <header class="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5">
      <NuxtLink to="/apps" class="flex items-center gap-1.5 text-ink-dim transition hover:text-ink" title="Retour aux applications">
        <UIcon name="i-lucide-network" class="size-4 text-accent" />
        <span class="font-mono text-[11px] uppercase tracking-wider">topology</span>
      </NuxtLink>

      <div class="h-4 w-px bg-line" />

      <UInput
        v-if="renaming"
        v-model="draftName"
        size="xs"
        autofocus
        class="w-40"
        @blur="commitRename"
        @keydown.enter="commitRename"
      />
      <USelect v-else v-model="boardModel" :items="boardItems" size="xs" class="w-44" />

      <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" aria-label="Renommer le plan" @click="startRename" />
      <UButton icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" aria-label="Nouveau plan" @click="topo.addBoard()" />
      <UButton
        icon="i-lucide-wand-sparkles"
        color="primary"
        variant="soft"
        size="xs"
        label="Générer un modèle"
        @click="modelsOpen = true"
      />
      <UButton
        icon="i-lucide-wrench"
        color="warning"
        variant="soft"
        size="xs"
        label="Régler le schéma"
        title="Corriger automatiquement ce qui peut l'être (R)"
        @click="runRepair"
      />
      <UButton
        v-if="boards.length > 1"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Supprimer le plan"
        @click="topo.removeBoard(activeBoardId)"
      />

      <div class="h-4 w-px bg-line" />

      <UButton
        icon="i-lucide-undo-2" color="neutral" variant="ghost" size="xs"
        :disabled="!canUndo" aria-label="Annuler" title="Annuler (Ctrl+Z)" @click="topo.undo()"
      />
      <UButton
        icon="i-lucide-redo-2" color="neutral" variant="ghost" size="xs"
        :disabled="!canRedo" aria-label="Rétablir" title="Rétablir (Ctrl+Y)" @click="topo.redo()"
      />
      <UButton
        icon="i-lucide-copy" color="neutral" variant="ghost" size="xs"
        :disabled="!selectedIds.length" aria-label="Copier" title="Copier (Ctrl+C)" @click="topo.copy()"
      />
      <UButton
        icon="i-lucide-clipboard-paste" color="neutral" variant="ghost" size="xs"
        :disabled="!topo.clipboard.value" aria-label="Coller" title="Coller (Ctrl+V)" @click="topo.paste()"
      />
      <UButton
        icon="i-lucide-spline" color="neutral" variant="ghost" size="xs"
        :disabled="selectedIds.length < 2" aria-label="Relier la sélection"
        title="Relier la sélection (L)" @click="topo.linkSelection()"
      />

      <div class="h-4 w-px bg-line" />

      <UButton
        icon="i-lucide-maximize" color="neutral" variant="ghost" size="xs"
        aria-label="Recadrer" title="Recadrer sur le contenu (F)" @click="fit"
      />
      <UButton
        icon="i-lucide-locate-fixed" color="neutral" variant="ghost" size="xs"
        aria-label="Réinitialiser la vue" title="Vue d'origine (Ctrl+0)" @click="topo.resetView()"
      />

      <span class="font-mono text-[11px] text-ink-dim">
        {{ board.nodes.length }} nœuds · {{ board.links.length }} liens
      </span>

      <!-- Santé du plan : bascule le tiroir de diagnostics -->
      <button
        type="button"
        class="flex items-center gap-1.5 rounded px-1.5 py-0.5 transition hover:bg-raised"
        :title="`${report.errors} erreur(s), ${report.warnings} avertissement(s)`"
        @click="diagnosticsOpen = !diagnosticsOpen"
      >
        <UIcon name="i-lucide-stethoscope" class="size-3.5" :class="scoreColor" />
        <span class="font-mono text-[11px]" :class="scoreColor">{{ report.score }}</span>
        <UBadge v-if="report.errors" :label="String(report.errors)" color="error" variant="subtle" size="sm" />
        <UBadge v-if="report.warnings" :label="String(report.warnings)" color="warning" variant="subtle" size="sm" />
      </button>

      <div class="ml-auto flex items-center gap-1.5">
        <span class="hidden font-mono text-[10px] text-ink-dim lg:block">{{ savedLabel }}</span>
        <USelect v-model="scopeModel" :items="scopeItems" icon="i-lucide-users" size="xs" class="w-36" />
        <UButton icon="i-lucide-upload" color="neutral" variant="ghost" size="xs" aria-label="Importer un plan" title="Importer un plan JSON" @click="fileInput?.click()" />
        <UButton icon="i-lucide-download" color="neutral" variant="ghost" size="xs" aria-label="Exporter en JSON" title="Exporter le plan" @click="topo.exportJson()" />
        <UButton icon="i-lucide-save" color="primary" variant="soft" size="xs" aria-label="Enregistrer" title="Enregistrer (Ctrl+S)" @click="topo.save(false)" />
        <UButton
          :icon="fullscreen ? 'i-lucide-minimize-2' : 'i-lucide-expand'"
          color="neutral" variant="ghost" size="xs"
          :aria-label="fullscreen ? 'Quitter le plein écran' : 'Plein écran'"
          title="Plein écran (Z)"
          @click="fullscreen = !fullscreen"
        />
        <UButton
          icon="i-lucide-keyboard" color="neutral" variant="ghost" size="xs"
          aria-label="Raccourcis clavier" title="Raccourcis (?)" @click="shortcutsOpen = true"
        />
      </div>
    </header>

    <UAlert
      v-if="conflict"
      color="warning"
      variant="subtle"
      icon="i-lucide-git-merge"
      title="Modifié par un coéquipier"
      :description="`${conflict.updatedBy ?? 'Quelqu\'un'} a enregistré ce plan pendant votre édition.`"
      :ui="{ root: 'shrink-0' }"
    >
      <template #actions>
        <UButton size="xs" color="warning" label="Reprendre leur version" @click="topo.acceptRemote()" />
        <UButton size="xs" color="neutral" variant="outline" label="Imposer la mienne" @click="topo.overwriteRemote()" />
      </template>
    </UAlert>

    <!-- Plateau : occupe tout le reste -->
    <div class="relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-line">
      <div class="flex min-w-0 flex-1 flex-col">
        <TopologyCanvas ref="canvas" />

        <!-- Diagnostics en tiroir, replié par défaut -->
        <div v-if="diagnosticsOpen" class="h-48 shrink-0 border-t border-line bg-surface">
          <TopologyDiagnostics />
        </div>
      </div>

      <!-- Inspecteur flottant, uniquement quand un composant est sélectionné -->
      <div
        v-if="selectedNodeId || selectedLinkId"
        class="absolute bottom-0 top-0 z-10 w-72 border-l border-line bg-surface shadow-2xl"
        :class="dockOpen ? 'right-64' : 'right-11'"
      >
        <TopologyInspector />
      </div>

      <TopologyDock @pick="placeCentered" />
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onImport"
    >

    <!-- Compte rendu de correction -->
    <UModal
      :open="Boolean(topo.repair.value?.changes.length)"
      title="Corrections proposées"
      :ui="{ content: 'max-w-3xl' }"
      @update:open="value => !value && (topo.repair.value = null)"
    >
      <template #body>
        <div v-if="topo.repair.value" class="space-y-4">
          <!-- Avant / après -->
          <div class="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-3">
            <div>
              <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Santé</p>
              <p class="mt-0.5 flex items-baseline gap-2">
                <span class="text-lg font-semibold text-ink-dim">{{ topo.repair.value.before.score }}</span>
                <UIcon name="i-lucide-arrow-right" class="size-3 text-ink-dim" />
                <span class="text-2xl font-semibold text-success-500">{{ topo.repair.value.after.score }}</span>
                <span class="text-xs text-ink-dim">/100</span>
              </p>
            </div>

            <div class="flex gap-4">
              <div>
                <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Erreurs</p>
                <p class="mt-0.5 font-mono text-sm">
                  <span class="text-ink-dim">{{ topo.repair.value.before.errors }}</span>
                  <span class="text-ink-dim"> → </span>
                  <span :class="topo.repair.value.after.errors ? 'text-error-500' : 'text-success-500'">
                    {{ topo.repair.value.after.errors }}
                  </span>
                </p>
              </div>
              <div>
                <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Avertissements</p>
                <p class="mt-0.5 font-mono text-sm">
                  <span class="text-ink-dim">{{ topo.repair.value.before.warnings }}</span>
                  <span class="text-ink-dim"> → </span>
                  <span class="text-ink">{{ topo.repair.value.after.warnings }}</span>
                </p>
              </div>
            </div>

            <UBadge
              :label="`${topo.repair.value.changes.length} modification(s)`"
              color="primary"
              variant="subtle"
              size="lg"
              class="ml-auto"
            />
          </div>

          <!-- Détail des changements -->
          <div class="max-h-80 space-y-3 overflow-y-auto">
            <div v-for="group in repairGroups" :key="group.category">
              <div class="mb-1.5 flex items-center gap-1.5">
                <UIcon :name="CATEGORY_ICONS[group.category]" class="size-3.5 text-accent" />
                <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                  {{ CATEGORY_LABELS[group.category] }} · {{ group.items.length }}
                </p>
              </div>

              <div class="space-y-1">
                <div
                  v-for="(change, index) in group.items"
                  :key="`${change.rule}-${index}`"
                  class="rounded-md border border-line bg-surface px-2.5 py-1.5"
                >
                  <p class="text-xs text-ink">{{ change.label }}</p>
                  <p class="mt-0.5 text-[11px] text-ink-dim">{{ change.detail }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Ce qui reste à arbitrer -->
          <div v-if="topo.repair.value.unresolved.length" class="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
            <p class="flex items-center gap-1.5 text-xs font-medium text-warning-500">
              <UIcon name="i-lucide-user-round-cog" class="size-3.5" />
              {{ topo.repair.value.unresolved.length }} constat(s) demandent votre décision
            </p>
            <ul class="mt-2 space-y-0.5">
              <li
                v-for="item in topo.repair.value.unresolved.slice(0, 6)"
                :key="item.id"
                class="text-[11px] text-ink-muted"
              >
                • {{ item.title }} — <span class="text-ink-dim">{{ item.fix }}</span>
              </li>
            </ul>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full flex-wrap items-center gap-2">
          <USelect
            v-model="repairMode"
            :items="[
              { label: 'Créer un plan corrigé', value: 'newBoard' },
              { label: 'Appliquer sur ce plan', value: 'inPlace' }
            ]"
            size="sm"
            class="w-52"
          />
          <div class="ml-auto flex gap-2">
            <UButton color="neutral" variant="ghost" label="Annuler" @click="topo.repair.value = null" />
            <UButton
              color="primary"
              icon="i-lucide-check"
              label="Appliquer les corrections"
              @click="topo.applyRepair(repairMode)"
            />
          </div>
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

    <!-- Bibliothèque de modèles -->
    <UModal v-model:open="modelsOpen" title="Générer un modèle d'infrastructure" :ui="{ content: 'max-w-3xl' }">
      <template #body>
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="text-sm text-ink-muted">
            Architectures prêtes à poser, câblage et adressage inclus. Vous pouvez ensuite
            tout renommer et ajuster.
          </p>
          <USelect
            v-model="modelMode"
            :items="[
              { label: 'Ajouter au plan courant', value: 'append' },
              { label: 'Créer un nouveau plan', value: 'newBoard' }
            ]"
            size="sm"
            class="w-56 shrink-0"
          />
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="blueprint in topo.blueprints"
            :key="blueprint.id"
            type="button"
            class="rounded-lg border border-line bg-surface p-3 text-left transition hover:border-accent/60"
            @click="generate(blueprint.id)"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="blueprint.icon" class="size-4 shrink-0 text-accent" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ blueprint.label }}</span>
              <span class="shrink-0 font-mono text-[10px] text-ink-dim">
                {{ blueprint.spots.length }}·{{ blueprint.wires.length }}
              </span>
            </div>
            <p class="mt-1.5 text-xs leading-relaxed text-ink-muted">{{ blueprint.description }}</p>
            <p class="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
              {{ blueprint.audience }}
            </p>
          </button>
        </div>
      </template>
    </UModal>
  </div>
</template>
