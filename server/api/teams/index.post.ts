import { useDb } from '~~/server/utils/db'
import { toTeam } from '~~/server/utils/teams'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const name = cleanString(body?.name)
  const description = cleanString(body?.description)

  assert(name.length >= 2, 'Le nom de l\'équipe doit faire 2 caractères minimum.')
  assert(name.length <= 60, 'Le nom ne doit pas dépasser 60 caractères.')

  const db = useDb()

  // Création de l'équipe et adhésion du créateur : indissociables.
  const create = db.transaction(() => {
    const info = db.prepare('INSERT INTO teams (name, description, owner_id) VALUES (?, ?, ?)')
      .run(name, description, user.id)
    db.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)')
      .run(info.lastInsertRowid, user.id, 'owner')
    return Number(info.lastInsertRowid)
  })

  const teamId = create()

  const row = db.prepare(`
    SELECT t.*, tm.role,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
           (SELECT COUNT(*) FROM projects     WHERE team_id = t.id) AS project_count
    FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE t.id = ? AND tm.user_id = ?
  `).get(teamId, user.id) as never

  return { team: toTeam(row) }
})
