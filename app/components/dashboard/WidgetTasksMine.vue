<script setup lang="ts">
import { priorityOf } from '~~/shared/tasks'

const { data } = useDashboard()
const tasks = computed(() => (data.value?.myTasks ?? []) as Record<string, string | number | null>[])

const dueLabel = (value: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    text: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    late: date.getTime() < Date.now()
  }
}
</script>

<template>
  <div v-if="tasks.length" class="space-y-1.5">
    <NuxtLink
      v-for="task in tasks"
      :key="String(task.id)"
      :to="`/apps/tasks?project=${task.projectId}`"
      class="flex items-start gap-2 rounded-md border border-line bg-canvas px-2.5 py-2 transition hover:border-accent/50"
    >
      <span
        class="mt-1.5 size-1.5 shrink-0 rounded-full"
        :class="{
          'bg-neutral-500': task.priority === 'low',
          'bg-info-500': task.priority === 'normal',
          'bg-warning-500': task.priority === 'high',
          'bg-error-500': task.priority === 'urgent'
        }"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs text-ink">{{ task.title }}</p>
        <p class="truncate font-mono text-[10px] text-ink-dim">{{ task.projectName }}</p>
      </div>
      <span
        v-if="dueLabel(task.dueDate as string | null)"
        class="shrink-0 font-mono text-[10px]"
        :class="dueLabel(task.dueDate as string | null)!.late ? 'text-error-500' : 'text-ink-dim'"
      >{{ dueLabel(task.dueDate as string | null)!.text }}</span>
    </NuxtLink>
  </div>

  <p v-else class="py-6 text-center text-xs text-ink-dim">
    Rien ne vous est assigné.
  </p>
</template>
