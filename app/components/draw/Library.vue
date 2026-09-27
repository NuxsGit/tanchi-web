<script setup lang="ts">
import { DRAW_CATEGORIES, DRAW_ICONS, type DrawCategoryId, type DrawIcon } from '~~/shared/draw/library'
import { SHAPE_PRESETS, type ShapePreset } from '~~/shared/draw/model'

/**
 * Catalogue de TanchiDraw.
 *
 * Deux gestes, au choix : glisser le symbole à l'endroit voulu, ou cliquer
 * pour l'armer puis viser sur la planche. Le second est plus rapide quand on
 * pose la même icône dix fois — d'où le maintien de Maj pour enchaîner.
 */

const emit = defineEmits<{ templates: [] }>()

const draw = useDraw()
const { libraryOpen, pendingIcon, tool } = draw

const query = ref('')
const category = ref<DrawCategoryId | 'all'>('all')

const results = computed(() => {
  const needle = query.value.trim().toLowerCase()

  return DRAW_ICONS.filter((item) => {
    if (category.value !== 'all' && item.category !== category.value) return false
    if (!needle) return true

    const label = DRAW_CATEGORIES.find(entry => entry.id === item.category)?.label ?? ''
    return [item.label, label, ...item.tags].join(' ').toLowerCase().includes(needle)
  })
})

const grouped = computed(() => {
  const groups = new Map<DrawCategoryId, DrawIcon[]>()
  for (const item of results.value) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  }

  return DRAW_CATEGORIES
    .filter(entry => groups.has(entry.id))
    .map(entry => ({ category: entry, items: groups.get(entry.id)! }))
})

const countOf = (id: DrawCategoryId) => DRAW_ICONS.filter(item => item.category === id).length

function onIconDragStart(event: DragEvent, item: DrawIcon) {
  event.dataTransfer?.setData('text/tanchi-icon', item.icon)
  event.dataTransfer?.setData('text/tanchi-label', item.label)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function onShapeDragStart(event: DragEvent, preset: ShapePreset) {
  event.dataTransfer?.setData('text/tanchi-shape', preset.kind)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

/** Arme une icône : le prochain clic sur la planche la pose. */
function arm(item: DrawIcon) {
  if (pendingIcon.value === item.icon) {
    pendingIcon.value = null
    tool.value = 'select'
    return
  }

  pendingIcon.value = item.icon
  tool.value = 'icon'
  void draw.ensureIcons([item.icon])
}
</script>

<template>
  <!-- Rail replié : les catégories restent accessibles d'un clic -->
  <div
    v-if="!libraryOpen"
    class="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-line bg-surface py-2"
  >
    <UButton
      icon="i-lucide-panel-right-open"
      color="primary"
      variant="soft"
      size="sm"
      aria-label="Ouvrir le catalogue"
      title="Ouvrir le catalogue de symboles"
      @click="libraryOpen = true"
    />

    <div class="my-1 h-px w-6 bg-line" />

    <button
      v-for="entry in DRAW_CATEGORIES"
      :key="entry.id"
      type="button"
      class="flex size-8 items-center justify-center rounded-md text-ink-dim transition hover:bg-raised hover:text-accent"
      :title="`${entry.label} — ${countOf(entry.id)} symboles`"
      @click="category = entry.id; libraryOpen = true"
    >
      <UIcon :name="entry.icon" class="size-4" />
    </button>
  </div>

  <aside v-else class="flex h-full w-64 shrink-0 flex-col border-l border-line bg-surface">
    <div class="shrink-0 space-y-2 border-b border-line p-2">
      <div class="flex items-center gap-1">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="pare-feu, cloud, client…"
          size="sm"
          class="min-w-0 flex-1"
        />
        <UButton
          icon="i-lucide-panel-right-close"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Replier le catalogue"
          title="Replier pour agrandir la planche"
          @click="libraryOpen = false"
        />
      </div>

      <UButton
        icon="i-lucide-layout-template"
        color="primary"
        variant="soft"
        size="xs"
        block
        label="Modèles de planches"
        @click="emit('templates')"
      />

      <!-- Formes de base : le socle d'un schéma, avant les symboles -->
      <div class="grid grid-cols-6 gap-1">
        <button
          v-for="preset in SHAPE_PRESETS"
          :key="preset.kind"
          type="button"
          draggable="true"
          class="flex aspect-square cursor-grab items-center justify-center rounded-md border transition active:cursor-grabbing"
          :class="tool === preset.kind
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line bg-canvas text-ink-muted hover:border-accent hover:text-accent'"
          :title="`${preset.label} — ${preset.hint}`"
          :aria-label="preset.label"
          @dragstart="onShapeDragStart($event, preset)"
          @click="tool = tool === preset.kind ? 'select' : preset.kind; pendingIcon = null"
        >
          <UIcon :name="preset.icon" class="size-4" />
        </button>
      </div>

      <!-- Filtres par icône, pour ne pas manger la largeur -->
      <div class="flex flex-wrap gap-0.5">
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded text-[10px] font-medium transition"
          :class="category === 'all' ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-raised'"
          :title="`Toutes les catégories — ${DRAW_ICONS.length} symboles`"
          @click="category = 'all'"
        >
          ALL
        </button>
        <button
          v-for="entry in DRAW_CATEGORIES"
          :key="entry.id"
          type="button"
          class="flex size-7 items-center justify-center rounded transition"
          :class="category === entry.id ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-raised'"
          :title="`${entry.label} — ${countOf(entry.id)} symboles`"
          @click="category = entry.id"
        >
          <UIcon :name="entry.icon" class="size-3.5" />
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

        <div class="grid grid-cols-5 gap-1">
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            draggable="true"
            class="group flex aspect-square cursor-grab items-center justify-center rounded-md border transition active:cursor-grabbing"
            :class="pendingIcon === item.icon
              ? 'border-accent bg-accent-soft'
              : 'border-line bg-canvas hover:border-accent hover:bg-accent-soft'"
            :title="`${item.label}\n${item.tags.join(' · ')}`"
            :aria-label="item.label"
            @dragstart="onIconDragStart($event, item)"
            @click="arm(item)"
          >
            <UIcon
              :name="item.icon"
              class="size-4 transition"
              :class="pendingIcon === item.icon ? 'text-accent' : 'text-ink-muted group-hover:text-accent'"
            />
          </button>
        </div>
      </div>

      <p v-if="!results.length" class="px-2 py-8 text-center text-xs text-ink-dim">
        Aucun symbole pour « {{ query }} ».
      </p>
    </div>

    <p class="shrink-0 border-t border-line px-2 py-1.5 text-[10px] leading-snug text-ink-dim">
      Glissez sur la planche · clic pour armer · {{ results.length }}/{{ DRAW_ICONS.length }}
    </p>
  </aside>
</template>
