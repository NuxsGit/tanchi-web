<script setup lang="ts">
import { priorityOf, type Task } from '~~/shared/tasks'

const props = defineProps<{ task: Task, dragging?: boolean }>()
defineEmits<{ edit: [Task] }>()

const priority = computed(() => priorityOf(props.task.priority))

const initials = computed(() =>
  (props.task.assigneeName ?? '')
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
)

/** Échéance relative, avec alerte au-delà de la date. */
const due = computed(() => {
  if (!props.task.dueDate) return null
  const date = new Date(props.task.dueDate)
  if (Number.isNaN(date.getTime())) return null

  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
  const label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  return { label, late: days < 0, soon: days >= 0 && days <= 2 }
})
</script>

<template>
  <article
    class="cursor-grab rounded-lg border border-line bg-canvas p-3 transition active:cursor-grabbing"
    :class="dragging ? 'opacity-40' : 'hover:border-line-strong hover:shadow-sm'"
    @click="$emit('edit', task)"
  >
    <div class="flex items-start gap-2">
      <span class="mt-1 size-1.5 shrink-0 rounded-full" :class="{
        'bg-neutral-500': task.priority === 'low',
        'bg-info-500': task.priority === 'normal',
        'bg-warning-500': task.priority === 'high',
        'bg-error-500': task.priority === 'urgent'
      }" />
      <p class="min-w-0 flex-1 text-sm leading-snug text-ink">{{ task.title }}</p>
    </div>

    <p v-if="task.description" class="mt-1.5 line-clamp-2 pl-3.5 text-xs text-ink-dim">
      {{ task.description }}
    </p>

    <div class="mt-3 flex items-center gap-2 pl-3.5">
      <UBadge :label="priority.label" :color="priority.color" variant="subtle" size="sm" />

      <span
        v-if="due"
        class="flex items-center gap-1 font-mono text-[10px]"
        :class="due.late ? 'text-error-500' : due.soon ? 'text-warning-500' : 'text-ink-dim'"
      >
        <UIcon name="i-lucide-calendar" class="size-3" />
        {{ due.label }}
      </span>

      <span
        v-if="task.assigneeName"
        class="ml-auto flex size-6 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-medium text-accent"
        :title="task.assigneeName"
      >{{ initials }}</span>
      <span v-else class="ml-auto font-mono text-[10px] text-ink-dim">non assigné</span>
    </div>
  </article>
</template>
