<script setup lang="ts">
import { TASK_COLUMNS, TASK_PRIORITIES, type Task, type TaskPriority, type TaskStatus, type TeamMember } from '~~/shared/tasks'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  task: Task | null
  defaultStatus: TaskStatus
  members: TeamMember[]
}>()

const emit = defineEmits<{
  save: [payload: Partial<Task> & { title: string }]
  remove: [number]
}>()

const UNASSIGNED = '__unassigned__'

const draft = reactive({
  title: '',
  description: '',
  status: 'backlog' as TaskStatus,
  priority: 'normal' as TaskPriority,
  assignee: UNASSIGNED,
  dueDate: ''
})

// Recharge le brouillon à chaque ouverture, création comme édition.
watch(open, (value) => {
  if (!value) return
  draft.title = props.task?.title ?? ''
  draft.description = props.task?.description ?? ''
  draft.status = props.task?.status ?? props.defaultStatus
  draft.priority = props.task?.priority ?? 'normal'
  draft.assignee = props.task?.assigneeId ? String(props.task.assigneeId) : UNASSIGNED
  draft.dueDate = props.task?.dueDate ?? ''
})

const statusItems = TASK_COLUMNS.map(column => ({ label: column.label, value: column.id }))
const priorityItems = TASK_PRIORITIES.map(item => ({ label: item.label, value: item.id }))

const memberItems = computed(() => [
  { label: 'Non assigné', value: UNASSIGNED },
  ...props.members.map(member => ({ label: member.username, value: String(member.userId) }))
])

const canSave = computed(() => draft.title.trim().length > 0)

function save() {
  if (!canSave.value) return
  emit('save', {
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    priority: draft.priority,
    assigneeId: draft.assignee === UNASSIGNED ? null : Number(draft.assignee),
    dueDate: draft.dueDate || null
  })
}
</script>

<template>
  <UModal v-model:open="open" :title="task ? 'Modifier la tâche' : 'Nouvelle tâche'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Titre" required>
          <UInput
            v-model="draft.title"
            placeholder="Migrer le reverse proxy vers Traefik v3"
            size="lg"
            class="w-full"
            autofocus
            @keydown.enter="save"
          />
        </UFormField>

        <UFormField label="Description" hint="optionnel">
          <UTextarea v-model="draft.description" :rows="3" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Colonne">
            <USelect v-model="draft.status" :items="statusItems" class="w-full" />
          </UFormField>
          <UFormField label="Priorité">
            <USelect v-model="draft.priority" :items="priorityItems" class="w-full" />
          </UFormField>
          <UFormField label="Assigné à">
            <USelect v-model="draft.assignee" :items="memberItems" class="w-full" />
          </UFormField>
          <UFormField label="Échéance" hint="optionnel">
            <UInput v-model="draft.dueDate" type="date" class="w-full" />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center gap-2">
        <UButton
          v-if="task"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          label="Supprimer"
          @click="emit('remove', task.id); open = false"
        />
        <div class="ml-auto flex gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
          <UButton color="primary" :disabled="!canSave" :label="task ? 'Enregistrer' : 'Créer'" @click="save" />
        </div>
      </div>
    </template>
  </UModal>
</template>
