import type { TaskRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { requireProjectAccess } from '~~/server/utils/teams'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  assert(Number.isInteger(id), 'Identifiant de tâche invalide.')

  const db = useDb()
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  assert(task, 'Tâche introuvable.', 404)

  requireProjectAccess(event, task!.project_id)
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)

  return { ok: true }
})
