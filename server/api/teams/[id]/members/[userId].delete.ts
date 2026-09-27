import type { TeamRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { requireManager } from '~~/server/utils/teams'

export default defineEventHandler((event) => {
  const teamId = Number(getRouterParam(event, 'id'))
  const userId = Number(getRouterParam(event, 'userId'))
  assert(Number.isInteger(teamId) && Number.isInteger(userId), 'Identifiants invalides.')

  requireManager(event, teamId)

  const db = useDb()
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as TeamRow | undefined
  assert(team, 'Équipe introuvable.', 404)
  assert(team!.owner_id !== userId, 'Le propriétaire ne peut pas être retiré de son équipe.')

  const info = db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')
    .run(teamId, userId)
  assert(info.changes > 0, 'Membre introuvable.', 404)

  // Les tâches restent, simplement désassignées.
  db.prepare(`
    UPDATE tasks SET assignee_id = NULL, updated_at = datetime('now')
    WHERE assignee_id = ? AND project_id IN (SELECT id FROM projects WHERE team_id = ?)
  `).run(userId, teamId)

  return { ok: true }
})
