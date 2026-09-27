import type { TaskRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { requireProjectAccess, toTask } from '~~/server/utils/teams'
import { isTaskPriority, isTaskStatus } from '~~/shared/tasks'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  assert(Number.isInteger(id), 'Identifiant de tâche invalide.')

  const db = useDb()
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
  assert(task, 'Tâche introuvable.', 404)

  const { project } = requireProjectAccess(event, task!.project_id)
  const body = await readBody<Record<string, unknown>>(event)

  const updates: string[] = []
  const values: unknown[] = []

  if (body?.title !== undefined) {
    const title = cleanString(body.title)
    assert(title.length > 0 && title.length <= 140, 'Titre invalide.')
    updates.push('title = ?'); values.push(title)
  }

  if (body?.description !== undefined) {
    updates.push('description = ?'); values.push(cleanString(body.description))
  }

  if (body?.status !== undefined) {
    assert(isTaskStatus(body.status), 'Colonne inconnue.')
    updates.push('status = ?'); values.push(body.status)
  }

  if (body?.priority !== undefined) {
    assert(isTaskPriority(body.priority), 'Priorité inconnue.')
    updates.push('priority = ?'); values.push(body.priority)
  }

  if (body?.assigneeId !== undefined) {
    const assigneeId = body.assigneeId == null ? null : Number(body.assigneeId)
    if (assigneeId !== null) {
      const member = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?')
        .get(project.team_id, assigneeId)
      assert(member, 'L\'assigné doit être membre de l\'équipe.')
    }
    updates.push('assignee_id = ?'); values.push(assigneeId)
  }

  if (body?.position !== undefined) {
    const position = Number(body.position)
    assert(Number.isFinite(position), 'Position invalide.')
    updates.push('position = ?'); values.push(position)
  }

  if (body?.dueDate !== undefined) {
    updates.push('due_date = ?'); values.push(cleanString(body.dueDate) || null)
  }

  assert(updates.length > 0, 'Aucune modification fournie.')

  db.prepare(`UPDATE tasks SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...values, id)

  const row = db.prepare(`
    SELECT t.*, u.username AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ?
  `).get(id) as TaskRow

  return { task: toTask(row) }
})
