type SidebarMode = 'full' | 'rail'

/**
 * État de la barre latérale.
 *
 * Le mode est mémorisé en cookie : le serveur rend directement la bonne
 * largeur, sans saut de mise en page à l'hydratation.
 *
 * Les valeurs sont volontairement alphabétiques : `useCookie` passe la valeur
 * dans `destr`, qui convertirait `"1"` en nombre et ferait échouer la
 * comparaison avec une chaîne.
 */
export const useSidebar = () => {
  const cookie = useCookie<SidebarMode>('tanchi_sidebar', {
    default: () => 'full',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  })

  const collapsed = useState<boolean>('tanchi-sidebar-collapsed', () => cookie.value === 'rail')

  /** Tiroir mobile — volontairement non persisté. */
  const mobileOpen = useState<boolean>('tanchi-sidebar-mobile', () => false)

  const toggle = () => {
    collapsed.value = !collapsed.value
    cookie.value = collapsed.value ? 'rail' : 'full'
  }

  return { collapsed, mobileOpen, toggle }
}
