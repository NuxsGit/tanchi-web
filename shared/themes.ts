export type ThemeId = 'vert-noir' | 'blanc-vert' | 'nothing-jaune' | 'nothing-rouge'
export type ThemeFamily = 'tanchi' | 'nothing'
export type ColorScheme = 'dark' | 'light'
/** Préférence utilisateur : `system` suit le réglage du navigateur. */
export type ColorModeName = ColorScheme | 'system'

export interface ThemeDefinition {
  id: ThemeId
  family: ThemeFamily
  label: string
  description: string
  scheme: ColorScheme
  /** Aperçu : [fond, surface, accent]. */
  preview: [string, string, string]
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'vert-noir',
    family: 'tanchi',
    label: 'Vert & Noir',
    description: 'Terminal phosphore sur fond noir.',
    scheme: 'dark',
    preview: ['#050705', '#0c110c', '#22c55e']
  },
  {
    id: 'blanc-vert',
    family: 'tanchi',
    label: 'Blanc & Vert',
    description: 'Fond clair, accent vert. Lisible en plein jour.',
    scheme: 'light',
    preview: ['#fbfdfb', '#f1f7f2', '#15803d']
  },
  {
    id: 'nothing-rouge',
    family: 'nothing',
    label: 'Rouge & Noir',
    description: 'Noir profond et rouge glyphe, façon Nothing OS première génération.',
    scheme: 'dark',
    preview: ['#000000', '#0d0d0d', '#d71921']
  },
  {
    id: 'nothing-jaune',
    family: 'nothing',
    label: 'Jaune & Blanc',
    description: 'Blanc laiteux et jaune signal, façon Nothing OS 4.',
    scheme: 'light',
    preview: ['#ffffff', '#f4f4f4', '#ffe600']
  }
]

export interface FamilyDefinition {
  id: ThemeFamily
  label: string
  description: string
}

export const THEME_FAMILIES: FamilyDefinition[] = [
  { id: 'tanchi', label: 'Tanchi', description: 'Vert phosphore — noir la nuit, blanc le jour.' },
  { id: 'nothing', label: 'Nothing', description: 'Monochrome mécanique — rouge la nuit, jaune le jour.' }
]

export const THEME_IDS = THEMES.map(t => t.id)
export const FAMILY_IDS = THEME_FAMILIES.map(f => f.id)
export const COLOR_MODES: ColorModeName[] = ['dark', 'light', 'system']
export const DEFAULT_THEME: ThemeId = 'vert-noir'

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_IDS.includes(value as ThemeId)
}

export function getTheme(id: string | null | undefined): ThemeDefinition {
  return THEMES.find(t => t.id === id) ?? THEMES[0]!
}

/** Palette correspondant à une famille et à un schéma donnés. */
export function resolveTheme(family: ThemeFamily, scheme: ColorScheme): ThemeDefinition {
  return THEMES.find(t => t.family === family && t.scheme === scheme) ?? THEMES[0]!
}
