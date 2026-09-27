import { useDb } from '~~/server/utils/db'
import { toTeam } from '~~/server/utils/teams'

export default defineEventHandler((event) => {
  const user = requireUser(event)

  const rows = useDb().prepare(`
    SELECT t.*, tm.role,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
           (SELECT COUNT(*) FROM projects     WHERE team_id = t.id) AS project_count
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ?
    ORDER BY t.name COLLATE NOCASE
  `).all(user.id) as never[]

  return { teams: rows.map(toTeam) }
})
