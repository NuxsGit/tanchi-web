import { TASK_COLUMNS, positionBetween, type Task, type TaskStatus } from '~~/shared/tasks'

interface BoardResponse {
  project: { id: number, teamId: number, name: string }
  tasks: Task[]
}

/**
 * Board Kanban d'un projet.
 *
 * Les déplacements sont appliqués localement d'abord puis confirmés par le
 * serveur : la carte suit le curseur sans attendre l'aller-retour réseau, et
 * l'état est restauré si la requête échoue.
 */
export const useTaskBoard = () => {
  const toast = useToast()

  const projectId = useState<number | null>('tanchi-board-project', () => null)
  const project = useState<BoardResponse['project'] | null>('tanchi-board-meta', () => null)
  const tasks = useState<Task[]>('tanchi-board-tasks', () => [])
  const pending = ref(false)

  const byStatus = computed(() => {
    const groups = new Map<TaskStatus, Task[]>()
    for (const column of TASK_COLUMNS) groups.set(column.id, [])
    for (const task of tasks.value) groups.get(task.status)?.push(task)
    for (const list of groups.values()) list.sort((a, b) => a.position - b.position)
    return groups
  })

  const stats = computed(() => ({
    total: tasks.value.length,
    done: tasks.value.filter(task => task.status === 'done').length,
    unassigned: tasks.value.filter(task => task.assigneeId === null).length
  }))

  async function open(id: number) {
    if (projectId.value === id && tasks.value.length) return
    projectId.value = id
    pending.value = true
    try {
      const data = await $fetch<BoardResponse>(`/api/projects/${id}/tasks`)
      project.value = data.project
      tasks.value = data.tasks
    } catch {
      toast.add({ title: 'Projet inaccessible', color: 'error' })
      tasks.value = []
    } finally {
      pending.value = false
    }
  }

  async function reload() {
    if (projectId.value) {
      const id = projectId.value
      projectId.value = null
      await open(id)
    }
  }

  async function create(input: Partial<Task> & { title: string }) {
    const { task } = await $fetch<{ task: Task }>('/api/tasks', {
      method: 'POST',
      body: { ...input, projectId: projectId.value }
    })
    tasks.value = [...tasks.value, task]
    return task
  }

  async function update(id: number, patch: Partial<Task>) {
    const snapshot = tasks.value
    // Application optimiste, retour arrière en cas d'échec.
    tasks.value = tasks.value.map(task => (task.id === id ? { ...task, ...patch } : task))

    try {
      const { task } = await $fetch<{ task: Task }>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: patch
      })
      tasks.value = tasks.value.map(item => (item.id === id ? task : item))
      return task
    } catch (cause) {
      tasks.value = snapshot
      toast.add({
        title: 'Modification refusée',
        description: apiError(cause),
        color: 'error'
      })
      return null
    }
  }

  async function remove(id: number) {
    const snapshot = tasks.value
    tasks.value = tasks.value.filter(task => task.id !== id)
    try {
      await $fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    } catch {
      tasks.value = snapshot
      toast.add({ title: 'Suppression impossible', color: 'error' })
    }
  }

  /** Déplace une carte dans une colonne, à l'index visé. */
  async function move(taskId: number, status: TaskStatus, index: number) {
    const column = (byStatus.value.get(status) ?? []).filter(task => task.id !== taskId)
    const before = column[index - 1]?.position
    const after = column[index]?.position
    const position = positionBetween(before, after)

    await update(taskId, { status, position })
  }

  return { projectId, project, tasks, pending, byStatus, stats, open, reload, create, update, remove, move }
}
