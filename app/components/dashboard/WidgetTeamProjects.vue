<script setup lang="ts">
import type { WidgetInstance } from '~~/shared/dashboard'

const props = defineProps<{ widget: WidgetInstance }>()
const { data } = useDashboard()

const projects = computed(() => {
  const all = (data.value?.projects ?? []) as Record<string, number | string>[]
  const teamId = props.widget.options?.teamId
  return teamId ? all.filter(item => item.teamId === teamId) : all
})

const percent = (project: Record<string, number | string>) => {
  const total = Number(project.total ?? 0)
  return total ? Math.round((Number(project.done ?? 0) / total) * 100) : 0
}
</script>

<template>
  <div v-if="projects.length" class="space-y-2.5">
    <NuxtLink
      v-for="project in projects"
      :key="String(project.id)"
      :to="`/apps/tasks?project=${project.id}`"
      class="block rounded-md border border-line bg-canvas px-2.5 py-2 transition hover:border-accent/50"
    >
      <div class="flex items-baseline justify-between gap-2">
        <p class="min-w-0 truncate text-xs font-medium text-ink">{{ project.name }}</p>
        <span class="shrink-0 font-mono text-[10px] text-ink-dim">
          {{ project.done }}/{{ project.total }}
        </span>
      </div>
      <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-raised">
        <div class="h-full rounded-full bg-accent-fill transition-all" :style="{ width: `${percent(project)}%` }" />
      </div>
    </NuxtLink>
  </div>

  <p v-else class="py-6 text-center text-xs text-ink-dim">Aucun projet.</p>
</template>
