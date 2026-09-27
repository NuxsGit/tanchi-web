import type { UserRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const current = requireUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const username = cleanString(body?.username)
  const email = cleanString(body?.email).toLowerCase()
  const avatar = typeof body?.avatar === 'string' ? body.avatar : null

  assert(username.length >= 3, 'Le nom d\'utilisateur doit faire 3 caractères minimum.')
  assert(EMAIL_RE.test(email), 'Format d\'email invalide.')

  const db = useDb()
  const taken = db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, current.id)
  assert(!taken, 'Cet email est déjà utilisé par un autre compte.', 409)

  db.prepare('UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE id = ?')
    .run(username, email, avatar, current.id)

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(current.id) as UserRow
  return { user: toPublicUser(user) }
})
