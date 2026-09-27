import { useDb } from '~~/server/utils/db'
import { SESSION_COOKIE } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const current = requireUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  assert(verifyPassword(currentPassword, current.password_hash), 'Mot de passe actuel incorrect.', 401)
  assert(newPassword.length >= 8, 'Le nouveau mot de passe doit faire 8 caractères minimum.')
  assert(newPassword !== currentPassword, 'Choisissez un mot de passe différent de l\'actuel.')

  const db = useDb()
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(hashPassword(newPassword), current.id)

  // Révoque toutes les autres sessions.
  const token = getCookie(event, SESSION_COOKIE)
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(current.id, token ?? '')

  return { ok: true }
})
