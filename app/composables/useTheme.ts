import {
  DEFAULT_THEME,
  FAMILY_IDS,
  getTheme,
  resolveTheme,
  THEME_FAMILIES,
  THEMES,
  type ColorModeName,
  type ColorScheme,
  type ThemeFamily,
  type ThemeId
} from '~~/shared/themes'

/**
 * Pur état — aucun `useHead` ici : la balise `<html>` est rendue par `app.vue`,
 * ce qui rend ce composable appelable depuis un middleware de route.
 *
 * Deux réglages indépendants :
 *  - le **mode** (sombre / clair / système), délégué à `useColorMode()` ;
 *  - la **famille** de palette (Tanchi, Nothing).
 *
 * Leur croisement donne la palette appliquée via `data-theme` sur `<html>`.
 */
export const useTheme = () => {
  const colorMode = useColorMode()

  const familyCookie = useCookie<ThemeFamily>('tanchi_theme_family', {
    default: () => 'tanchi',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  })

  const family = useState<ThemeFamily>('tanchi-theme-family', () => familyCookie.value ?? 'tanchi')

  /**
   * Schéma réellement appliqué.
   *
   * Au rendu serveur, seul `preference` est alimenté par le cookie ; `value`
   * n'est résolu qu'après hydratation. On lit donc `preference` en priorité et
   * on ne retombe sur `value` que pour le mode « système », que le serveur ne
   * peut de toute façon pas deviner.
   */
  const scheme = computed<ColorScheme>(() => {
    const preference = colorMode.preference
    if (preference === 'light' || preference === 'dark') return preference
    return colorMode.value === 'light' ? 'light' : 'dark'
  })

  const theme = computed(() => resolveTheme(family.value, scheme.value))
  const themeId = computed<ThemeId>(() => theme.value.id)

  const mode = computed<ColorModeName>({
    get: () => (colorMode.preference as ColorModeName) ?? 'dark',
    set: value => { colorMode.preference = value }
  })

  const setFamily = (value: string) => {
    if (!FAMILY_IDS.includes(value as ThemeFamily)) return
    family.value = value as ThemeFamily
    familyCookie.value = value as ThemeFamily
  }

  const setMode = (value: ColorModeName) => { mode.value = value }

  /** Restaure une palette enregistrée (compte) en déduisant famille + mode. */
  const applyThemeId = (id: string | null | undefined) => {
    const definition = getTheme(id ?? DEFAULT_THEME)
    setFamily(definition.family)
  }

  return {
    themeId,
    theme,
    themes: THEMES,
    family,
    families: THEME_FAMILIES,
    mode,
    scheme,
    setFamily,
    setMode,
    applyThemeId
  }
}
