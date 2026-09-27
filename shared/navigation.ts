import { findApp, isPinnable, normalizePinnedApps } from './apps'

/** Arborescence de navigation de l'application privée. */

export interface NavLink {
  label: string
  /** Libellé court affiché en mode replié et sur mobile. */
  short: string
  icon: string
  to: string
  badge?: string
  /** N'est actif que sur cette route exacte, pas sur ses sous-routes. */
  exact?: boolean
}

export interface NavSection {
  id: string
  label: string
  links: NavLink[]
  /** Message affiché quand la section est vide. */
  empty?: string
}

const PILOTAGE: NavLink[] = [
  {
    label: 'Tableau de bord',
    short: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    to: '/dashboard'
  },
  {
    label: 'Équipes & projets',
    short: 'Équipes',
    icon: 'i-lucide-users',
    to: '/teams'
  }
]

const SYSTEME: NavLink[] = [
  {
    label: 'Paramètres',
    short: 'Paramètres',
    icon: 'i-lucide-settings',
    to: '/settings'
  }
]

const HUB: NavLink = {
  label: 'Toutes les applications',
  short: 'Hub',
  icon: 'i-lucide-layout-grid',
  to: '/apps',
  exact: true
}

/**
 * Navigation effective d'un utilisateur.
 *
 * Par défaut la section Applications ne contient que le hub : les modules ne
 * s'y ajoutent que si l'utilisateur les épingle depuis `/apps`, pour éviter
 * une barre latérale saturée dès la première connexion.
 */
export function buildNavigation(pinnedApps: unknown): NavSection[] {
  const pinned = normalizePinnedApps(pinnedApps)

  const appLinks: NavLink[] = pinned
    .map(findApp)
    .filter((app): app is NonNullable<typeof app> => Boolean(app) && isPinnable(app!))
    .map(app => ({
      label: app.name,
      short: app.short,
      icon: app.icon,
      to: app.to!
    }))

  return [
    { id: 'pilotage', label: 'Pilotage', links: PILOTAGE },
    {
      id: 'applications',
      label: 'Applications',
      links: [HUB, ...appLinks],
      empty: 'Épinglez vos modules depuis le hub.'
    },
    { id: 'systeme', label: 'Système', links: SYSTEME }
  ]
}

/** Un lien est actif sur sa route, et sur ses sous-routes sauf si `exact`. */
export function isLinkActive(link: NavLink, path: string): boolean {
  if (path === link.to) return true
  return link.exact ? false : path.startsWith(`${link.to}/`)
}
