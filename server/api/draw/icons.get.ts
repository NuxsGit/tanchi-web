import { icons as lucide } from '@iconify-json/lucide'
import { DRAW_ICON_NAMES } from '~~/shared/draw/library'

/**
 * Tracés des icônes de TanchiDraw.
 *
 * La planche est du SVG de bout en bout — c'est ce qui permet de l'exporter en
 * image fidèle — donc l'application a besoin des chemins eux-mêmes, pas d'une
 * police d'icônes rendue en CSS. Le jeu Lucide est déjà installé localement :
 * aucune requête vers Internet, et le rendu reste identique hors ligne.
 */

const PREFIX = 'i-lucide-'

/** Résout un alias vers son tracé d'origine. Les chaînes sont courtes. */
function bodyOf(name: string): string | null {
  let key = name.startsWith(PREFIX) ? name.slice(PREFIX.length) : name

  for (let hop = 0; hop < 4; hop++) {
    const icon = lucide.icons[key]
    if (icon?.body) return icon.body

    const alias = lucide.aliases?.[key]
    if (!alias?.parent) return null
    key = alias.parent
  }

  return null
}

const library = new Map<string, string>()

/** Le catalogue ne change pas d'une requête à l'autre : on le résout une fois. */
function libraryBodies(): Map<string, string> {
  if (library.size) return library

  for (const name of DRAW_ICON_NAMES) {
    const body = bodyOf(name)
    if (body) library.set(name, body)
  }

  return library
}

export default defineEventHandler((event) => {
  requireUser(event)

  const requested = String(getQuery(event).names ?? '')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
    .slice(0, 400)

  const icons: Record<string, string> = {}

  if (requested.length) {
    // Un plan enregistré peut désigner une icône hors catalogue : on la sert
    // à la demande plutôt que de laisser un trou dans le schéma.
    for (const name of requested) {
      const body = libraryBodies().get(name) ?? bodyOf(name)
      if (body) icons[name] = body
    }
  } else {
    for (const [name, body] of libraryBodies()) icons[name] = body
  }

  // Les tracés Lucide sont figés par la version du paquet : le cache navigateur
  // évite de retransmettre 140 icônes à chaque ouverture de l'atelier.
  setHeader(event, 'cache-control', 'private, max-age=86400')

  return {
    width: lucide.width ?? 24,
    height: lucide.height ?? 24,
    icons
  }
})
