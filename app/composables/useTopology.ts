import { analyseBoard, type Diagnostic } from '~~/shared/topology/diagnostics'
import { BLUEPRINTS, findBlueprint, instantiate } from '~~/shared/topology/blueprints'
import { repairBoard, type RepairResult } from '~~/shared/topology/repair'
import { findCatalogItem, findMedium, type MediumId } from '~~/shared/topology/catalog'
import {
  createBoard,
  createLink,
  findSlot,
  inferCable,
  slotUsage,
  createNode,
  defaultSpeedFor,
  genId,
  normalizeBoard,
  normalizeWorkspace,
  snap,
  type Board,
  type BoardLink,
  type BoardNode,
  type TopologyWorkspace
} from '~~/shared/topology/model'

export interface Viewport {
  x: number
  y: number
  scale: number
}

const HISTORY_LIMIT = 60
const MIN_SCALE = 0.25
const MAX_SCALE = 2.5

/** État et actions de TanchiTopologyBoard. */
export const useTopology = () => {
  const toast = useToast()
  const doc = useDocument<TopologyWorkspace>('topology')

  const boards = useState<Board[]>('topo-boards', () => [createBoard()])
  const activeBoardId = useState<string>('topo-active', () => boards.value[0]!.id)
  const loaded = useState<boolean>('topo-loaded', () => false)

  const scope = useState<'user' | 'team'>('topo-scope', () => 'user')
  const teamId = useState<number | null>('topo-team', () => null)
  const scopeRef = computed(() => ({ scope: scope.value, teamId: teamId.value ?? undefined }))

  /* Panneaux : mémorisés en cookie pour retrouver son espace de travail. */
  const dockCookie = useCookie<'open' | 'closed'>('tanchi_topo_dock', {
    default: () => 'open', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
  })
  const panelCookie = useCookie<'open' | 'closed'>('tanchi_topo_panel', {
    default: () => 'closed', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
  })

  const dockOpen = useState<boolean>('topo-dock', () => dockCookie.value !== 'closed')
  const diagnosticsOpen = useState<boolean>('topo-diag', () => panelCookie.value === 'open')
  const fullscreen = useState<boolean>('topo-full', () => false)

  watch(dockOpen, value => { dockCookie.value = value ? 'open' : 'closed' })
  watch(diagnosticsOpen, value => { panelCookie.value = value ? 'open' : 'closed' })

  /** Sélection multiple : shift-clic pour étendre, Ctrl+A pour tout prendre. */
  const selectedIds = useState<string[]>('topo-selection', () => [])
  const linkingFrom = useState<string | null>('topo-linking', () => null)

  /** Position et échelle du plateau. Le plan lui-même est sans bornes. */
  const viewport = useState<Viewport>('topo-viewport', () => ({ x: 0, y: 0, scale: 1 }))

  /** Câble sélectionné : l'inspecteur bascule alors sur la liaison. */
  const selectedLinkId = useState<string | null>('topo-link-sel', () => null)

  const clipboard = useState<{ nodes: BoardNode[], links: BoardLink[] } | null>('topo-clip', () => null)
  const past = useState<Board[]>('topo-past', () => [])
  const future = useState<Board[]>('topo-future', () => [])

  const board = computed(() =>
    boards.value.find(item => item.id === activeBoardId.value) ?? boards.value[0]!
  )

  /** Premier élément sélectionné : ce que l'inspecteur affiche. */
  const selectedNodeId = computed<string | null>({
    get: () => selectedIds.value[0] ?? null,
    set: (value: string | null) => { selectedIds.value = value ? [value] : [] }
  })

  const selectedNode = computed(() =>
    board.value.nodes.find(node => node.id === selectedNodeId.value) ?? null
  )

  const selectedNodes = computed(() =>
    board.value.nodes.filter(node => selectedIds.value.includes(node.id))
  )

  const report = computed(() => analyseBoard(board.value))

  const diagnosticsByNode = computed(() => {
    const index = new Map<string, Diagnostic[]>()
    for (const diagnostic of report.value.diagnostics) {
      for (const nodeId of diagnostic.nodeIds) {
        index.set(nodeId, [...(index.get(nodeId) ?? []), diagnostic])
      }
    }
    return index
  })

  const diagnosticsByLink = computed(() => {
    const index = new Map<string, Diagnostic[]>()
    for (const diagnostic of report.value.diagnostics) {
      for (const linkId of diagnostic.linkIds) {
        index.set(linkId, [...(index.get(linkId) ?? []), diagnostic])
      }
    }
    return index
  })

  /* ---------------------------------------------------------- Historique */

  const clone = (value: Board): Board => JSON.parse(JSON.stringify(value))

  /**
   * Enregistre l'état courant avant modification.
   *
   * L'instantané porte sur le plan actif seul : c'est l'unité que l'utilisateur
   * a en tête quand il annule.
   */
  function checkpoint() {
    past.value = [...past.value, clone(board.value)].slice(-HISTORY_LIMIT)
    future.value = []
  }

  function touch() {
    board.value.updatedAt = new Date().toISOString()
  }

  /** Applique une modification en la rendant annulable. */
  function commit(mutate: () => void) {
    checkpoint()
    mutate()
    touch()
  }

  function replaceBoard(next: Board) {
    const index = boards.value.findIndex(item => item.id === activeBoardId.value)
    if (index >= 0) boards.value[index] = next
    selectedIds.value = selectedIds.value.filter(id => next.nodes.some(node => node.id === id))
  }

  function undo() {
    if (!past.value.length) return
    const previous = past.value[past.value.length - 1]!
    future.value = [clone(board.value), ...future.value].slice(0, HISTORY_LIMIT)
    past.value = past.value.slice(0, -1)
    replaceBoard(previous)
  }

  function redo() {
    if (!future.value.length) return
    const next = future.value[0]!
    past.value = [...past.value, clone(board.value)].slice(-HISTORY_LIMIT)
    future.value = future.value.slice(1)
    replaceBoard(next)
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  /* ------------------------------------------------------------- Nœuds */

  function addNode(typeId: string, x: number, y: number) {
    const sameType = board.value.nodes.filter(node => node.type === typeId).length
    const node = createNode(typeId, x, y, sameType)
    if (!node) return

    commit(() => board.value.nodes.push(node))
    selectedIds.value = [node.id]
  }

  /** Déplacement libre : les coordonnées négatives sont permises. */
  function moveNode(id: string, x: number, y: number) {
    const node = board.value.nodes.find(item => item.id === id)
    if (!node) return
    node.x = snap(x)
    node.y = snap(y)
    touch()
  }

  /** Décale toute la sélection : glissement groupé et flèches du clavier. */
  function nudge(dx: number, dy: number, record = true) {
    if (!selectedIds.value.length) return

    const apply = () => {
      for (const node of board.value.nodes) {
        if (!selectedIds.value.includes(node.id)) continue
        node.x = snap(node.x + dx)
        node.y = snap(node.y + dy)
      }
    }

    if (record) commit(apply)
    else { apply(); touch() }
  }

  function removeSelection() {
    if (!selectedIds.value.length) return
    const ids = new Set(selectedIds.value)

    commit(() => {
      board.value.nodes = board.value.nodes.filter(node => !ids.has(node.id))
      board.value.links = board.value.links.filter(link => !ids.has(link.from) && !ids.has(link.to))
    })
    selectedIds.value = []
  }

  function removeNode(id: string) {
    selectedIds.value = [id]
    removeSelection()
  }

  function updateNode(id: string, patch: Partial<BoardNode>) {
    const node = board.value.nodes.find(item => item.id === id)
    if (!node) return
    commit(() => Object.assign(node, patch))
  }

  function updateConfig(id: string, patch: Record<string, unknown>) {
    const node = board.value.nodes.find(item => item.id === id)
    if (!node) return
    commit(() => { node.config = { ...node.config, ...patch } })
  }

  function setPorts(id: string, ports: { connector: string, count: number, speedGbps: number }[]) {
    const node = board.value.nodes.find(item => item.id === id)
    if (!node) return
    commit(() => { node.config = { ...node.config, ports: ports as never } })
  }

  /* -------------------------------------------------------- Sélection */

  const isSelected = (id: string) => selectedIds.value.includes(id)

  function select(id: string, additive = false) {
    if (!additive) {
      selectedIds.value = [id]
      return
    }
    selectedIds.value = isSelected(id)
      ? selectedIds.value.filter(item => item !== id)
      : [...selectedIds.value, id]
  }

  function selectAll() {
    selectedIds.value = board.value.nodes.map(node => node.id)
  }

  function clearSelection() {
    selectedIds.value = []
    selectedLinkId.value = null
    linkingFrom.value = null
  }

  const selectedLink = computed(() =>
    board.value.links.find(link => link.id === selectedLinkId.value) ?? null
  )

  function selectLink(id: string | null) {
    selectedLinkId.value = id
    if (id) selectedIds.value = []
  }

  /** Sélection au rectangle : tout nœud entièrement couvert est retenu. */
  function selectInRect(rect: { x: number, y: number, w: number, h: number }, additive = false) {
    const left = Math.min(rect.x, rect.x + rect.w)
    const top = Math.min(rect.y, rect.y + rect.h)
    const right = left + Math.abs(rect.w)
    const bottom = top + Math.abs(rect.h)

    const hits = board.value.nodes
      .filter(node => node.x + 156 > left && node.x < right && node.y + 68 > top && node.y < bottom)
      .map(node => node.id)

    selectedIds.value = additive
      ? [...new Set([...selectedIds.value, ...hits])]
      : hits
    if (hits.length) selectedLinkId.value = null
  }

  /* ----------------------------------------------------- Presse-papiers */

  /** Copie la sélection, liaisons internes comprises. */
  function copy() {
    if (!selectedIds.value.length) return
    const ids = new Set(selectedIds.value)

    clipboard.value = {
      nodes: selectedNodes.value.map(node => JSON.parse(JSON.stringify(node))),
      links: board.value.links
        .filter(link => ids.has(link.from) && ids.has(link.to))
        .map(link => ({ ...link }))
    }

    toast.add({ title: `${ids.size} composant(s) copié(s)`, color: 'success' })
  }

  function cut() {
    copy()
    removeSelection()
  }

  /**
   * Colle le presse-papiers avec un décalage.
   * Les identifiants sont régénérés et les liaisons internes préservées.
   */
  function paste(offsetX = 40, offsetY = 40) {
    const source = clipboard.value
    if (!source?.nodes.length) return

    const mapping = new Map<string, string>()
    const nodes = source.nodes.map((node) => {
      const id = genId()
      mapping.set(node.id, id)
      return { ...JSON.parse(JSON.stringify(node)), id, x: node.x + offsetX, y: node.y + offsetY }
    })

    const links = source.links
      .map(link => ({
        ...link,
        id: genId('l'),
        from: mapping.get(link.from)!,
        to: mapping.get(link.to)!
      }))
      .filter(link => link.from && link.to)

    commit(() => {
      board.value.nodes.push(...nodes)
      board.value.links.push(...links)
    })

    selectedIds.value = nodes.map(node => node.id)
  }

  function duplicateSelection() {
    copy()
    paste()
  }

  function duplicateNode(id: string) {
    selectedIds.value = [id]
    duplicateSelection()
  }

  /* -------------------------------------------------------- Liaisons */

  /**
   * Branche deux points de câblage.
   *
   * Le type de câble découle des connecteurs : secteur entre deux prises
   * d'alimentation, cuivre entre deux RJ45, fibre dès qu'une extrémité est
   * optique. Un branchement incohérent est refusé, avec la raison.
   */
  function connect(fromId: string, fromPort: string, toId: string, toPort: string): boolean {
    if (fromId === toId && fromPort === toPort) return false

    const from = board.value.nodes.find(node => node.id === fromId)
    const to = board.value.nodes.find(node => node.id === toId)
    if (!from || !to) return false

    const a = findSlot(from, fromPort)
    const b = findSlot(to, toPort)
    if (!a || !b) return false

    const cable = inferCable(a.connector, b.connector, a.speedGbps, b.speedGbps)
    if (!cable) {
      toast.add({
        title: 'Branchement impossible',
        description: `${a.connector.toUpperCase()} et ${b.connector.toUpperCase()} ne se raccordent pas directement. Passez par un convertisseur.`,
        color: 'error'
      })
      return false
    }

    // Un point de câblage ne peut pas accueillir plus de liens qu'il n'a de ports.
    for (const [node, slot] of [[from, a], [to, b]] as const) {
      if (slotUsage(board.value.links, node.id, slot.id) >= slot.count) {
        toast.add({
          title: `${node.label} : ${slot.connector.toUpperCase()} saturé`,
          description: `Les ${slot.count} port(s) de ce groupe sont déjà occupés.`,
          color: 'warning'
        })
        return false
      }
    }

    commit(() => {
      board.value.links.push({
        id: genId('l'),
        from: fromId,
        to: toId,
        fromPort,
        toPort,
        medium: cable.medium,
        speedGbps: cable.speedGbps,
        lengthM: cable.medium === 'power' ? 2 : 3
      })
    })

    toast.add({ title: cable.label, description: `${from.label} → ${to.label}`, color: 'success' })
    return true
  }

  function startLink(nodeId: string) {
    linkingFrom.value = linkingFrom.value === nodeId ? null : nodeId
  }

  function completeLink(nodeId: string) {
    const fromId = linkingFrom.value
    linkingFrom.value = null
    if (!fromId || fromId === nodeId) return

    const from = board.value.nodes.find(node => node.id === fromId)
    const to = board.value.nodes.find(node => node.id === nodeId)
    if (!from || !to) return

    commit(() => board.value.links.push(createLink(from, to)))
  }

  /** Relie tous les éléments sélectionnés au premier d'entre eux. */
  function linkSelection() {
    if (selectedIds.value.length < 2) return
    const [hubId, ...rest] = selectedIds.value
    const hub = board.value.nodes.find(node => node.id === hubId)
    if (!hub) return

    commit(() => {
      for (const id of rest) {
        const target = board.value.nodes.find(node => node.id === id)
        if (target) board.value.links.push(createLink(hub, target))
      }
    })
  }

  function removeLink(id: string) {
    commit(() => { board.value.links = board.value.links.filter(link => link.id !== id) })
  }

  function updateLink(id: string, patch: Partial<BoardLink>) {
    const link = board.value.links.find(item => item.id === id)
    if (!link) return

    commit(() => {
      Object.assign(link, patch)

      // Changer de support peut invalider le débit : on le ramène au plafond.
      if (patch.medium) {
        const from = board.value.nodes.find(node => node.id === link.from)
        const to = board.value.nodes.find(node => node.id === link.to)
        const spec = findMedium(patch.medium as MediumId)
        if (from && to && spec) {
          link.speedGbps = Math.min(
            link.speedGbps || defaultSpeedFor(from.type, to.type, patch.medium as MediumId),
            spec.maxSpeedGbps || link.speedGbps
          )
        }
      }
    })
  }

  const linksOfSelected = computed(() => {
    if (!selectedNodeId.value) return []
    return board.value.links.filter(
      link => link.from === selectedNodeId.value || link.to === selectedNodeId.value
    )
  })

  /* --------------------------------------------------------- Plateaux */

  function addBoard() {
    const created = createBoard(`Plan ${boards.value.length + 1}`)
    boards.value.push(created)
    activeBoardId.value = created.id
    clearSelection()
    past.value = []
    future.value = []
  }

  function removeBoard(id: string) {
    if (boards.value.length === 1) return
    boards.value = boards.value.filter(item => item.id !== id)
    if (activeBoardId.value === id) activeBoardId.value = boards.value[0]!.id
    clearSelection()
  }

  function renameBoard(id: string, name: string) {
    const target = boards.value.find(item => item.id === id)
    if (target && name.trim()) target.name = name.trim()
  }

  /* ---------------------------------------------------------- Modèles */

  function generate(blueprintId: string, mode: 'append' | 'newBoard' = 'append') {
    const blueprint = findBlueprint(blueprintId)
    if (!blueprint) return

    if (mode === 'newBoard') {
      const created = createBoard(blueprint.label)
      boards.value.push(created)
      activeBoardId.value = created.id
    }

    const lowest = board.value.nodes.reduce((max, node) => Math.max(max, node.y), 0)
    const originY = board.value.nodes.length ? lowest + 180 : 60

    const { nodes, links } = instantiate(blueprint, 60, originY)

    commit(() => {
      board.value.nodes.push(...nodes)
      board.value.links.push(...links)
    })

    selectedIds.value = nodes.map(node => node.id)

    toast.add({
      title: `${blueprint.label} généré`,
      description: `${nodes.length} composants et ${links.length} liaisons ajoutés.`,
      color: 'success'
    })
  }

  /* ------------------------------------------------------- Correction */

  /** Résultat de la dernière analyse corrective, en attente d'arbitrage. */
  const repair = useState<RepairResult | null>('topo-repair', () => null)

  function analyseRepair() {
    repair.value = repairBoard(board.value)

    if (!repair.value.changes.length) {
      toast.add({
        title: 'Rien à corriger automatiquement',
        description: repair.value.after.diagnostics.length
          ? 'Les constats restants demandent une décision d\'architecture.'
          : 'Ce plan ne présente aucune anomalie.',
        color: 'info'
      })
    }
  }

  /** Applique la correction : sur place, ou dans un plan dédié. */
  function applyRepair(mode: 'inPlace' | 'newBoard' = 'newBoard') {
    const result = repair.value
    if (!result) return

    if (mode === 'newBoard') {
      const corrected = { ...result.board, id: genId('b'), name: `${board.value.name} — corrigé` }
      boards.value.push(corrected)
      activeBoardId.value = corrected.id
      past.value = []
      future.value = []
    } else {
      commit(() => replaceBoard(result.board))
    }

    clearSelection()
    toast.add({
      title: `${result.changes.length} correction(s) appliquée(s)`,
      description: `Santé ${result.before.score} → ${result.after.score}/100.`,
      color: 'success'
    })
    repair.value = null
  }

  /* -------------------------------------------------------------- Vue */

  function zoomBy(factor: number, centerX?: number, centerY?: number) {
    const previous = viewport.value.scale
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, previous * factor))
    if (scale === previous) return

    // Zoom centré sur le curseur : le point sous la souris ne bouge pas.
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

  function resetView() {
    viewport.value = { x: 0, y: 0, scale: 1 }
  }

  /** Recadre sur l'ensemble du plan, ou sur la sélection si elle existe. */
  function fitToContent(width: number, height: number) {
    const targets = selectedIds.value.length ? selectedNodes.value : board.value.nodes
    if (!targets.length) return resetView()

    const minX = Math.min(...targets.map(node => node.x))
    const minY = Math.min(...targets.map(node => node.y))
    const maxX = Math.max(...targets.map(node => node.x + 160))
    const maxY = Math.max(...targets.map(node => node.y + 80))

    const margin = 80
    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Math.min(
        (width - margin * 2) / Math.max(1, maxX - minX),
        (height - margin * 2) / Math.max(1, maxY - minY)
      ))
    )

    viewport.value = {
      scale,
      x: width / 2 - ((minX + maxX) / 2) * scale,
      y: height / 2 - ((minY + maxY) / 2) * scale
    }
  }

  /* ------------------------------------------------------ Persistance */

  async function load(force = false) {
    if (loaded.value && !force) return
    try {
      const document = await doc.load(scopeRef.value)
      const workspace = document.data
        ? normalizeWorkspace(document.data)
        : { boards: [createBoard()], activeBoardId: '' }

      boards.value = workspace.boards
      activeBoardId.value = workspace.activeBoardId || workspace.boards[0]!.id
      past.value = []
      future.value = []
    } catch {
      toast.add({ title: 'Plan indisponible', color: 'warning' })
    } finally {
      loaded.value = true
    }
  }

  async function switchScope(next: 'user' | 'team', nextTeamId?: number) {
    scope.value = next
    teamId.value = next === 'team' ? (nextTeamId ?? null) : null
    clearSelection()
    loaded.value = false
    await load(true)
  }

  async function save(silent = true) {
    try {
      const ok = await doc.save(scopeRef.value, {
        boards: boards.value,
        activeBoardId: activeBoardId.value
      })
      if (!ok) {
        toast.add({ title: 'Modifié par un coéquipier', color: 'warning' })
        return
      }
      if (!silent) toast.add({ title: 'Plan enregistré', color: 'success' })
    } catch {
      if (!silent) toast.add({ title: 'Enregistrement impossible', color: 'error' })
    }
  }

  function acceptRemote() {
    const remote = doc.resolveWithRemote()
    if (!remote) return
    const workspace = normalizeWorkspace(remote)
    boards.value = workspace.boards
    activeBoardId.value = workspace.activeBoardId
    toast.add({ title: 'Version de l\'équipe rechargée', color: 'success' })
  }

  async function overwriteRemote() {
    doc.forceLocal()
    await save(false)
  }

  /** Reprend un plan exporté, en le posant à côté de l'existant. */
  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text())
      const incoming = normalizeBoard(parsed)
      if (!incoming.nodes.length) {
        toast.add({ title: 'Fichier sans composant', color: 'warning' })
        return
      }

      const offsetY = board.value.nodes.length
        ? Math.max(...board.value.nodes.map(node => node.y)) + 200
        : 0

      // Identifiants régénérés : deux imports du même fichier ne se percutent pas.
      const mapping = new Map<string, string>()
      const nodes = incoming.nodes.map((node) => {
        const id = genId()
        mapping.set(node.id, id)
        return { ...node, id, y: node.y + offsetY }
      })

      const links = incoming.links
        .map(link => ({
          ...link,
          id: genId('l'),
          from: mapping.get(link.from)!,
          to: mapping.get(link.to)!
        }))
        .filter(link => link.from && link.to)

      commit(() => {
        board.value.nodes.push(...nodes)
        board.value.links.push(...links)
      })

      selectedIds.value = nodes.map(node => node.id)
      toast.add({
        title: 'Plan importé',
        description: `${nodes.length} composants et ${links.length} liaisons ajoutés.`,
        color: 'success'
      })
    } catch {
      toast.add({ title: 'Import impossible', description: 'Fichier JSON invalide.', color: 'error' })
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(board.value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${board.value.name.replace(/\s+/g, '-').toLowerCase()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const itemOf = (node: BoardNode) => findCatalogItem(node.type)

  return {
    boards, activeBoardId, board, loaded, scope, teamId,
    dockOpen, diagnosticsOpen, fullscreen, viewport,
    selectedIds, selectedNodeId, selectedNode, selectedNodes, linkingFrom,
    selectedLinkId, selectedLink, selectLink, selectInRect,
    report, diagnosticsByNode, diagnosticsByLink, linksOfSelected,
    canUndo, canRedo, clipboard,
    // nœuds
    addNode, moveNode, nudge, removeNode, removeSelection, updateNode, updateConfig, setPorts,
    duplicateNode, duplicateSelection,
    // sélection & presse-papiers
    isSelected, select, selectAll, clearSelection, copy, cut, paste,
    // liaisons
    startLink, completeLink, linkSelection, removeLink, updateLink, connect,
    // plateaux & modèles
    addBoard, removeBoard, renameBoard, generate, blueprints: BLUEPRINTS,
    repair, analyseRepair, applyRepair,
    // vue
    zoomBy, panBy, resetView, fitToContent, checkpoint, undo, redo,
    // persistance
    load, save, switchScope, acceptRemote, overwriteRemote, exportJson, importJson, itemOf,
    conflict: doc.conflict, savedLabel: doc.savedLabel, saving: doc.saving
  }
}
