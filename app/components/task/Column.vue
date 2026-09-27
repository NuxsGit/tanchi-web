<script setup lang="ts">
import type { Task, TaskColumn, TaskStatus } from '~~/shared/tasks'

const props = defineProps<{
  column: TaskColumn
  tasks: Task[]
  draggingId: number | null
}>()

const emit = defineEmits<{
  dragStart: [Task]
  dragEnd: []
  dropAt: [status: TaskStatus, index: number]
  add: [status: TaskStatus]
  edit: [Task]
}>()

const over = ref(false)
/** Index d'insertion visé, matérialisé par un trait pendant le survol. */
const insertAt = ref(0)

function markOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (props.draggingId === null) return
  over.value = true
  insertAt.value = index
}

function reset() {
  over.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  if (props.draggingId === null) return
  emit('dropAt', props.column.id, insertAt.value)
  reset()
}

function onLeave(event: DragEvent) {
  const target = event.currentTarget
  const related = event.relatedTarget
  if (target instanceof HTMLElement && related instanceof Node && target.contains(related)) return
  reset()
}
</script>

<template>
  <section
    class="flex max-h-full w-72 shrink-0 flex-col rounded-xl border bg-surface transition"
    :class="over ? 'border-accent/60' : 'border-line'"
    @dragover="markOver(tasks.length, $event)"
    @dragleave="onLeave"
    @drop="onDrop"
  >
    <header class="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
      <div class="flex items-center gap-2">
        <h3 class="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{{ column.label }}</h3>
        <span class="rounded bg-raised px-1.5 font-mono text-[10px] text-ink-dim">{{ tasks.length }}</span>
      </div>
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Ajouter dans ${column.label}`"
        @click="emit('add', column.id)"
      />
    </header>

    <div class="min-h-28 flex-1 space-y-2 overflow-y-auto p-2">
      <template v-for="(task, index) in tasks" :key="task.id">
        <div v-if="over && insertAt === index" class="h-0.5 rounded-full bg-accent-fill" />

        <div
          draggable="true"
          @dragstart="emit('dragStart', task)"
          @dragend="emit('dragEnd')"
          @dragover.stop="markOver(index, $event)"
        >
          <TaskCard :task="task" :dragging="draggingId === task.id" @edit="emit('edit', $event)" />
        </div>
      </template>

      <div v-if="over && insertAt >= tasks.length" class="h-0.5 rounded-full bg-accent-fill" />

      <p v-if="!tasks.length" class="px-1 py-8 text-center text-xs leading-relaxed text-ink-dim">
        {{ column.hint }}
      </p>
    </div>
  </section>
</template>
