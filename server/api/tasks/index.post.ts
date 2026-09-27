import type { TaskRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { requireProjectAccess, toTask } from '~~/server/utils/teams'
import { isTaskPriority, isTaskStatus } from '~~/shared/tasks'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const projectId = Number(body?.projectId)

  assert(Number.isInteger(projectId), 'Identifiant de projet invalide.')
  const { project, membership } = requireProjectAccess(event, projectId)

  const title = cleanString(body?.title)
  assert(title.length > 0, 'Le titre est requis.')
  assert(title.length <= 140, 'Le titre ne doit pas dépasser 140 caractères.')

  const status = isTaskStatus(body?.status) ? body.status : 'backlog'
  const priority = isTaskPriority(body?.priority) ? body.priority : 'normal'
  const assigneeId = body?.assigneeId == null ? null : Number(body.assigneeId)

  const db = useDb()

  if (assigneeId !== null) {
    const member = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(project.team_id, assigneeId)
    assert(member, 'L\'assigné doit être membre de l\'équipe.')
  }

  // Nouvelle carte en bas de sa colonne.
  const last = db.prepare('SELECT MAX(position) AS p FROM tasks WHERE project_id = ? AND status = ?')
    .get(projectId, status) as { p: number | null }

  const info = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, position, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    title,
    cleanString(body?.description),
    status,
    priority,
    assigneeId,
    (last.p ?? 0) + 1000,
    cleanString(body?.dueDate) || null,
    membership.userId
  )

  const row = db.prepare(`
    SELECT t.*, u.username AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ?
  `).get(info.lastInsertRowid) as TaskRow

  return { task: toTask(row) }
})
