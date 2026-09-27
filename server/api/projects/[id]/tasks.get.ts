import { useDb } from '~~/server/utils/db'
import { requireProjectAccess, toTask } from '~~/server/utils/teams'

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  assert(Number.isInteger(projectId), 'Identifiant de projet invalide.')

  const { project } = requireProjectAccess(event, projectId)

  const rows = useDb().prepare(`
    SELECT t.*, u.username AS assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ?
    ORDER BY t.position, t.id
  `).all(projectId) as never[]

  return { project: { id: project.id, teamId: project.team_id, name: project.name }, tasks: rows.map(toTask) }
})
