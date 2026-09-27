import { useDb } from '~~/server/utils/db'
import { defaultLayout, normalizeLayout } from '~~/shared/dashboard'

export default defineEventHandler((event) => {
  const user = requireUser(event)

  const row = useDb()
    .prepare('SELECT data FROM dashboard_layouts WHERE user_id = ?')
    .get(user.id) as { data: string } | undefined

  if (!row) return { layout: defaultLayout(), pristine: true }

  try {
    return { layout: normalizeLayout(JSON.parse(row.data)), pristine: false }
  } catch {
    return { layout: defaultLayout(), pristine: true }
  }
})
