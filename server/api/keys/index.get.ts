import type { ApiKeyRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { toPublicKey } from '~~/server/utils/keys'

export default defineEventHandler((event) => {
  const user = requireUser(event)

  const rows = useDb()
    .prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY id DESC')
    .all(user.id) as ApiKeyRow[]

  return { keys: rows.map(toPublicKey) }
})
