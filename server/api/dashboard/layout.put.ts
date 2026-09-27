import { useDb } from '~~/server/utils/db'
import { normalizeLayout } from '~~/shared/dashboard'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<{ layout?: unknown }>(event)

  assert(body?.layout && typeof body.layout === 'object', 'Grille invalide.')

  const layout = normalizeLayout(body.layout)
  assert(layout.widgets.length <= 40, 'Trop de widgets sur la grille.', 413)

  useDb().prepare(`
    INSERT INTO dashboard_layouts (user_id, data, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(user.id, JSON.stringify(layout))

  return { ok: true, layout }
})
