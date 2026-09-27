<script setup lang="ts">
import { TASK_COLUMNS } from '~~/shared/tasks'
import type { WidgetInstance } from '~~/shared/dashboard'

const props = defineProps<{ widget: WidgetInstance }>()
const { data } = useDashboard()

const project = computed(() => {
  const projects = (data.value?.projects ?? []) as Record<string, number | string>[]
  const wanted = props.widget.options?.projectId
  return projects.find(item => item.id === wanted) ?? projects[0] ?? null
})

const total = computed(() => Number(project.value?.total ?? 0))
const done = computed(() => Number(project.value?.done ?? 0))
const percent = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))
</script>

<template>
  <div v-if="project" class="flex h-full flex-col">
    <div class="flex items-baseline justify-between gap-2">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-ink">{{ project.name }}</p>
        <p class="truncate font-mono text-[10px] text-ink-dim">{{ project.teamName }}</p>
      </div>
      <span class="shrink-0 text-2xl font-semibold text-ink">{{ percent }}<span class="text-sm text-ink-dim">%</span></span>
    </div>

    <div class="mt-2 h-1 overflow-hidden rounded-full bg-raised">
      <div class="h-full rounded-full bg-accent-fill transition-all" :style="{ width: `${percent}%` }" />
    </div>

    <div class="mt-4 grid flex-1 content-start gap-1.5">
      <div
        v-for="column in TASK_COLUMNS"
        :key="column.id"
        class="flex items-center gap-2"
      >
        <span class="w-16 shrink-0 font-mono text-[10px] uppercase text-ink-dim">{{ column.label }}</span>
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
          <div
            class="h-full rounded-full bg-accent/60"
            :style="{ width: total ? `${(Number(project[column.id] ?? 0) / total) * 100}%` : '0%' }"
          />
        </div>
        <span class="w-5 shrink-0 text-right font-mono text-[10px] text-ink-muted">
          {{ project[column.id] ?? 0 }}
        </span>
      </div>
    </div>

    <UButton
      :to="`/apps/tasks?project=${project.id}`"
      icon="i-lucide-arrow-right"
      color="neutral"
      variant="ghost"
      size="xs"
      label="Ouvrir le tableau"
      class="mt-3 self-start"
    />
  </div>

  <p v-else class="py-6 text-center text-xs text-ink-dim">
    Aucun projet. Créez-en un depuis une équipe.
  </p>
</template>
