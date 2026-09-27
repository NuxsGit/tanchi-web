import type { UserRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)

  const username = cleanString(body?.username)
  const email = cleanString(body?.email).toLowerCase()
  const password = typeof body?.password === 'string' ? body.password : ''

  assert(username.length >= 3, 'Le nom d\'utilisateur doit faire 3 caractères minimum.')
  assert(EMAIL_RE.test(email), 'Format d\'email invalide.')
  assert(password.length >= 8, 'Le mot de passe doit faire 8 caractères minimum.')

  const db = useDb()
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)
  assert(!exists, 'Un compte existe déjà avec cet email.', 409)

  // Le premier compte créé est propriétaire de l'instance.
  const isFirst = !db.prepare('SELECT 1 FROM users LIMIT 1').get()

  const info = db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username, email, hashPassword(password), isFirst ? 'Propriétaire' : 'Administrateur')

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow
  createSession(event, user.id)

  return { user: toPublicUser(user) }
})
