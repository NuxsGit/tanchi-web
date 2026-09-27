import {
  BACKGROUNDS,
  GRID,
  ICON_DEFAULT_H,
  ICON_DEFAULT_W,
  PAGE_H,
  PAGE_W,
  backgroundOf,
  boundsOf,
  createConnector,
  createPage,
  createShape,
  defaultStyle,
  genId,
  normalizeWorkspace,
  rectHit,
  snap,
  styleForKind,
  textShapeHeight,
  type BackgroundId,
  type Connector,
  type DrawWorkspace,
  type Endpoint,
  type Page,
  type Rect,
  type Shape,
  type ShapeKind,
  type Style
} from '~~/shared/draw/model'
import { findTemplate, instantiate } from '~~/shared/draw/templates'

/** Outil actif de la barre : `select` manipule, les autres posent un objet. */
export type DrawTool = 'select' | 'hand' | 'rect' | 'ellipse' | 'diamond' | 'zone' | 'note' | 'text' | 'icon' | 'arrow'

/** Préfixé : TopologyBoard expose déjà un `Viewport` en import automatique. */
export interface DrawViewport {
  x: number
  y: number
  scale: number
}

const HISTORY_LIMIT = 60
const MIN_SCALE = 0.15
const MAX_SCALE = 4

/**
 * Atelier de TanchiDraw.
 *
 * L'état tient dans des pages : chacune est une planche autonome que l'on
 * présente plein écran. L'historique porte sur la page active — c'est l'unité
 * qu'on a en tête quand on annule — et l'enregistrement porte sur l'ensemble,
 * car un document, c'est la présentation complète.
 */
export const useDraw = () => {
  const toast = useToast()
  const doc = useDocument<DrawWorkspace>('draw')

  const title = useState<string>('draw-title', () => 'Présentation sans titre')
  const pages = useState<Page[]>('draw-pages', () => [createPage()])
  const activePageId = useState<string>('draw-active', () => pages.value[0]!.id)
  const loaded = useState<boolean>('draw-loaded', () => false)

  const scope = useState<'user' | 'team'>('draw-scope', () => 'user')
  const teamId = useState<number | null>('draw-team', () => null)
  const scopeRef = computed(() => ({ scope: scope.value, teamId: teamId.value ?? undefined }))

  /* Panneaux mémorisés : on retrouve son atelier tel qu'on l'a laissé. */
  const libraryCookie = useCookie<'open' | 'closed'>('tanchi_draw_library', {
    default: () => 'open', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
  })
  const libraryOpen = useState<boolean>('draw-library', () => libraryCookie.value !== 'closed')
  watch(libraryOpen, value => { libraryCookie.value = value ? 'open' : 'closed' })

  const inspectorCookie = useCookie<'open' | 'closed'>('tanchi_draw_inspector', {
    default: () => 'open', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
  })
  const inspectorOpen = useState<boolean>('draw-inspector', () => inspectorCookie.value !== 'closed')
  watch(inspectorOpen, value => { inspectorCookie.value = value ? 'open' : 'closed' })

  const snapCookie = useCookie<'on' | 'off'>('tanchi_draw_snap', {
    default: () => 'on', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
  })
  const snapping = useState<boolean>('draw-snap', () => snapCookie.value !== 'off')
  watch(snapping, value => { snapCookie.value = value ? 'on' : 'off' })

  const tool = useState<DrawTool>('draw-tool', () => 'select')
  /** Icône armée : le prochain clic sur la planche la pose. */
  const pendingIcon = useState<string | null>('draw-pending-icon', () => null)

  const selectedIds = useState<string[]>('draw-selection', () => [])
  const selectedConnectorId = useState<string | null>('draw-connector-sel', () => null)
  /** Forme dont le texte est en cours de saisie. */
  const editingId = useState<string | null>('draw-editing', () => null)

  const viewport = useState<DrawViewport>('draw-viewport', () => ({ x: 0, y: 0, scale: 1 }))
  const fullscreen = useState<boolean>('draw-full', () => false)
  const presenting = useState<boolean>('draw-present', () => false)

  /** Style courant du pinceau : ce que prend toute nouvelle forme. */
  const brush = useState<Style>('draw-brush', () => defaultStyle('blanc'))

  const clipboard = useState<{ shapes: Shape[], connectors: Connector[] } | null>('draw-clip', () => null)
  const past = useState<Page[]>('draw-past', () => [])
  const future = useState<Page[]>('draw-future', () => [])

  /** Tracés SVG des icônes, résolus par le serveur depuis le jeu local. */
  const iconBodies = useState<Record<string, string>>('draw-icon-bodies', () => ({}))

  const page = computed(() => pages.value.find(item => item.id === activePageId.value) ?? pages.value[0]!)
  const pageIndex = computed(() => pages.value.findIndex(item => item.id === page.value.id))
  const background = computed(() => backgroundOf(page.value.background))

  const shapeById = computed(() => new Map(page.value.shapes.map(shape => [shape.id, shape])))
  const selectedShapes = computed(() => page.value.shapes.filter(shape => selectedIds.value.includes(shape.id)))
  const selectedShape = computed(() => selectedShapes.value[0] ?? null)
  const selectedConnector = computed(() =>
    page.value.connectors.find(item => item.id === selectedConnectorId.value) ?? null
  )
  const selectionBounds = computed(() => boundsOf(selectedShapes.value))

  /* ---------------------------------------------------------- Historique */

  const clone = (value: Page): Page => JSON.parse(JSON.stringify(value))

  function checkpoint() {
    past.value = [...past.value, clone(page.value)].slice(-HISTORY_LIMIT)
    future.value = []
  }

  /** Applique une modification en la rendant annulable. */
  function commit(mutate: () => void) {
    checkpoint()
    mutate()
  }

  function replacePage(next: Page) {
    const index = pages.value.findIndex(item => item.id === activePageId.value)
    if (index >= 0) pages.value[index] = next
    selectedIds.value = selectedIds.value.filter(id => next.shapes.some(shape => shape.id === id))
  }

  function undo() {
    if (!past.value.length) return
    const previous = past.value[past.value.length - 1]!
    future.value = [clone(page.value), ...future.value].slice(0, HISTORY_LIMIT)
    past.value = past.value.slice(0, -1)
    replacePage(previous)
  }

  function redo() {
    if (!future.value.length) return
    const next = future.value[0]!
    past.value = [...past.value, clone(page.value)].slice(-HISTORY_LIMIT)
    future.value = future.value.slice(1)
    replacePage(next)
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  /* -------------------------------------------------------------- Icônes */

  /**
   * Charge les tracés manquants.
   *
   * Le catalogue entier arrive en une requête à l'ouverture ; les icônes d'un
   * plan importé qui n'en feraient pas partie sont demandées à l'unité.
   */
  async function ensureIcons(extra: string[] = []) {
    try {
      if (!Object.keys(iconBodies.value).length) {
        const payload = await $fetch<{ icons: Record<string, string> }>('/api/draw/icons')
        iconBodies.value = payload.icons
      }

      const missing = [...new Set(extra)].filter(name => name && !iconBodies.value[name])
      if (!missing.length) return

      const payload = await $fetch<{ icons: Record<string, string> }>('/api/draw/icons', {
        query: { names: missing.join(',') }
      })
      iconBodies.value = { ...iconBodies.value, ...payload.icons }
    } catch {
      // Sans tracé, une icône se réduit à son libellé : le plan reste lisible.
    }
  }

  const iconBody = (name?: string) => (name ? iconBodies.value[name] ?? '' : '')

  /* -------------------------------------------------------------- Formes */

  function place(value: number): number {
    return snap(value, snapping.value)
  }

  /**
   * Pinceau adapté au fond de la planche courante.
   *
   * La couleur choisie par l'utilisateur est conservée telle quelle. En
   * revanche, tant qu'il s'agit encore de l'encre par défaut d'un autre fond,
   * elle est remplacée : de l'encre noire sur une planche noire ne se voit pas.
   */
  function effectiveBrush(): Style {
    const spec = backgroundOf(page.value.background)
    const inherited = BACKGROUNDS.find(item => item.id !== spec.id && item.ink === brush.value.color)
    if (!inherited) return brush.value

    return {
      ...brush.value,
      color: spec.ink,
      stroke: brush.value.stroke === inherited.ink ? spec.ink : brush.value.stroke,
      fill: brush.value.fill === inherited.surface ? spec.surface : brush.value.fill
    }
  }

  function addShape(kind: ShapeKind, x: number, y: number, init: { text?: string, icon?: string, w?: number, h?: number } = {}): Shape {
    const shape = createShape(
      kind,
      place(x),
      place(y),
      { ...init, style: styleForKind(kind, effectiveBrush()) },
      page.value.background
    )

    commit(() => page.value.shapes.push(shape))
    selectedIds.value = [shape.id]
    selectedConnectorId.value = null
    return shape
  }

  /** Pose une icône centrée sur le point visé, libellé compris. */
  function addIcon(icon: string, x: number, y: number, label = '') {
    const shape = addShape('icon', x - ICON_DEFAULT_W / 2, y - ICON_DEFAULT_H / 2, {
      icon,
      text: label,
      w: ICON_DEFAULT_W,
      h: ICON_DEFAULT_H
    })
    void ensureIcons([icon])
    return shape
  }

  function updateShape(id: string, patch: Partial<Shape>, record = true) {
    const shape = page.value.shapes.find(item => item.id === id)
    if (!shape) return

    const apply = () => Object.assign(shape, patch)
    record ? commit(apply) : apply()
  }

  /** Déplace la sélection. Un glissement n'ouvre qu'un seul point d'annulation. */
  function moveSelection(dx: number, dy: number, record = true) {
    if (!selectedIds.value.length) return

    const apply = () => {
      for (const shape of page.value.shapes) {
        if (!selectedIds.value.includes(shape.id) || shape.locked) continue
        shape.x = Math.round(shape.x + dx)
        shape.y = Math.round(shape.y + dy)
      }
    }

    record ? commit(apply) : apply()
  }

  /** Aligne la sélection sur la trame, au relâchement du glissement. */
  function snapSelection() {
    if (!snapping.value) return
    for (const shape of page.value.shapes) {
      if (!selectedIds.value.includes(shape.id) || shape.locked) continue
      shape.x = snap(shape.x)
      shape.y = snap(shape.y)
    }
  }

  function resizeShape(id: string, rect: Rect, record = false) {
    const shape = page.value.shapes.find(item => item.id === id)
    if (!shape || shape.locked) return

    const apply = () => {
      shape.x = Math.round(rect.x)
      shape.y = Math.round(rect.y)
      shape.w = Math.max(16, Math.round(rect.w))
      shape.h = Math.max(shape.kind === 'text' ? 20 : 16, Math.round(rect.h))
    }

    record ? commit(apply) : apply()
  }

  function setText(id: string, text: string) {
    const shape = page.value.shapes.find(item => item.id === id)
    if (!shape) return

    commit(() => {
      shape.text = text
      // Une zone de texte se cale sur son contenu : pas de cadre à retailler.
      if (shape.kind === 'text') shape.h = textShapeHeight(shape)
    })
  }

  function removeSelection() {
    if (selectedConnectorId.value) {
      const id = selectedConnectorId.value
      commit(() => { page.value.connectors = page.value.connectors.filter(item => item.id !== id) })
      selectedConnectorId.value = null
      return
    }

    if (!selectedIds.value.length) return
    const ids = new Set(selectedIds.value)

    commit(() => {
      page.value.shapes = page.value.shapes.filter(shape => !ids.has(shape.id))
      // Les flèches accrochées aux formes supprimées partent avec elles.
      page.value.connectors = page.value.connectors.filter(
        connector => !(connector.from.shapeId && ids.has(connector.from.shapeId))
          && !(connector.to.shapeId && ids.has(connector.to.shapeId))
      )
    })

    selectedIds.value = []
  }

  function toggleLock() {
    if (!selectedShapes.value.length) return
    const locking = !selectedShapes.value.every(shape => shape.locked)
    commit(() => selectedShapes.value.forEach(shape => { shape.locked = locking }))
  }

  /* ---------------------------------------------------------- Sélection */

  const isSelected = (id: string) => selectedIds.value.includes(id)

  function select(id: string, additive = false) {
    selectedConnectorId.value = null

    if (!additive) {
      selectedIds.value = [id]
      return
    }

    selectedIds.value = isSelected(id)
      ? selectedIds.value.filter(item => item !== id)
      : [...selectedIds.value, id]
  }

  function selectConnector(id: string | null) {
    selectedConnectorId.value = id
    if (id) selectedIds.value = []
  }

  function selectAll() {
    selectedIds.value = page.value.shapes.filter(shape => !shape.locked).map(shape => shape.id)
    selectedConnectorId.value = null
  }

  function clearSelection() {
    selectedIds.value = []
    selectedConnectorId.value = null
    editingId.value = null
  }

  function selectInRect(rect: Rect, additive = false) {
    const hits = page.value.shapes
      .filter(shape => !shape.locked && rectHit(shape, rect))
      .map(shape => shape.id)

    selectedIds.value = additive ? [...new Set([...selectedIds.value, ...hits])] : hits
    if (hits.length) selectedConnectorId.value = null
  }

  /* -------------------------------------------------------------- Style */

  /**
   * Applique un réglage à la sélection.
   *
   * Le pinceau retient le changement : la forme suivante hérite du style que
   * l'on vient de choisir, sans avoir à le régler deux fois.
   */
  function setStyle(patch: Partial<Style>) {
    brush.value = { ...brush.value, ...patch }

    const connector = selectedConnector.value
    if (connector) {
      commit(() => { connector.style = { ...connector.style, ...patch, fill: 'none' } })
      return
    }

    if (!selectedShapes.value.length) return

    commit(() => {
      for (const shape of selectedShapes.value) {
        shape.style = { ...shape.style, ...patch }
        if (shape.kind === 'text') shape.h = textShapeHeight(shape)
      }
    })
  }

  /* ------------------------------------------------- Ordre et alignement */

  function reorder(direction: 'front' | 'back' | 'forward' | 'backward') {
    const ids = new Set(selectedIds.value)
    if (!ids.size) return

    commit(() => {
      const picked = page.value.shapes.filter(shape => ids.has(shape.id))
      const rest = page.value.shapes.filter(shape => !ids.has(shape.id))

      if (direction === 'front') {
        page.value.shapes = [...rest, ...picked]
        return
      }
      if (direction === 'back') {
        page.value.shapes = [...picked, ...rest]
        return
      }

      // Un cran : on décale chaque élément retenu d'une position.
      const step = direction === 'forward' ? 1 : -1
      const list = [...page.value.shapes]
      const order = direction === 'forward' ? [...list].reverse() : list

      for (const shape of order) {
        if (!ids.has(shape.id)) continue
        const index = list.indexOf(shape)
        const target = index + step
        if (target < 0 || target >= list.length || ids.has(list[target]!.id)) continue
        list.splice(index, 1)
        list.splice(target, 0, shape)
      }

      page.value.shapes = list
    })
  }

  type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'

  function align(mode: AlignMode) {
    const shapes = selectedShapes.value.filter(shape => !shape.locked)
    if (shapes.length < 2) return

    const box = boundsOf(shapes)
    if (!box) return

    commit(() => {
      for (const shape of shapes) {
        switch (mode) {
          case 'left': shape.x = box.x; break
          case 'center-x': shape.x = Math.round(box.x + (box.w - shape.w) / 2); break
          case 'right': shape.x = box.x + box.w - shape.w; break
          case 'top': shape.y = box.y; break
          case 'center-y': shape.y = Math.round(box.y + (box.h - shape.h) / 2); break
          case 'bottom': shape.y = box.y + box.h - shape.h; break
        }
      }
    })
  }

  /** Répartit les écarts entre les formes, extrêmes conservés. */
  function distribute(axis: 'x' | 'y') {
    const shapes = [...selectedShapes.value].filter(shape => !shape.locked)
    if (shapes.length < 3) return

    shapes.sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y))
    const first = shapes[0]!
    const last = shapes[shapes.length - 1]!

    const span = axis === 'x'
      ? (last.x + last.w) - first.x - shapes.reduce((total, shape) => total + shape.w, 0)
      : (last.y + last.h) - first.y - shapes.reduce((total, shape) => total + shape.h, 0)

    const gap = span / (shapes.length - 1)

    commit(() => {
      let cursor = axis === 'x' ? first.x + first.w : first.y + first.h
      for (const shape of shapes.slice(1, -1)) {
        if (axis === 'x') {
          shape.x = Math.round(cursor + gap)
          cursor = shape.x + shape.w
        } else {
          shape.y = Math.round(cursor + gap)
          cursor = shape.y + shape.h
        }
      }
    })
  }

  /* ----------------------------------------------------- Presse-papiers */

  function copy() {
    if (!selectedIds.value.length) return
    const ids = new Set(selectedIds.value)

    clipboard.value = {
      shapes: selectedShapes.value.map(shape => JSON.parse(JSON.stringify(shape))),
      connectors: page.value.connectors
        .filter(item => item.from.shapeId && item.to.shapeId && ids.has(item.from.shapeId) && ids.has(item.to.shapeId))
        .map(item => JSON.parse(JSON.stringify(item)))
    }
  }

  function paste(offsetX = 30, offsetY = 30) {
    const source = clipboard.value
    if (!source?.shapes.length) return

    const mapping = new Map<string, string>()

    const shapes = source.shapes.map((shape) => {
      const id = genId()
      mapping.set(shape.id, id)
      return { ...JSON.parse(JSON.stringify(shape)), id, x: shape.x + offsetX, y: shape.y + offsetY }
    })

    const connectors = source.connectors.map(connector => ({
      ...JSON.parse(JSON.stringify(connector)),
      id: genId('c'),
      from: { ...connector.from, shapeId: mapping.get(connector.from.shapeId!) },
      to: { ...connector.to, shapeId: mapping.get(connector.to.shapeId!) }
    }))

    commit(() => {
      page.value.shapes.push(...shapes)
      page.value.connectors.push(...connectors)
    })

    selectedIds.value = shapes.map(shape => shape.id)
  }

  function cut() {
    copy()
    removeSelection()
  }

  function duplicate() {
    copy()
    paste()
  }

  /* ------------------------------------------------------------ Flèches */

  function addConnector(from: Endpoint, to: Endpoint) {
    const connector = createConnector(from, to, { ...brush.value, stroke: brush.value.stroke, color: brush.value.stroke })
    commit(() => page.value.connectors.push(connector))
    selectConnector(connector.id)
    return connector
  }

  /** Relie toute la sélection au premier élément retenu. */
  function connectSelection() {
    if (selectedIds.value.length < 2) return
    const [hub, ...rest] = selectedIds.value

    commit(() => {
      for (const id of rest) {
        page.value.connectors.push(
          createConnector(
            { shapeId: hub, side: 'auto', x: 0, y: 0 },
            { shapeId: id, side: 'auto', x: 0, y: 0 },
            { ...brush.value, color: brush.value.stroke }
          )
        )
      }
    })
  }

  function updateConnector(id: string, patch: Partial<Connector>) {
    const connector = page.value.connectors.find(item => item.id === id)
    if (!connector) return
    commit(() => Object.assign(connector, patch))
  }

  function removeConnector(id: string) {
    commit(() => { page.value.connectors = page.value.connectors.filter(item => item.id !== id) })
    if (selectedConnectorId.value === id) selectedConnectorId.value = null
  }

  /* -------------------------------------------------------------- Pages */

  function addPage(name?: string) {
    const created = createPage(name ?? `Page ${pages.value.length + 1}`, page.value.background)
    pages.value.push(created)
    activePageId.value = created.id
    past.value = []
    future.value = []
    clearSelection()
  }

  function duplicatePage() {
    const copied = JSON.parse(JSON.stringify(page.value)) as Page
    copied.id = genId('p')
    copied.name = `${page.value.name} (copie)`

    // Les identifiants sont refaits pour que les deux planches restent
    // indépendantes, flèches comprises.
    const mapping = new Map<string, string>()
    for (const shape of copied.shapes) {
      const id = genId()
      mapping.set(shape.id, id)
      shape.id = id
    }
    for (const connector of copied.connectors) {
      connector.id = genId('c')
      if (connector.from.shapeId) connector.from.shapeId = mapping.get(connector.from.shapeId)
      if (connector.to.shapeId) connector.to.shapeId = mapping.get(connector.to.shapeId)
    }

    pages.value.splice(pageIndex.value + 1, 0, copied)
    activePageId.value = copied.id
    clearSelection()
  }

  function removePage(id: string) {
    if (pages.value.length === 1) return
    const index = pages.value.findIndex(item => item.id === id)
    pages.value = pages.value.filter(item => item.id !== id)
    if (activePageId.value === id) activePageId.value = pages.value[Math.max(0, index - 1)]!.id
    clearSelection()
  }

  function renamePage(id: string, name: string) {
    const target = pages.value.find(item => item.id === id)
    if (target && name.trim()) target.name = name.trim().slice(0, 60)
  }

  function movePage(id: string, direction: -1 | 1) {
    const index = pages.value.findIndex(item => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= pages.value.length) return

    const [moved] = pages.value.splice(index, 1)
    pages.value.splice(target, 0, moved!)
  }

  function goToPage(index: number) {
    const target = pages.value[Math.min(pages.value.length - 1, Math.max(0, index))]
    if (!target) return
    activePageId.value = target.id
    past.value = []
    future.value = []
    clearSelection()
  }

  function setBackground(id: BackgroundId) {
    commit(() => { page.value.background = id })
    // Le pinceau suit le fond : on ne pose pas de l'encre noire sur du noir.
    const spec = backgroundOf(id)
    brush.value = { ...brush.value, color: spec.ink, stroke: spec.ink, fill: spec.surface }
  }

  function toggleGrid() {
    page.value.grid = !page.value.grid
  }

  /* ------------------------------------------------------------ Modèles */

  function applyTemplate(templateId: string, mode: 'newPage' | 'append' = 'newPage') {
    const template = findTemplate(templateId)
    if (!template) return

    // Poser un modèle sur une planche encore vierge la remplit : créer une
    // page de plus laisserait une planche blanche en tête de présentation.
    const blank = !page.value.shapes.length && !page.value.connectors.length

    if (mode === 'newPage' && !blank) {
      const created = createPage(template.label, template.background)
      pages.value.splice(pageIndex.value + 1, 0, created)
      activePageId.value = created.id
      past.value = []
      future.value = []
    }

    const { shapes, connectors } = instantiate(template)

    commit(() => {
      // Le fond fait partie du modèle, mais on ne repeint pas une planche
      // existante sous prétexte qu'on lui ajoute un schéma.
      if (mode === 'newPage' || blank) {
        page.value.background = template.background
        if (blank) page.value.name = template.label
      }
      page.value.shapes.push(...shapes)
      page.value.connectors.push(...connectors)
    })

    selectedIds.value = []
    void ensureIcons(shapes.map(shape => shape.icon).filter((icon): icon is string => Boolean(icon)))

    toast.add({
      title: `${template.label} posé`,
      description: `${shapes.length} éléments et ${connectors.length} liaisons, prêts à renommer.`,
      color: 'success'
    })
  }

  /* ----------------------------------------------------------------- Vue */

  function zoomBy(factor: number, centerX?: number, centerY?: number) {
    const previous = viewport.value.scale
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, previous * factor))
    if (scale === previous) return

    if (centerX !== undefined && centerY !== undefined) {
      const ratio = scale / previous
      viewport.value = {
        scale,
        x: centerX - (centerX - viewport.value.x) * ratio,
        y: centerY - (centerY - viewport.value.y) * ratio
      }
      return
    }

    viewport.value = { ...viewport.value, scale }
  }

  function panBy(dx: number, dy: number) {
    viewport.value = { ...viewport.value, x: viewport.value.x + dx, y: viewport.value.y + dy }
  }

  /** Cadre la planche entière dans la fenêtre, avec une marge. */
  function fitPage(width: number, height: number) {
    const scale = Math.min((width - 48) / PAGE_W, (height - 48) / PAGE_H)
    const bounded = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

    viewport.value = {
      scale: bounded,
      x: (width - PAGE_W * bounded) / 2,
      y: (height - PAGE_H * bounded) / 2
    }
  }

  /** Cadre le contenu, ou la sélection quand il y en a une. */
  function fitContent(width: number, height: number) {
    const target = selectedShapes.value.length ? selectedShapes.value : page.value.shapes
    const box = boundsOf(target)
    if (!box) return fitPage(width, height)

    const scale = Math.min((width - 120) / Math.max(1, box.w), (height - 120) / Math.max(1, box.h))
    const bounded = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

    viewport.value = {
      scale: bounded,
      x: width / 2 - (box.x + box.w / 2) * bounded,
      y: height / 2 - (box.y + box.h / 2) * bounded
    }
  }

  /* ------------------------------------------------------ Persistance */

  function apply(workspace: DrawWorkspace) {
    title.value = workspace.title
    pages.value = workspace.pages
    activePageId.value = workspace.activePageId
    past.value = []
    future.value = []
    clearSelection()

    void ensureIcons(
      workspace.pages.flatMap(item => item.shapes.map(shape => shape.icon))
        .filter((icon): icon is string => Boolean(icon))
    )
  }

  async function load() {
    const payload = await doc.load(scopeRef.value)
    apply(normalizeWorkspace(payload.data))
    loaded.value = true
  }

  function snapshot(): DrawWorkspace {
    return {
      title: title.value,
      pages: pages.value,
      activePageId: activePageId.value,
      updatedAt: new Date().toISOString()
    }
  }

  async function save(silent = true) {
    const ok = await doc.save(scopeRef.value, snapshot())
    if (ok && !silent) toast.add({ title: 'Présentation enregistrée', color: 'success' })
  }

  async function switchScope(next: 'user' | 'team', nextTeamId?: number) {
    scope.value = next
    teamId.value = next === 'team' ? (nextTeamId ?? null) : null
    loaded.value = false
    await load()

    toast.add({
      title: next === 'team' ? 'Espace d\'équipe' : 'Espace personnel',
      description: next === 'team' ? 'Vos coéquipiers voient et modifient ces planches.' : 'Ces planches ne sont visibles que par vous.',
      color: 'info'
    })
  }

  function acceptRemote() {
    const remote = doc.resolveWithRemote()
    if (!remote) return
    apply(normalizeWorkspace(remote))
    toast.add({ title: 'Version de l\'équipe rechargée', color: 'success' })
  }

  /** Impose la version locale : la révision du serveur est reprise telle quelle. */
  async function overwriteRemote() {
    doc.forceLocal()
    await save(false)
  }

  /* -------------------------------------------------------------- Export */

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const slug = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan'

  function exportJson() {
    download(
      new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }),
      `${slug(title.value)}.tanchidraw.json`
    )
  }

  async function importJson(file: File) {
    try {
      const workspace = normalizeWorkspace(JSON.parse(await file.text()))
      apply(workspace)
      toast.add({ title: 'Présentation importée', description: `${workspace.pages.length} page(s).`, color: 'success' })
    } catch {
      toast.add({ title: 'Fichier illisible', description: 'Attendu : un export TanchiDraw au format JSON.', color: 'error' })
    }
  }

  /**
   * Reconstruit la planche en SVG autonome.
   *
   * Le rendu à l'écran est déjà du SVG : on en reprend le calque de scène, on
   * retire les éléments d'interface (trame, poignées, repères) et on repose un
   * fond opaque. L'image obtenue est exactement ce que l'on voit.
   */
  function buildSvg(surface: SVGSVGElement, target: Page = page.value): string {
    const scene = surface.querySelector('[data-scene]')?.cloneNode(true) as SVGGElement | undefined
    if (!scene) return ''

    scene.removeAttribute('transform')
    scene.querySelectorAll('[data-ui]').forEach(node => node.remove())

    const spec = backgroundOf(target.background)
    const body = new XMLSerializer().serializeToString(scene)

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" `
      + `viewBox="0 0 ${PAGE_W} ${PAGE_H}">`
      + `<rect width="${PAGE_W}" height="${PAGE_H}" fill="${spec.color}"/>`
      + `${body}</svg>`
  }

  function exportSvg(surface: SVGSVGElement) {
    const svg = buildSvg(surface)
    if (!svg) return
    download(new Blob([svg], { type: 'image/svg+xml' }), `${slug(title.value)}-${slug(page.value.name)}.svg`)
  }

  async function toPng(svg: string, scale = 2): Promise<Blob | null> {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))

    try {
      const image = new Image()
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = url
      })

      const canvas = document.createElement('canvas')
      canvas.width = PAGE_W * scale
      canvas.height = PAGE_H * scale

      const context = canvas.getContext('2d')
      if (!context) return null
      context.drawImage(image, 0, 0, canvas.width, canvas.height)

      return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    } catch {
      return null
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async function exportPng(surface: SVGSVGElement) {
    const blob = await toPng(buildSvg(surface))
    if (!blob) {
      toast.add({ title: 'Export impossible', description: 'Le navigateur a refusé de convertir la planche.', color: 'error' })
      return
    }
    download(blob, `${slug(title.value)}-${slug(page.value.name)}.png`)
  }

  /** Exporte chaque planche : on passe d'une page à l'autre puis on rend. */
  async function exportAllPng(surface: SVGSVGElement) {
    const restore = activePageId.value
    const list = [...pages.value]

    for (const [index, item] of list.entries()) {
      activePageId.value = item.id
      await nextTick()

      const blob = await toPng(buildSvg(surface, item))
      if (blob) download(blob, `${slug(title.value)}-${String(index + 1).padStart(2, '0')}-${slug(item.name)}.png`)
    }

    activePageId.value = restore
    toast.add({ title: `${list.length} planche(s) exportée(s)`, color: 'success' })
  }

  return {
    // état
    title, pages, page, pageIndex, activePageId, loaded, background,
    scope, teamId, tool, pendingIcon, brush, snapping, libraryOpen, inspectorOpen, fullscreen, presenting,
    selectedIds, selectedConnectorId, selectedShapes, selectedShape, selectedConnector,
    selectionBounds, shapeById, editingId, viewport, clipboard,
    canUndo, canRedo, conflict: doc.conflict, savedLabel: doc.savedLabel, saving: doc.saving,
    iconBodies, iconBody,
    backgrounds: BACKGROUNDS,
    grid: GRID,
    // actions
    checkpoint, commit, undo, redo,
    addShape, addIcon, updateShape, moveSelection, snapSelection, resizeShape, setText,
    removeSelection, toggleLock, isSelected, select, selectConnector, selectAll, clearSelection, selectInRect,
    setStyle, reorder, align, distribute,
    copy, cut, paste, duplicate,
    addConnector, connectSelection, updateConnector, removeConnector,
    addPage, duplicatePage, removePage, renamePage, movePage, goToPage, setBackground, toggleGrid,
    applyTemplate, ensureIcons,
    zoomBy, panBy, fitPage, fitContent,
    load, save, switchScope, acceptRemote, overwriteRemote,
    exportJson, importJson, exportSvg, exportPng, exportAllPng, buildSvg
  }
}
