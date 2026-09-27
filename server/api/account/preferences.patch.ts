import type { UserRow } from '~~/server/utils/db'
import { useDb } from '~~/server/utils/db'
import { THEME_IDS, COLOR_MODES } from '~~/shared/themes'
import { normalizePinnedApps } from '~~/shared/apps'

export default defineEventHandler(async (event) => {
  const current = requireUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const theme = cleanString(body?.theme) || current.theme
  const colorMode = cleanString(body?.colorMode) || current.color_mode
  const twoFactor = typeof body?.twoFactor === 'boolean' ? body.twoFactor : current.two_factor === 1

  assert(THEME_IDS.includes(theme as never), 'Thème inconnu.')
  assert(COLOR_MODES.includes(colorMode as never), 'Mode de couleur inconnu.')

  const db = useDb()

  // `pinnedApps` absent = préférence inchangée ; tableau vide = tout dépinglé.
  if (body?.pinnedApps !== undefined) {
    db.prepare('UPDATE users SET pinned_apps = ? WHERE id = ?')
      .run(JSON.stringify(normalizePinnedApps(body.pinnedApps)), current.id)
  }

  db.prepare('UPDATE users SET theme = ?, color_mode = ?, two_factor = ? WHERE id = ?')
    .run(theme, colorMode, twoFactor ? 1 : 0, current.id)

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(current.id) as UserRow
  return { user: toPublicUser(user) }
})
