import type { UserRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { requireManager, toMember } from '~~/server/utils/teams'
import { isTeamRole } from '~~/shared/tasks'

export default defineEventHandler(async (event) => {
  const teamId = Number(getRouterParam(event, 'id'))
  assert(Number.isInteger(teamId), 'Identifiant d\'équipe invalide.')
  requireManager(event, teamId)

  const body = await readBody<Record<string, unknown>>(event)
  const email = cleanString(body?.email).toLowerCase()
  const role = isTeamRole(body?.role) ? body.role : 'member'

  assert(EMAIL_RE.test(email), 'Format d\'email invalide.')
  assert(role !== 'owner', 'Le rôle propriétaire ne s\'attribue pas manuellement.')

  const db = useDb()
  const invitee = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined

  // Pas d'invitation par email pour l'instant : le compte doit déjà exister.
  assert(invitee, 'Aucun compte Tanchi Web avec cet email.', 404)

  const already = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?')
    .get(teamId, invitee!.id)
  assert(!already, 'Cette personne fait déjà partie de l\'équipe.', 409)

  db.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)')
    .run(teamId, invitee!.id, role)

  const row = db.prepare(`
    SELECT tm.user_id, tm.role, tm.joined_at, u.username, u.email, u.avatar_url
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ? AND tm.user_id = ?
  `).get(teamId, invitee!.id) as never

  return { member: toMember(row) }
})
