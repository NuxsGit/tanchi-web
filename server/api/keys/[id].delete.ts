import { useDb } from '~~/server/utils/db'

export default defineEventHandler((event) => {
  const user = requireUser(event)
  const id = Number(getRouterParam(event, 'id'))

  assert(Number.isInteger(id), 'Identifiant de clé invalide.')

  const info = useDb()
    .prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?')
    .run(id, user.id)

  assert(info.changes > 0, 'Clé introuvable.', 404)
  return { ok: true }
})
