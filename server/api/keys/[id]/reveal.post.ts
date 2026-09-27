import type { ApiKeyRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'

/** Révèle le secret d'une clé pour permettre la copie, et note l'accès. */
export default defineEventHandler((event) => {
  const user = requireUser(event)
  const id = Number(getRouterParam(event, 'id'))

  assert(Number.isInteger(id), 'Identifiant de clé invalide.')

  const db = useDb()
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?')
    .get(id, user.id) as ApiKeyRow | undefined

  assert(row, 'Clé introuvable.', 404)

  db.prepare(`UPDATE api_keys SET last_used = datetime('now') WHERE id = ?`).run(id)
  return { secret: row!.secret }
})
