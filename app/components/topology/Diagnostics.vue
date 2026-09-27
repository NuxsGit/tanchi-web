<script setup lang="ts">
import { CATEGORY_ICONS, CATEGORY_LABELS, type DiagCategory, type Severity } from '~~/shared/topology/diagnostics'

const topo = useTopology()
const { report, selectedIds } = topo

const severityFilter = ref<'all' | Severity>('all')
const categoryFilter = ref<'all' | DiagCategory>('all')

const filtered = computed(() => report.value.diagnostics.filter((item) => {
  if (severityFilter.value !== 'all' && item.severity !== severityFilter.value) return false
  if (categoryFilter.value !== 'all' && item.category !== categoryFilter.value) return false
  return true
}))

/** Regroupement par règle : dix câbles trop longs tiennent en une ligne. */
const grouped = computed(() => {
  const groups = new Map<string, typeof filtered.value>()
  for (const item of filtered.value) {
    groups.set(item.rule, [...(groups.get(item.rule) ?? []), item])
  }
  return [...groups.values()]
})

const severityItems = computed(() => [
  { label: `Tout (${report.value.diagnostics.length})`, value: 'all' },
  { label: `Erreurs (${report.value.errors})`, value: 'error' },
  { label: `Avertissements (${report.value.warnings})`, value: 'warning' },
  { label: `Remarques (${report.value.infos})`, value: 'info' }
])

const categories = computed(() =>
  (Object.keys(CATEGORY_LABELS) as DiagCategory[]).map(id => ({
    id,
    label: CATEGORY_LABELS[id],
    icon: CATEGORY_ICONS[id],
    count: report.value.byCategory[id]
  }))
)

const severityMeta: Record<Severity, { icon: string, border: string, text: string }> = {
  error: { icon: 'i-lucide-circle-x', border: 'border-l-error-500', text: 'text-error-500' },
  warning: { icon: 'i-lucide-triangle-alert', border: 'border-l-warning-500', text: 'text-warning-500' },
  info: { icon: 'i-lucide-info', border: 'border-l-info-500', text: 'text-info-500' }
}

const scoreColor = computed(() => {
  if (report.value.score >= 85) return 'text-success-500'
  if (report.value.score >= 60) return 'text-warning-500'
  return 'text-error-500'
})

const expanded = ref<string | null>(null)

function focus(nodeIds: string[]) {
  if (nodeIds.length) selectedIds.value = [...nodeIds]
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- Barre de contrôle -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
      <div class="flex items-center gap-1.5">
        <UIcon name="i-lucide-stethoscope" class="size-3.5" :class="scoreColor" />
        <span class="font-mono text-[11px] uppercase tracking-wider text-ink-muted">Contrôle</span>
        <span class="font-mono text-sm font-semibold" :class="scoreColor">{{ report.score }}</span>
        <span class="font-mono text-[10px] text-ink-dim">/100</span>
      </div>

      <div class="h-3 w-px bg-line" />

      <!-- Filtres par domaine -->
      <button
        type="button"
        class="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase transition"
        :class="categoryFilter === 'all' ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-raised'"
        @click="categoryFilter = 'all'"
      >
        tout
      </button>
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="flex items-center gap-1 rounded px-1.5 py-0.5 transition"
        :class="[
          categoryFilter === category.id ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-raised',
          category.count ? '' : 'opacity-40'
        ]"
        :title="`${category.label} — ${category.count} constat(s)`"
        @click="categoryFilter = category.id"
      >
        <UIcon :name="category.icon" class="size-3" />
        <span class="font-mono text-[10px]">{{ category.count }}</span>
      </button>

      <USelect v-model="severityFilter" :items="severityItems" size="xs" class="ml-auto w-40" />
    </div>

    <!-- Constats -->
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <div v-if="grouped.length" class="space-y-1.5">
        <div v-for="group in grouped" :key="group[0]!.rule">
          <!-- Répétitions d'une même règle repliées en un bloc -->
          <div
            v-for="diagnostic in (expanded === group[0]!.rule ? group : group.slice(0, 1))"
            :key="diagnostic.id"
            class="rounded-md border border-line border-l-2 bg-surface"
            :class="severityMeta[diagnostic.severity].border"
          >
            <button
              type="button"
              class="flex w-full items-start gap-2 px-2.5 py-2 text-left transition hover:bg-raised"
              @click="focus(diagnostic.nodeIds)"
            >
              <UIcon
                :name="severityMeta[diagnostic.severity].icon"
                class="mt-0.5 size-3.5 shrink-0"
                :class="severityMeta[diagnostic.severity].text"
              />

              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-ink">{{ diagnostic.title }}</p>
                <p class="mt-0.5 text-[11px] leading-snug text-ink-muted">{{ diagnostic.detail }}</p>
                <p class="mt-1 flex items-start gap-1 text-[11px] leading-snug text-accent">
                  <UIcon name="i-lucide-wrench" class="mt-0.5 size-3 shrink-0" />
                  {{ diagnostic.fix }}
                </p>
              </div>

              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="font-mono text-[9px] uppercase text-ink-dim">{{ diagnostic.rule }}</span>
                <UIcon
                  :name="CATEGORY_ICONS[diagnostic.category]"
                  class="size-3 text-ink-dim"
                  :title="CATEGORY_LABELS[diagnostic.category]"
                />
              </div>
            </button>

            <button
              v-if="group.length > 1 && diagnostic.id === group[0]!.id"
              type="button"
              class="w-full border-t border-line px-2.5 py-1 text-left font-mono text-[10px] text-ink-dim transition hover:text-accent"
              @click="expanded = expanded === group[0]!.rule ? null : group[0]!.rule"
            >
              {{ expanded === group[0]!.rule ? '▾ replier' : `▸ ${group.length - 1} autre(s) constat(s) identique(s)` }}
            </button>
          </div>
        </div>
      </div>

      <div v-else class="py-8 text-center">
        <UIcon
          :name="report.diagnostics.length ? 'i-lucide-filter-x' : 'i-lucide-shield-check'"
          class="mx-auto size-6"
          :class="report.diagnostics.length ? 'text-ink-dim' : 'text-success-500'"
        />
        <p class="mt-3 text-xs text-ink-muted">
          {{ report.diagnostics.length
            ? 'Aucun constat dans ce filtre.'
            : 'Aucune anomalie détectée sur ce plan.' }}
        </p>
      </div>
    </div>
  </div>
</template>
