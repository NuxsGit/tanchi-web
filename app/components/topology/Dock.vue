<script setup lang="ts">
import { CATALOG, CATEGORIES, type CatalogItem, type CategoryId } from '~~/shared/topology/catalog'

const emit = defineEmits<{ pick: [string] }>()

const { dockOpen } = useTopology()

const query = ref('')
const openCategory = ref<CategoryId | 'all'>('all')

const results = computed(() => {
  const q = query.value.trim().toLowerCase()

  return CATALOG.filter((item) => {
    if (openCategory.value !== 'all' && item.category !== openCategory.value) return false
    if (!q) return true

    const category = CATEGORIES.find(c => c.id === item.category)?.label ?? ''
    return [item.label, category, ...item.tags].join(' ').toLowerCase().includes(q)
  })
})

/** Regroupement par catégorie, dans l'ordre d'usage du catalogue. */
const grouped = computed(() => {
  const groups = new Map<CategoryId, CatalogItem[]>()
  for (const item of results.value) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  }

  return CATEGORIES
    .filter(category => groups.has(category.id))
    .map(category => ({ category, items: groups.get(category.id)! }))
})

const countOf = (id: CategoryId) => CATALOG.filter(item => item.category === id).length

/** Le glisser-déposer transporte l'identifiant catalogue. */
function onDragStart(event: DragEvent, item: CatalogItem) {
  event.dataTransfer?.setData('text/tanchi-node', item.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

/** Résumé de connectique, affiché en infobulle. */
function portSummary(item: CatalogItem): string {
  if (!item.ports.length) return 'Élément passif'
  return item.ports.map(port => `${port.count}× ${port.connector}${port.speedGbps ? ` ${port.speedGbps}G` : ''}`).join(' · ')
}
</script>

<template>
  <!-- Rail replié : une poignée pour rouvrir, plus les raccourcis de catégorie -->
  <div
    v-if="!dockOpen"
    class="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-line bg-surface py-2"
  >
    <UButton
      icon="i-lucide-panel-right-open"
      color="primary"
      variant="soft"
      size="sm"
      aria-label="Ouvrir le catalogue"
      title="Ouvrir le catalogue de composants"
      @click="dockOpen = true"
    />

    <div class="my-1 h-px w-6 bg-line" />

    <button
      v-for="category in CATEGORIES"
      :key="category.id"
      type="button"
      class="flex size-8 items-center justify-center rounded-md text-ink-dim transition hover:bg-raised hover:text-accent"
      :title="`${category.label} — ${countOf(category.id)} composants`"
      @click="openCategory = category.id; dockOpen = true"
    >
      <UIcon :name="category.icon" class="size-4" />
    </button>
  </div>

  <!-- Dock déployé -->
  <aside v-else class="flex h-full w-64 shrink-0 flex-col border-l border-line bg-surface">
    <div class="shrink-0 space-y-2 border-b border-line p-2">
      <div class="flex items-center gap-1">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="cisco, fibre, docker…"
          size="sm"
          class="min-w-0 flex-1"
        />
        <UButton
          icon="i-lucide-panel-right-close"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Replier le catalogue"
          title="Replier pour agrandir le plateau"
          @click="dockOpen = false"
        />
      </div>

      <!-- Filtres par icône, pour ne pas manger la largeur -->
      <div class="flex flex-wrap gap-0.5">
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded text-[10px] font-medium transition"
          :class="openCategory === 'all' ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-raised'"
          :title="`Toutes les catégories — ${CATALOG.length} composants`"
          @click="openCategory = 'all'"
        >
          ALL
        </button>
        <button
          v-for="category in CATEGORIES"
          :key="category.id"
          type="button"
          class="flex size-7 items-center justify-center rounded transition"
          :class="openCategory === category.id ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-raised'"
          :title="`${category.label} — ${countOf(category.id)} composants`"
          @click="openCategory = category.id"
        >
          <UIcon :name="category.icon" class="size-3.5" />
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <div v-for="group in grouped" :key="group.category.id" class="mb-3">
        <div class="mb-1 flex items-center gap-1.5 px-0.5">
          <UIcon :name="group.category.icon" class="size-3 text-accent" />
          <p class="min-w-0 flex-1 truncate font-mono text-[9px] uppercase tracking-wider text-ink-dim">
            {{ group.category.label }}
          </p>
          <span class="font-mono text-[9px] text-ink-dim">{{ group.items.length }}</span>
        </div>

        <!-- Grille d'icônes : le libellé passe en infobulle -->
        <div class="grid grid-cols-5 gap-1">
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            draggable="true"
            class="group relative flex aspect-square cursor-grab items-center justify-center rounded-md border border-line bg-canvas transition hover:border-accent hover:bg-accent-soft active:cursor-grabbing"
            :title="`${item.label}\n${portSummary(item)}${item.hint ? `\n${item.hint}` : ''}`"
            :aria-label="item.label"
            @dragstart="onDragStart($event, item)"
            @dblclick="emit('pick', item.id)"
          >
            <UIcon :name="item.icon" class="size-4 text-ink-muted transition group-hover:text-accent" />
          </button>
        </div>
      </div>

      <p v-if="!results.length" class="px-2 py-8 text-center text-xs text-ink-dim">
        Aucun composant pour « {{ query }} ».
      </p>
    </div>

    <p class="shrink-0 border-t border-line px-2 py-1.5 text-[10px] leading-snug text-ink-dim">
      Glissez sur le plateau · double-clic pour poser · {{ results.length }}/{{ CATALOG.length }}
    </p>
  </aside>
</template>
