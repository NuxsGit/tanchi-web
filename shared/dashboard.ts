/** Grille de widgets du tableau de bord — 7 colonnes × 14 rangées. */

export const GRID_COLS = 7
export const GRID_ROWS = 14

export type WidgetType =
  | 'tasks-board'
  | 'tasks-mine'
  | 'team-projects'
  | 'team-members'
  | 'fmd-summary'
  | 'shortcuts'
  | 'note'

export interface WidgetOptions {
  teamId?: number
  projectId?: number
  title?: string
  text?: string
}

export interface WidgetInstance {
  id: string
  type: WidgetType
  x: number
  y: number
  w: number
  h: number
  options?: WidgetOptions
}

export interface DashboardLayout {
  widgets: WidgetInstance[]
}

export interface WidgetSpec {
  type: WidgetType
  label: string
  description: string
  icon: string
  /** Origine du contenu, affichée dans la palette. */
  source: string
  defaultSize: { w: number, h: number }
  minSize: { w: number, h: number }
  /** Contexte que le widget demande à l'utilisateur. */
  scope?: 'team' | 'project'
}

export const WIDGET_CATALOG: WidgetSpec[] = [
  {
    type: 'tasks-board',
    label: 'Avancement du projet',
    description: 'Répartition des tâches par colonne pour un projet.',
    icon: 'i-lucide-square-kanban',
    source: 'TanchiTaskTeam',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    scope: 'project'
  },
  {
    type: 'tasks-mine',
    label: 'Mes tâches',
    description: 'Ce qui vous est assigné, toutes équipes confondues.',
    icon: 'i-lucide-list-checks',
    source: 'TanchiTaskTeam',
    defaultSize: { w: 3, h: 5 },
    minSize: { w: 2, h: 3 }
  },
  {
    type: 'team-projects',
    label: 'Projets de l\'équipe',
    description: 'Progression de chaque projet d\'une équipe.',
    icon: 'i-lucide-folder-kanban',
    source: 'Équipes',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    scope: 'team'
  },
  {
    type: 'team-members',
    label: 'Membres',
    description: 'Composition d\'une équipe et charge assignée.',
    icon: 'i-lucide-users',
    source: 'Équipes',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    scope: 'team'
  },
  {
    type: 'fmd-summary',
    label: 'Matrices de flux',
    description: 'Flux, règles allow/deny et conflits détectés.',
    icon: 'i-lucide-git-fork',
    source: 'FlowMatrix Designer',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 }
  },
  {
    type: 'shortcuts',
    label: 'Raccourcis',
    description: 'Accès direct aux modules de la suite.',
    icon: 'i-lucide-compass',
    source: 'Tanchi Web',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 }
  },
  {
    type: 'note',
    label: 'Note',
    description: 'Pense-bête libre, enregistré avec la grille.',
    icon: 'i-lucide-sticky-note',
    source: 'Tanchi Web',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 }
  }
]

export function specOf(type: string): WidgetSpec | undefined {
  return WIDGET_CATALOG.find(spec => spec.type === type)
}

/* --------------------------------------------------------------- Géométrie */

export interface Rect { x: number, y: number, w: number, h: number }

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function withinGrid(rect: Rect): boolean {
  return rect.x >= 0 && rect.y >= 0
    && rect.w >= 1 && rect.h >= 1
    && rect.x + rect.w <= GRID_COLS
    && rect.y + rect.h <= GRID_ROWS
}

/** Emplacement libre : dans la grille et sans recouvrement. */
export function isFree(rect: Rect, widgets: WidgetInstance[], ignoreId?: string): boolean {
  if (!withinGrid(rect)) return false
  return !widgets.some(widget => widget.id !== ignoreId && overlaps(rect, widget))
}

/** Première case libre pouvant accueillir un bloc, en balayant de haut en bas. */
export function findSlot(
  size: { w: number, h: number },
  widgets: WidgetInstance[]
): Rect | null {
  for (let y = 0; y <= GRID_ROWS - size.h; y++) {
    for (let x = 0; x <= GRID_COLS - size.w; x++) {
      const rect = { x, y, w: size.w, h: size.h }
      if (isFree(rect, widgets)) return rect
    }
  }
  return null
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/* ---------------------------------------------------- Normalisation stockée */

function sanitizeWidget(raw: unknown, index: number): WidgetInstance | null {
  const item = (raw ?? {}) as Partial<WidgetInstance>
  const spec = specOf(String(item.type))
  if (!spec) return null

  const w = clamp(Number(item.w) || spec.defaultSize.w, spec.minSize.w, GRID_COLS)
  const h = clamp(Number(item.h) || spec.defaultSize.h, spec.minSize.h, GRID_ROWS)
  const x = clamp(Number(item.x) || 0, 0, GRID_COLS - w)
  const y = clamp(Number(item.y) || 0, 0, GRID_ROWS - h)

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `w${index}-${spec.type}`,
    type: spec.type,
    x, y, w, h,
    options: typeof item.options === 'object' && item.options ? item.options : undefined
  }
}

/** Remet une grille arbitraire dans un état affichable, sans recouvrement. */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const source = (raw ?? {}) as Partial<DashboardLayout>
  const candidates = Array.isArray(source.widgets) ? source.widgets : []

  const widgets: WidgetInstance[] = []
  for (const [index, candidate] of candidates.entries()) {
    const widget = sanitizeWidget(candidate, index)
    if (!widget) continue

    if (isFree(widget, widgets)) {
      widgets.push(widget)
      continue
    }

    // Emplacement occupé après une modification manuelle : on replace au plus près.
    const slot = findSlot({ w: widget.w, h: widget.h }, widgets)
    if (slot) widgets.push({ ...widget, ...slot })
  }

  return { widgets }
}

/** Grille proposée à la première connexion. */
export function defaultLayout(): DashboardLayout {
  return {
    widgets: [
      { id: 'd1', type: 'tasks-mine', x: 0, y: 0, w: 3, h: 5 },
      { id: 'd2', type: 'team-projects', x: 3, y: 0, w: 4, h: 4 },
      { id: 'd3', type: 'fmd-summary', x: 3, y: 4, w: 4, h: 3 },
      { id: 'd4', type: 'shortcuts', x: 0, y: 5, w: 3, h: 2 }
    ]
  }
}
