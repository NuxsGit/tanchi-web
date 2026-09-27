import { useDb } from '~~/server/utils/db'
import { requireMembership, toMember, toProject, toTeam } from '~~/server/utils/teams'

export default defineEventHandler((event) => {
  const teamId = Number(getRouterParam(event, 'id'))
  assert(Number.isInteger(teamId), 'Identifiant d\'équipe invalide.')

  const { userId } = requireMembership(event, teamId)
  const db = useDb()

  const team = db.prepare(`
    SELECT t.*, tm.role,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
           (SELECT COUNT(*) FROM projects     WHERE team_id = t.id) AS project_count
    FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE t.id = ? AND tm.user_id = ?
  `).get(teamId, userId) as never

  const members = db.prepare(`
    SELECT tm.user_id, tm.role, tm.joined_at, u.username, u.email, u.avatar_url
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
    ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
             u.username COLLATE NOCASE
  `).all(teamId) as never[]

  const projects = db.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') AS done_count
    FROM projects p
    WHERE p.team_id = ?
    ORDER BY p.created_at DESC
  `).all(teamId) as never[]

  return {
    team: { ...toTeam(team), members: members.map(toMember), projects: projects.map(toProject) }
  }
})
