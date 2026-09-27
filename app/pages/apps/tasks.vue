<script setup lang="ts">
import { TASK_COLUMNS, type Task, type TaskStatus, type TeamMember } from '~~/shared/tasks'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'TanchiTaskTeam — Tanchi Web' })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const { teams, ensure } = useTeams()
const board = useTaskBoard()
const { project, tasks, pending, byStatus, stats } = board

/** Vrai tant que la première résolution équipe/projet n'a pas abouti :
 *  évite d'afficher « aucune équipe » avant même d'avoir interrogé l'API. */
const booting = ref(true)

const selectedTeamId = ref<number | null>(null)
const selectedProjectId = ref<number | null>(null)
const members = ref<TeamMember[]>([])
const projects = ref<{ id: number, name: string }[]>([])

/* --------------------------------------------------------- Sélecteurs */

const teamItems = computed(() =>
  teams.value.map(team => ({ label: team.name, value: String(team.id) }))
)

const projectItems = computed(() =>
  projects.value.map(item => ({ label: item.name, value: String(item.id) }))
)

const teamModel = computed({
  get: () => (selectedTeamId.value ? String(selectedTeamId.value) : ''),
  set: (value: string) => { void loadTeam(Number(value)) }
})

const projectModel = computed({
  get: () => (selectedProjectId.value ? String(selectedProjectId.value) : ''),
  set: (value: string) => { void openProject(Number(value)) }
})

async function loadTeam(teamId: number, preferredProject?: number) {
  selectedTeamId.value = teamId
  const { team } = await $fetch<{ team: { members: TeamMember[], projects: { id: number, name: string }[] } }>(
    `/api/teams/${teamId}`
  )
  members.value = team.members
  projects.value = team.projects

  const target = preferredProject && team.projects.some(p => p.id === preferredProject)
    ? preferredProject
    : team.projects[0]?.id

  if (target) await openProject(target)
  else {
    selectedProjectId.value = null
    tasks.value = []
  }
}

async function openProject(id: number) {
  selectedProjectId.value = id
  await board.open(id)
  // L'URL reflète le projet ouvert : le lien est partageable et rechargeable.
  router.replace({ query: { ...route.query, project: String(id) } })
}

onMounted(async () => {
  try {
    await ensure()
    if (!teams.value.length) return

    const requested = Number(route.query.project)
    if (Number.isInteger(requested) && requested > 0) {
      // Retrouve l'équipe propriétaire du projet demandé.
      for (const team of teams.value) {
        const { team: detail } = await $fetch<{ team: { projects: { id: number }[] } }>(`/api/teams/${team.id}`)
        if (detail.projects.some(p => p.id === requested)) {
          await loadTeam(team.id, requested)
          return
        }
      }
    }

    await loadTeam(teams.value[0]!.id)
  } finally {
    booting.value = false
  }
})

/* ------------------------------------------------------ Glisser-déposer */

const draggingId = ref<number | null>(null)

function onDragStart(task: Task) {
  draggingId.value = task.id
}

async function onDrop(status: TaskStatus, index: number) {
  const id = draggingId.value
  draggingId.value = null
  if (id === null) return
  await board.move(id, status, index)
}

/* ---------------------------------------------------------- Édition */

const modalOpen = ref(false)
const editing = ref<Task | null>(null)
const defaultStatus = ref<TaskStatus>('backlog')

function openCreate(status: TaskStatus) {
  editing.value = null
  defaultStatus.value = status
  modalOpen.value = true
}

function openEdit(task: Task) {
  editing.value = task
  defaultStatus.value = task.status
  modalOpen.value = true
}

async function save(payload: Partial<Task> & { title: string }) {
  try {
    if (editing.value) await board.update(editing.value.id, payload)
    else await board.create(payload)
    modalOpen.value = false
  } catch (cause) {
    toast.add({
      title: 'Enregistrement impossible',
      description: apiError(cause),
      color: 'error'
    })
  }
}

const columns = TASK_COLUMNS
const donePercent = computed(() => (stats.value.total ? Math.round((stats.value.done / stats.value.total) * 100) : 0))
</script>

<template>
  <div class="flex h-[calc(100vh-7rem)] flex-col gap-4">
    <!-- En-tête -->
    <header class="shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
      <div class="flex items-center justify-between border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
        <div class="flex items-center gap-2">
          <NuxtLink to="/apps" class="transition hover:text-ink">applications</NuxtLink>
          <span>/</span>
          <span class="text-accent">taskteam</span>
        </div>
        <span v-if="project">{{ stats.done }}/{{ stats.total }} · {{ donePercent }} %</span>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 p-4">
        <div class="flex items-center gap-2.5">
          <span class="flex size-9 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
            <UIcon name="i-lucide-square-kanban" class="size-4.5 text-accent" />
          </span>
          <div>
            <h1 class="text-lg font-semibold tracking-tight text-ink">TanchiTaskTeam</h1>
            <p class="text-xs text-ink-dim">Tableau de tâches partagé par projet d'équipe</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <USelect
            v-if="teamItems.length"
            v-model="teamModel"
            :items="teamItems"
            icon="i-lucide-users"
            size="sm"
            class="w-44"
          />
          <USelect
            v-if="projectItems.length"
            v-model="projectModel"
            :items="projectItems"
            icon="i-lucide-folder-kanban"
            size="sm"
            class="w-52"
          />
          <UButton
            v-if="selectedProjectId"
            icon="i-lucide-plus"
            color="primary"
            size="sm"
            label="Tâche"
            @click="openCreate('todo')"
          />
        </div>
      </div>
    </header>

    <!-- Amorçage : squelette de board plutôt qu'un faux état vide -->
    <div v-if="booting" class="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <div v-for="n in 5" :key="n" class="h-full w-72 shrink-0 animate-pulse rounded-xl border border-line bg-surface" />
    </div>

    <!-- États vides -->
    <div v-else-if="!teams.length" class="rounded-xl border border-dashed border-line p-12 text-center">
      <UIcon name="i-lucide-users" class="mx-auto size-8 text-ink-dim" />
      <h2 class="mt-4 font-medium text-ink">Aucune équipe</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        TanchiTaskTeam fonctionne à l'échelle d'un projet d'équipe. Créez une équipe,
        puis un projet, pour ouvrir un tableau.
      </p>
      <UButton class="mt-6" to="/teams" icon="i-lucide-arrow-right" color="primary" label="Créer une équipe" />
    </div>

    <div v-else-if="!selectedProjectId" class="rounded-xl border border-dashed border-line p-12 text-center">
      <UIcon name="i-lucide-folder-kanban" class="mx-auto size-8 text-ink-dim" />
      <h2 class="mt-4 font-medium text-ink">Aucun projet dans cette équipe</h2>
      <UButton
        v-if="selectedTeamId"
        class="mt-6"
        :to="`/teams/${selectedTeamId}`"
        color="primary"
        label="Créer un projet"
      />
    </div>

    <!-- Board -->
    <div v-else-if="pending && !tasks.length" class="flex gap-4">
      <div v-for="n in 5" :key="n" class="h-72 w-72 shrink-0 animate-pulse rounded-xl border border-line bg-surface" />
    </div>

    <div v-else class="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
      <TaskColumn
        v-for="column in columns"
        :key="column.id"
        :column="column"
        :tasks="byStatus.get(column.id) ?? []"
        :dragging-id="draggingId"
        @drag-start="onDragStart"
        @drag-end="draggingId = null"
        @drop-at="onDrop"
        @add="openCreate"
        @edit="openEdit"
      />
    </div>

    <TaskEditModal
      v-model:open="modalOpen"
      :task="editing"
      :default-status="defaultStatus"
      :members="members"
      @save="save"
      @remove="board.remove"
    />
  </div>
</template>
