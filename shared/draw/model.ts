/**
 * Modèle de plan de TanchiDraw.
 *
 * Une page est une planche de taille fixe (16/9) : c'est ce qui permet de
 * présenter plein écran et d'exporter une image sans surprise de cadrage.
 * Le contenu se répartit en deux familles — des formes (icônes, boîtes, zones,
 * textes) et des flèches qui les relient. Les flèches s'accrochent aux formes :
 * déplacer un serveur entraîne ses liaisons, ce qui évite de tout redessiner à
 * chaque ajustement.
 *
 * Toutes les couleurs sont stockées en hexadécimal, jamais en variable de
 * thème : un plan exporté doit rester identique à ce qui était à l'écran, quel
 * que soit le thème de l'interface.
 */

export type ShapeKind = 'icon' | 'rect' | 'ellipse' | 'diamond' | 'zone' | 'note' | 'text'
export type Dash = 'solid' | 'dashed' | 'dotted'
export type Align = 'left' | 'center' | 'right'
export type Routing = 'straight' | 'curved' | 'elbow'
export type Side = 'auto' | 'top' | 'right' | 'bottom' | 'left'
export type BackgroundId = 'blanc' | 'ivoire' | 'ardoise' | 'noir'

export interface Style {
  /** Remplissage : hexadécimal, avec canal alpha optionnel, ou `none`. */
  fill: string
  stroke: string
  strokeWidth: number
  dash: Dash
  opacity: number
  radius: number
  /** Couleur du texte et du glyphe d'icône. */
  color: string
  fontSize: number
  bold: boolean
  align: Align
}

export interface Shape {
  id: string
  kind: ShapeKind
  x: number
  y: number
  w: number
  h: number
  text?: string
  /** Nom Iconify, pour les formes de type `icon`. */
  icon?: string
  style: Style
  /** Une forme verrouillée reste visible mais ne se sélectionne plus. */
  locked?: boolean
}

export interface Endpoint {
  /** Forme d'accroche. Absente pour une extrémité libre. */
  shapeId?: string
  side: Side
  /** Position absolue, utilisée quand l'extrémité est libre. */
  x: number
  y: number
}

export interface Connector {
  id: string
  from: Endpoint
  to: Endpoint
  label?: string
  routing: Routing
  startArrow: boolean
  endArrow: boolean
  style: Style
}

export interface Page {
  id: string
  name: string
  background: BackgroundId
  grid: boolean
  shapes: Shape[]
  connectors: Connector[]
}

export interface DrawWorkspace {
  title: string
  pages: Page[]
  activePageId: string
  updatedAt: string
}

/* ------------------------------------------------------------ Constantes */

export const PAGE_W = 1600
export const PAGE_H = 900
export const GRID = 10
/** Écart entre la bordure d'une forme et la pointe de la flèche. */
export const ANCHOR_GAP = 8

export interface BackgroundSpec {
  id: BackgroundId
  label: string
  /** Couleur de la planche. */
  color: string
  /** Trame de fond. */
  grid: string
  /** Encre lisible sur ce fond : couleur par défaut des formes créées. */
  ink: string
  /** Remplissage par défaut des boîtes posées sur ce fond. */
  surface: string
}

export const BACKGROUNDS: BackgroundSpec[] = [
  { id: 'blanc', label: 'Blanc', color: '#ffffff', grid: '#e2e8f0', ink: '#0f172a', surface: '#f1f5f9' },
  { id: 'ivoire', label: 'Ivoire', color: '#faf7f2', grid: '#e8ddcc', ink: '#1c1917', surface: '#f2ece1' },
  { id: 'ardoise', label: 'Ardoise', color: '#0f172a', grid: '#1e293b', ink: '#e2e8f0', surface: '#1e293b' },
  { id: 'noir', label: 'Noir', color: '#0a0a0a', grid: '#1f1f1f', ink: '#fafafa', surface: '#1c1c1c' }
]

export function backgroundOf(id: BackgroundId): BackgroundSpec {
  return BACKGROUNDS.find(item => item.id === id) ?? BACKGROUNDS[0]!
}

export interface Swatch {
  id: string
  label: string
  hex: string
}

/** Nuancier commun aux traits, aux textes et aux glyphes. */
export const PALETTE: Swatch[] = [
  { id: 'encre', label: 'Encre', hex: '#0f172a' },
  { id: 'ardoise', label: 'Ardoise', hex: '#475569' },
  { id: 'gris', label: 'Gris', hex: '#94a3b8' },
  { id: 'blanc', label: 'Blanc', hex: '#ffffff' },
  { id: 'bleu', label: 'Bleu', hex: '#2563eb' },
  { id: 'ciel', label: 'Ciel', hex: '#0ea5e9' },
  { id: 'cyan', label: 'Cyan', hex: '#0891b2' },
  { id: 'emeraude', label: 'Émeraude', hex: '#10b981' },
  { id: 'vert', label: 'Vert', hex: '#16a34a' },
  { id: 'citron', label: 'Citron', hex: '#84cc16' },
  { id: 'ambre', label: 'Ambre', hex: '#f59e0b' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'rouge', label: 'Rouge', hex: '#dc2626' },
  { id: 'rose', label: 'Rose', hex: '#ec4899' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  { id: 'brun', label: 'Brun', hex: '#a16207' },
  { id: 'sable', label: 'Sable', hex: '#d6d3d1' }
]

/**
 * Teinte douce d'une couleur : le même hexadécimal, à 15 % d'opacité.
 *
 * Un aplat plein derrière une icône la rend illisible ; la teinte douce donne
 * la couleur du service sans écraser le symbole.
 */
export function soften(hex: string): string {
  return hex === 'none' ? 'none' : `${hex}26`
}

export interface ShapePreset {
  kind: ShapeKind
  label: string
  icon: string
  w: number
  h: number
  hint: string
}

export const SHAPE_PRESETS: ShapePreset[] = [
  { kind: 'rect', label: 'Rectangle', icon: 'i-lucide-square', w: 240, h: 120, hint: 'Boîte, service, étape' },
  { kind: 'ellipse', label: 'Ellipse', icon: 'i-lucide-circle', w: 220, h: 140, hint: 'Nuage, acteur, périmètre' },
  { kind: 'diamond', label: 'Losange', icon: 'i-lucide-diamond', w: 200, h: 140, hint: 'Décision, aiguillage' },
  { kind: 'zone', label: 'Zone', icon: 'i-lucide-square-dashed', w: 460, h: 320, hint: 'Site, VLAN, DMZ' },
  { kind: 'note', label: 'Post-it', icon: 'i-lucide-sticky-note', w: 220, h: 170, hint: 'Remarque, rappel' },
  { kind: 'text', label: 'Texte', icon: 'i-lucide-type', w: 320, h: 52, hint: 'Titre, légende' }
]

export const ICON_DEFAULT_W = 128
export const ICON_DEFAULT_H = 128

/* -------------------------------------------------------------- Fabrique */

export function genId(prefix = 's'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function snap(value: number, enabled = true): number {
  return enabled ? Math.round(value / GRID) * GRID : Math.round(value)
}

/** Style par défaut, accordé au fond de la page. */
export function defaultStyle(background: BackgroundId = 'blanc'): Style {
  const spec = backgroundOf(background)
  return {
    fill: spec.surface,
    stroke: spec.ink,
    strokeWidth: 2,
    dash: 'solid',
    opacity: 1,
    radius: 10,
    color: spec.ink,
    fontSize: 16,
    bold: false,
    align: 'center'
  }
}

/**
 * Ajuste le style à la nature de la forme.
 *
 * Une icône ou un texte n'a pas de cadre : leur imposer le remplissage des
 * boîtes brouillerait le plan. Le post-it, lui, tire sa lisibilité de son aplat.
 */
export function styleForKind(kind: ShapeKind, base: Style): Style {
  switch (kind) {
    case 'icon':
      return { ...base, fill: 'none', stroke: 'none', strokeWidth: 0, fontSize: 15, align: 'center' }
    case 'text':
      return { ...base, fill: 'none', stroke: 'none', strokeWidth: 0, fontSize: 24, bold: true, align: 'left' }
    case 'zone':
      return { ...base, fill: soften(base.stroke), dash: 'dashed', radius: 16, fontSize: 15, align: 'left' }
    case 'note':
      return { ...base, fill: '#fde68a', stroke: '#f59e0b', color: '#451a03', radius: 4, align: 'left' }
    case 'diamond':
      return { ...base, radius: 0 }
    default:
      return { ...base }
  }
}

export interface ShapeInit {
  text?: string
  icon?: string
  w?: number
  h?: number
  style?: Partial<Style>
}

export function createShape(kind: ShapeKind, x: number, y: number, init: ShapeInit = {}, background: BackgroundId = 'blanc'): Shape {
  const preset = SHAPE_PRESETS.find(item => item.kind === kind)
  const w = init.w ?? preset?.w ?? ICON_DEFAULT_W
  const h = init.h ?? preset?.h ?? ICON_DEFAULT_H

  return {
    id: genId(),
    kind,
    x: Math.round(x),
    y: Math.round(y),
    w,
    h,
    text: init.text,
    icon: init.icon,
    style: { ...styleForKind(kind, defaultStyle(background)), ...init.style }
  }
}

export function createConnector(from: Endpoint, to: Endpoint, style: Style, routing: Routing = 'curved'): Connector {
  return {
    id: genId('c'),
    from,
    to,
    routing,
    startArrow: false,
    endArrow: true,
    style: { ...style, fill: 'none' }
  }
}

/** Extrémité accrochée à une forme, côté déduit à l'affichage. */
export function attachedEnd(shapeId: string, side: Side = 'auto'): Endpoint {
  return { shapeId, side, x: 0, y: 0 }
}

export function freeEnd(x: number, y: number): Endpoint {
  return { side: 'auto', x, y }
}

/* ------------------------------------------------------------ Géométrie */

export interface Point { x: number, y: number }
export interface Anchor extends Point { nx: number, ny: number }

export function shapeCenter(shape: Shape): Point {
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 }
}

export function anchorOf(shape: Shape, side: Exclude<Side, 'auto'>): Anchor {
  const center = shapeCenter(shape)
  switch (side) {
    case 'top': return { x: center.x, y: shape.y, nx: 0, ny: -1 }
    case 'bottom': return { x: center.x, y: shape.y + shape.h, nx: 0, ny: 1 }
    case 'left': return { x: shape.x, y: center.y, nx: -1, ny: 0 }
    case 'right': return { x: shape.x + shape.w, y: center.y, nx: 1, ny: 0 }
  }
}

/**
 * Côté par lequel une flèche quitte une forme.
 *
 * La comparaison se fait en proportion des demi-dimensions : sur une zone très
 * large, une cible située juste au-dessus doit sortir par le haut, pas par le
 * côté le plus proche en distance absolue.
 */
export function autoSide(shape: Shape, target: Point): Exclude<Side, 'auto'> {
  const center = shapeCenter(shape)
  const dx = (target.x - center.x) / Math.max(1, shape.w / 2)
  const dy = (target.y - center.y) / Math.max(1, shape.h / 2)

  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function resolveEnd(end: Endpoint, shapes: Map<string, Shape>, towards: Point): Anchor {
  const shape = end.shapeId ? shapes.get(end.shapeId) : undefined
  if (!shape) return { x: end.x, y: end.y, nx: 0, ny: 0 }

  const side = end.side === 'auto' ? autoSide(shape, towards) : end.side
  const anchor = anchorOf(shape, side)

  return {
    x: anchor.x + anchor.nx * ANCHOR_GAP,
    y: anchor.y + anchor.ny * ANCHOR_GAP,
    nx: anchor.nx,
    ny: anchor.ny
  }
}

export interface ConnectorGeometry {
  d: string
  a: Point
  b: Point
  /** Orientation des pointes, en radians. */
  angleA: number
  angleB: number
  /** Point d'ancrage de l'étiquette. */
  mid: Point
}

export function connectorGeometry(connector: Connector, shapes: Map<string, Shape>): ConnectorGeometry {
  const fromShape = connector.from.shapeId ? shapes.get(connector.from.shapeId) : undefined
  const toShape = connector.to.shapeId ? shapes.get(connector.to.shapeId) : undefined

  // Chaque extrémité vise le centre de l'autre : c'est ce qui oriente le
  // côté de sortie quand il est laissé en automatique.
  const towardsFrom = toShape ? shapeCenter(toShape) : { x: connector.to.x, y: connector.to.y }
  const towardsTo = fromShape ? shapeCenter(fromShape) : { x: connector.from.x, y: connector.from.y }

  const a = resolveEnd(connector.from, shapes, towardsFrom)
  const b = resolveEnd(connector.to, shapes, towardsTo)

  if (connector.routing === 'elbow') {
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2

    const d = horizontal
      ? `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`
      : `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`

    return {
      d,
      a,
      b,
      angleA: horizontal ? Math.atan2(0, midX - a.x) : Math.atan2(midY - a.y, 0),
      angleB: horizontal ? Math.atan2(0, b.x - midX) : Math.atan2(b.y - midY, 0),
      mid: { x: midX, y: midY }
    }
  }

  if (connector.routing === 'straight') {
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    return {
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
      a,
      b,
      angleA: angle,
      angleB: angle,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  }

  // Courbe : les poignées suivent la normale de sortie, ce qui donne un
  // départ perpendiculaire à la face de l'équipement.
  const distance = Math.hypot(b.x - a.x, b.y - a.y)
  const pull = Math.min(220, Math.max(60, distance * 0.42))

  const c1 = {
    x: a.x + (a.nx || Math.sign(b.x - a.x) || 1) * pull,
    y: a.y + a.ny * pull
  }
  const c2 = {
    x: b.x + (b.nx || Math.sign(a.x - b.x) || -1) * pull,
    y: b.y + b.ny * pull
  }

  return {
    d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`,
    a,
    b,
    angleA: Math.atan2(c1.y - a.y, c1.x - a.x),
    angleB: Math.atan2(b.y - c2.y, b.x - c2.x),
    mid: {
      // Point milieu d'une cubique de Bézier (t = 0,5).
      x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
      y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8
    }
  }
}

/** Pointe de flèche pleine, orientée le long de la liaison. */
export function arrowHead(point: Point, angle: number, size: number): string {
  const spread = 0.42
  const x1 = point.x - size * Math.cos(angle - spread)
  const y1 = point.y - size * Math.sin(angle - spread)
  const x2 = point.x - size * Math.cos(angle + spread)
  const y2 = point.y - size * Math.sin(angle + spread)
  return `M ${point.x} ${point.y} L ${x1} ${y1} L ${x2} ${y2} Z`
}

export function dashArray(dash: Dash, width: number): string | undefined {
  if (dash === 'dashed') return `${width * 4} ${width * 3}`
  if (dash === 'dotted') return `${width * 0.1} ${width * 2.2}`
  return undefined
}

/* ------------------------------------------------------------- Textes */

/**
 * Découpe un texte pour qu'il tienne dans une largeur donnée.
 *
 * On mesure en largeur moyenne de caractère plutôt qu'avec le moteur de rendu :
 * le calcul doit rester pur pour être identique à l'écran, à l'export et côté
 * serveur.
 */
export function wrapText(text: string, width: number, fontSize: number): string[] {
  const perChar = fontSize * 0.55
  const max = Math.max(6, Math.floor(width / perChar))
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }

    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length <= max) {
        current = candidate
        continue
      }
      if (current) lines.push(current)
      // Un mot plus long que la ligne (une URL, un nom d'hôte) est coupé net.
      current = word.length > max ? `${word.slice(0, max - 1)}…` : word
    }
    if (current) lines.push(current)
  }

  return lines.slice(0, 12)
}

export interface TextLayout {
  lines: string[]
  x: number
  /** Ligne de base de la première ligne. */
  y: number
  anchor: 'start' | 'middle' | 'end'
  lineHeight: number
}

const PADDING = 12

function anchorFor(align: Align): 'start' | 'middle' | 'end' {
  return align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
}

function anchorX(shape: Shape): number {
  if (shape.style.align === 'left') return shape.x + PADDING
  if (shape.style.align === 'right') return shape.x + shape.w - PADDING
  return shape.x + shape.w / 2
}

/** Hauteur réservée au libellé d'une icône, glyphe exclu. */
export function iconLabelHeight(shape: Shape): number {
  if (!shape.text?.trim()) return 0
  const lineHeight = Math.round(shape.style.fontSize * 1.3)
  return wrapText(shape.text, shape.w + 40, shape.style.fontSize).length * lineHeight + 6
}

/** Carré occupé par le glyphe d'une icône, libellé déduit. */
export function iconGlyphRect(shape: Shape): { x: number, y: number, size: number } {
  const size = Math.max(16, Math.min(shape.w, shape.h - iconLabelHeight(shape)))
  return {
    x: shape.x + (shape.w - size) / 2,
    y: shape.y + (shape.h - iconLabelHeight(shape) - size) / 2,
    size
  }
}

export function textLayout(shape: Shape): TextLayout | null {
  const text = shape.text?.trim()
  if (!text) return null

  const lineHeight = Math.round(shape.style.fontSize * (shape.kind === 'icon' ? 1.3 : 1.35))

  if (shape.kind === 'icon') {
    // Le libellé se place sous le glyphe et peut déborder légèrement en
    // largeur : un nom d'équipement reste lisible même sur une petite icône.
    const lines = wrapText(text, shape.w + 40, shape.style.fontSize)
    return {
      lines,
      x: shape.x + shape.w / 2,
      y: shape.y + shape.h - lines.length * lineHeight + lineHeight * 0.8,
      anchor: 'middle',
      lineHeight
    }
  }

  if (shape.kind === 'text') {
    const lines = wrapText(text, shape.w, shape.style.fontSize)
    return {
      lines,
      x: shape.style.align === 'left' ? shape.x : shape.style.align === 'right' ? shape.x + shape.w : shape.x + shape.w / 2,
      y: shape.y + lineHeight * 0.8,
      anchor: anchorFor(shape.style.align),
      lineHeight
    }
  }

  if (shape.kind === 'zone') {
    // L'étiquette d'une zone se lit en haut à gauche, comme un titre de cadre.
    const lines = wrapText(text, shape.w - PADDING * 2, shape.style.fontSize).slice(0, 2)
    return {
      lines,
      x: shape.x + PADDING,
      y: shape.y + PADDING + shape.style.fontSize,
      anchor: 'start',
      lineHeight
    }
  }

  const lines = wrapText(text, shape.w - PADDING * 2, shape.style.fontSize)
  const block = lines.length * lineHeight

  return {
    lines,
    x: anchorX(shape),
    y: shape.y + shape.h / 2 - block / 2 + lineHeight * 0.78,
    anchor: anchorFor(shape.style.align),
    lineHeight
  }
}

/** Hauteur minimale d'une forme de texte, pour que la sélection colle au contenu. */
export function textShapeHeight(shape: Shape): number {
  const layout = textLayout(shape)
  if (!layout) return Math.round(shape.style.fontSize * 1.6)
  return Math.round(layout.lines.length * layout.lineHeight + shape.style.fontSize * 0.4)
}

/* ---------------------------------------------------------- Enveloppe */

export interface Rect { x: number, y: number, w: number, h: number }

export function boundsOf(shapes: Shape[]): Rect | null {
  if (!shapes.length) return null

  const left = Math.min(...shapes.map(shape => shape.x))
  const top = Math.min(...shapes.map(shape => shape.y))
  const right = Math.max(...shapes.map(shape => shape.x + shape.w))
  const bottom = Math.max(...shapes.map(shape => shape.y + shape.h))

  return { x: left, y: top, w: right - left, h: bottom - top }
}

export function rectHit(shape: Shape, rect: Rect): boolean {
  const left = Math.min(rect.x, rect.x + rect.w)
  const top = Math.min(rect.y, rect.y + rect.h)
  const right = left + Math.abs(rect.w)
  const bottom = top + Math.abs(rect.h)

  return shape.x + shape.w > left && shape.x < right && shape.y + shape.h > top && shape.y < bottom
}

/* ------------------------------------------------------ Normalisation */

const KINDS: ShapeKind[] = ['icon', 'rect', 'ellipse', 'diamond', 'zone', 'note', 'text']
const SIDES: Side[] = ['auto', 'top', 'right', 'bottom', 'left']
const ROUTINGS: Routing[] = ['straight', 'curved', 'elbow']

function num(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function color(value: unknown, fallback: string): string {
  const text = String(value ?? '')
  return /^(none|#[0-9a-fA-F]{3,8})$/.test(text) ? text : fallback
}

function sanitizeStyle(raw: unknown, background: BackgroundId): Style {
  const base = defaultStyle(background)
  const style = (raw ?? {}) as Partial<Style>

  return {
    fill: color(style.fill, base.fill),
    stroke: color(style.stroke, base.stroke),
    strokeWidth: Math.min(24, Math.max(0, num(style.strokeWidth, base.strokeWidth))),
    dash: (['solid', 'dashed', 'dotted'] as Dash[]).includes(style.dash as Dash) ? style.dash as Dash : 'solid',
    opacity: Math.min(1, Math.max(0.05, num(style.opacity, 1))),
    radius: Math.min(120, Math.max(0, num(style.radius, base.radius))),
    color: color(style.color, base.color),
    fontSize: Math.min(96, Math.max(8, num(style.fontSize, base.fontSize))),
    bold: Boolean(style.bold),
    align: (['left', 'center', 'right'] as Align[]).includes(style.align as Align) ? style.align as Align : 'center'
  }
}

function sanitizeShape(raw: unknown, background: BackgroundId): Shape | null {
  const shape = (raw ?? {}) as Partial<Shape>
  if (!KINDS.includes(shape.kind as ShapeKind)) return null

  return {
    id: String(shape.id || genId()),
    kind: shape.kind as ShapeKind,
    x: num(shape.x, 0),
    y: num(shape.y, 0),
    w: Math.max(8, num(shape.w, 120)),
    h: Math.max(8, num(shape.h, 120)),
    text: shape.text ? String(shape.text).slice(0, 600) : undefined,
    icon: shape.icon ? String(shape.icon).slice(0, 80) : undefined,
    style: sanitizeStyle(shape.style, background),
    locked: Boolean(shape.locked)
  }
}

function sanitizeEnd(raw: unknown, ids: Set<string>): Endpoint | null {
  const end = (raw ?? {}) as Partial<Endpoint>
  const shapeId = end.shapeId ? String(end.shapeId) : undefined

  // Une accroche vers une forme disparue n'a plus de position : la flèche
  // pointerait le coin de la planche. Elle part avec ce qu'elle désignait.
  if (shapeId && !ids.has(shapeId)) return null

  return {
    shapeId,
    side: SIDES.includes(end.side as Side) ? end.side as Side : 'auto',
    x: num(end.x, 0),
    y: num(end.y, 0)
  }
}

function sanitizeConnector(raw: unknown, ids: Set<string>, background: BackgroundId): Connector | null {
  const connector = (raw ?? {}) as Partial<Connector>
  const from = sanitizeEnd(connector.from, ids)
  const to = sanitizeEnd(connector.to, ids)
  if (!from || !to) return null

  // Une flèche sans accroche ni coordonnées ne se dessine nulle part.
  if (!from.shapeId && !to.shapeId && !from.x && !from.y && !to.x && !to.y) return null

  return {
    id: String(connector.id || genId('c')),
    from,
    to,
    label: connector.label ? String(connector.label).slice(0, 120) : undefined,
    routing: ROUTINGS.includes(connector.routing as Routing) ? connector.routing as Routing : 'curved',
    startArrow: Boolean(connector.startArrow),
    endArrow: connector.endArrow !== false,
    style: sanitizeStyle(connector.style, background)
  }
}

export function createPage(name = 'Page 1', background: BackgroundId = 'blanc'): Page {
  return { id: genId('p'), name, background, grid: true, shapes: [], connectors: [] }
}

export function normalizePage(raw: unknown): Page {
  const page = (raw ?? {}) as Partial<Page>
  const background = BACKGROUNDS.some(item => item.id === page.background)
    ? page.background as BackgroundId
    : 'blanc'

  const shapes = (Array.isArray(page.shapes) ? page.shapes : [])
    .map(shape => sanitizeShape(shape, background))
    .filter((shape): shape is Shape => shape !== null)

  const ids = new Set(shapes.map(shape => shape.id))

  const connectors = (Array.isArray(page.connectors) ? page.connectors : [])
    .map(connector => sanitizeConnector(connector, ids, background))
    .filter((connector): connector is Connector => connector !== null)

  return {
    id: String(page.id || genId('p')),
    name: String(page.name || 'Page 1').slice(0, 60),
    background,
    grid: page.grid !== false,
    shapes,
    connectors
  }
}

export function normalizeWorkspace(raw: unknown): DrawWorkspace {
  const workspace = (raw ?? {}) as Partial<DrawWorkspace>

  const pages = Array.isArray(workspace.pages) && workspace.pages.length
    ? workspace.pages.map(normalizePage)
    : [createPage()]

  const activePageId = pages.some(page => page.id === workspace.activePageId)
    ? String(workspace.activePageId)
    : pages[0]!.id

  return {
    title: String(workspace.title || 'Présentation sans titre').slice(0, 80),
    pages,
    activePageId,
    updatedAt: String(workspace.updatedAt || new Date().toISOString())
  }
}
