import type { UserRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)

  const email = cleanString(body?.email).toLowerCase()
  const password = typeof body?.password === 'string' ? body.password : ''

  assert(EMAIL_RE.test(email), 'Format d\'email invalide.')
  assert(password.length > 0, 'Le mot de passe est requis.')

  const user = useDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined

  // Message identique dans les deux cas : pas d'énumération de comptes.
  assert(user && verifyPassword(password, user.password_hash), 'Email ou mot de passe incorrect.', 401)

  createSession(event, user!.id)
  return { user: toPublicUser(user!) }
})
