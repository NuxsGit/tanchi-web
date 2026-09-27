import type { ProjectRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { requireMembership, toProject } from '~~/server/utils/teams'

export default defineEventHandler(async (event) => {
  const teamId = Number(getRouterParam(event, 'id'))
  assert(Number.isInteger(teamId), 'Identifiant d\'équipe invalide.')
  requireMembership(event, teamId)

  const body = await readBody<Record<string, unknown>>(event)
  const name = cleanString(body?.name)
  const description = cleanString(body?.description)

  assert(name.length >= 2, 'Le nom du projet doit faire 2 caractères minimum.')
  assert(name.length <= 60, 'Le nom ne doit pas dépasser 60 caractères.')

  const db = useDb()
  const info = db.prepare('INSERT INTO projects (team_id, name, description) VALUES (?, ?, ?)')
    .run(teamId, name, description)

  const row = db.prepare('SELECT * FROM projects WHERE id = ?')
    .get(info.lastInsertRowid) as ProjectRow

  return { project: toProject(row) }
})
