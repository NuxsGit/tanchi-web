import type { ApiKeyRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { generateSecret, maskSecret, toPublicKey } from '~~/server/utils/keys'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const name = cleanString(body?.name)
  assert(name.length > 0, 'Le nom de la clé est requis.')
  assert(name.length <= 64, 'Le nom ne doit pas dépasser 64 caractères.')

  const secret = generateSecret()
  const db = useDb()
  const info = db.prepare(
    'INSERT INTO api_keys (user_id, name, secret, masked) VALUES (?, ?, ?, ?)'
  ).run(user.id, name, secret, maskSecret(secret))

  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(info.lastInsertRowid) as ApiKeyRow

  // Le secret en clair n'est renvoyé qu'ici, à la création.
  return { key: toPublicKey(row), secret }
})
