import {
  connectorFamily,
  findCatalogItem,
  findMedium,
  isOptical,
  type Connector,
  type ConnectorFamily,
  type MediumId,
  type PortGroup
} from './catalog'

/** Modèle de plan de TanchiTopologyBoard. */

export interface NodeConfig {
  cpu?: string
  cores?: number
  ramGb?: number
  storageTb?: number
  ip?: string
  vlan?: number
  os?: string
  /** Services exposés, hérités du catalogue puis ajustables. */
  services?: { name: string, port: number, protocol: 'tcp' | 'udp' }[]
  /**
   * Connectique réelle de l'équipement, saisie par l'utilisateur.
   * Prend le pas sur celle du catalogue : un même modèle de commutateur existe
   * en 8, 24 ou 48 ports.
   */
  ports?: PortGroup[]
  model?: string
  rackUnit?: string
  notes?: string
}

export interface BoardNode {
  id: string
  /** Identifiant d'entrée du catalogue. */
  type: string
  label: string
  x: number
  y: number
  config: NodeConfig
}

export interface BoardLink {
  id: string
  from: string
  to: string
  /** Point de câblage utilisé à chaque extrémité, ex. `rj45#0`. */
  fromPort?: string
  toPort?: string
  medium: MediumId
  /** Débit négocié, en Gb/s. */
  speedGbps: number
  lengthM: number
  label?: string
}

export interface Board {
  id: string
  name: string
  nodes: BoardNode[]
  links: BoardLink[]
  createdAt: string
  updatedAt: string
}

export interface TopologyWorkspace {
  boards: Board[]
  activeBoardId: string
}

/** Connectique effective : saisie utilisateur si présente, catalogue sinon. */
export function effectivePorts(node: BoardNode): PortGroup[] {
  if (node.config.ports?.length) return node.config.ports
  return findCatalogItem(node.type)?.ports ?? []
}

/** Nombre de ports de données, hors alimentation et console. */
export function dataPortCount(node: BoardNode): number {
  return effectivePorts(node)
    .filter(port => port.connector !== 'power' && port.connector !== 'serial')
    .reduce((total, port) => total + port.count, 0)
}

export const GRID = 20
export const NODE_WIDTH = 156
export const NODE_HEIGHT = 68

/* ------------------------------------------------ Points de câblage */

export interface PortSlot {
  /** Identifiant stable du groupe : `connecteur#index`. */
  id: string
  connector: Connector
  count: number
  speedGbps: number
  family: ConnectorFamily
  side: 'right' | 'bottom'
  /** Décalage par rapport au coin haut-gauche du nœud. */
  dx: number
  dy: number
}

/**
 * Points de câblage d'un nœud, un par groupe de ports.
 *
 * Représenter chaque port physique serait illisible sur un commutateur 48
 * ports : on expose un point par groupe, avec son compteur d'occupation.
 * Les données sortent à droite, l'énergie et la console par le bas — c'est ce
 * qui rend un PSU immédiatement distinguable d'un lien Ethernet.
 */
export function portSlots(node: BoardNode): PortSlot[] {
  const groups = [...effectivePorts(node)]
  const spec = findCatalogItem(node.type)

  // Un équipement qui réclame du courant expose une prise, même si le
  // catalogue ne détaille pas son alimentation : c'est ce qui rend le PSU
  // câblable et visible sur le plan.
  const hasPower = groups.some(port => connectorFamily(port.connector) === 'power')
  if (spec?.needsPower && !hasPower) {
    groups.push({
      connector: 'power',
      count: spec.kind === 'endpoint' ? 1 : 2,
      speedGbps: 0
    })
  }

  const data = groups.filter(port => connectorFamily(port.connector) === 'data')
  const others = groups.filter(port => connectorFamily(port.connector) !== 'data')

  const slots: PortSlot[] = []

  data.forEach((port, index) => {
    const step = NODE_HEIGHT / (data.length + 1)
    slots.push({
      id: `${port.connector}#${index}`,
      connector: port.connector,
      count: port.count,
      speedGbps: port.speedGbps,
      family: 'data',
      side: 'right',
      dx: NODE_WIDTH,
      dy: step * (index + 1)
    })
  })

  others.forEach((port, index) => {
    const step = NODE_WIDTH / (others.length + 1)
    slots.push({
      id: `${port.connector}#${data.length + index}`,
      connector: port.connector,
      count: port.count,
      speedGbps: port.speedGbps,
      family: connectorFamily(port.connector),
      side: 'bottom',
      dx: step * (index + 1),
      dy: NODE_HEIGHT
    })
  })

  return slots
}

export function findSlot(node: BoardNode, portId: string): PortSlot | undefined {
  return portSlots(node).find(slot => slot.id === portId)
}

/** Position absolue d'un point de câblage, ou centre du nœud à défaut. */
export function slotPosition(node: BoardNode, portId?: string): { x: number, y: number } {
  const slot = portId ? findSlot(node, portId) : undefined
  if (!slot) return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 }
  return { x: node.x + slot.dx, y: node.y + slot.dy }
}

/** Liaisons déjà branchées sur un point donné. */
export function slotUsage(links: BoardLink[], nodeId: string, portId: string): number {
  return links.filter(
    link => (link.from === nodeId && link.fromPort === portId)
      || (link.to === nodeId && link.toPort === portId)
  ).length
}

/* ------------------------------------------------- Choix du câble */

export interface CableChoice {
  medium: MediumId
  speedGbps: number
  label: string
}

/**
 * Déduit le câble à poser entre deux connecteurs.
 *
 * Renvoie `null` quand les deux extrémités sont incompatibles : mieux vaut
 * refuser le branchement que fabriquer un lien impossible à réaliser.
 */
export function inferCable(
  a: Connector,
  b: Connector,
  aSpeed = 1,
  bSpeed = 1,
  lengthM = 3
): CableChoice | null {
  const familyA = connectorFamily(a)
  const familyB = connectorFamily(b)

  // Énergie et console ne se mélangent jamais aux données.
  if (familyA !== familyB) return null

  if (familyA === 'power') {
    return { medium: 'power', speedGbps: 0, label: 'Cordon secteur' }
  }

  if (familyA === 'console') {
    return { medium: 'serial', speedGbps: 0, label: 'Console série' }
  }

  const speed = Math.min(aSpeed || 1, bSpeed || 1)

  if (a === 'wireless' || b === 'wireless') {
    if (a !== b) return null
    return { medium: 'wireless', speedGbps: speed, label: 'Liaison sans-fil' }
  }

  // Une cage enfichable ne se raccorde pas directement à une prise RJ45 :
  // il faut un module cuivre ou un convertisseur de média.
  if ((a === 'rj45') !== (b === 'rj45')) return null

  if (a === 'rj45' && b === 'rj45') {
    // Le cuivre suffit jusqu'à 10 Gb/s ; au-delà il faut de la Cat 8.
    const medium: MediumId = speed > 10 ? 'cat8' : speed > 1 ? 'cat6a' : 'cat5e'
    return { medium, speedGbps: speed, label: `Ethernet ${medium.toUpperCase()}` }
  }

  // Une extrémité optique impose la fibre.
  if (isOptical(a) || isOptical(b)) {
    const medium: MediumId = lengthM > 400 ? 'os2' : 'om4'
    return { medium, speedGbps: speed, label: `Fibre ${medium.toUpperCase()}` }
  }

  // Deux cages enfichables identiques : la distance décide du support.
  // DAC en baie, câble optique actif à l'étage, fibre au-delà.
  if (a === b) {
    if (lengthM <= 7) return { medium: 'dac', speedGbps: speed, label: `DAC ${speed} Gb/s` }
    if (lengthM <= 30) return { medium: 'aoc', speedGbps: speed, label: `AOC ${speed} Gb/s` }
    if (lengthM <= 400) return { medium: 'om4', speedGbps: speed, label: 'Fibre OM4' }
    return { medium: 'os2', speedGbps: speed, label: 'Fibre OS2' }
  }

  // Cages différentes (SFP+ vers QSFP28 par exemple) : passage par la fibre.
  return { medium: 'om4', speedGbps: speed, label: 'Fibre OM4' }
}

export function genId(prefix = 'n'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function snap(value: number): number {
  return Math.round(value / GRID) * GRID
}

export function createBoard(name = 'Plan 1'): Board {
  const now = new Date().toISOString()
  return { id: genId('b'), name, nodes: [], links: [], createdAt: now, updatedAt: now }
}

/** Crée un nœud à partir du catalogue, services par défaut inclus. */
export function createNode(typeId: string, x: number, y: number, index = 0): BoardNode | null {
  const item = findCatalogItem(typeId)
  if (!item) return null

  return {
    id: genId(),
    type: typeId,
    label: index > 0 ? `${item.label} ${index + 1}` : item.label,
    x: snap(x),
    y: snap(y),
    config: {
      services: item.services ? item.services.map(service => ({ ...service })) : []
    }
  }
}

/** Support par défaut d'une liaison, déduit de la connectique commune. */
export function defaultMediumFor(fromType: string, toType: string): MediumId {
  const from = findCatalogItem(fromType)
  const to = findCatalogItem(toType)
  if (!from || !to) return 'cat6a'

  const connectors = new Set(from.ports.map(port => port.connector))
  const shared = to.ports.filter(port => connectors.has(port.connector))

  if (shared.some(port => port.connector === 'power')) return 'power'
  if (shared.some(port => port.connector === 'wireless')) return 'wireless'
  if (shared.some(port => ['qsfp28', 'qsfp-dd', 'qsfp+'].includes(port.connector))) return 'om4'
  if (shared.some(port => ['sfp+', 'sfp28', 'sfp'].includes(port.connector))) return 'om3'
  return 'cat6a'
}

/** Débit par défaut : le plus petit maillon de la chaîne. */
export function defaultSpeedFor(fromType: string, toType: string, medium: MediumId): number {
  const from = findCatalogItem(fromType)
  const to = findCatalogItem(toType)
  const spec = findMedium(medium)

  const best = (id?: string) => {
    const item = id ? findCatalogItem(id) : undefined
    return item?.ports.reduce((max, port) => Math.max(max, port.speedGbps), 0) ?? 1
  }

  const candidates = [best(from?.id), best(to?.id), spec?.maxSpeedGbps ?? 1].filter(value => value > 0)
  return candidates.length ? Math.min(...candidates) : 1
}

export function createLink(from: BoardNode, to: BoardNode): BoardLink {
  const medium = defaultMediumFor(from.type, to.type)
  return {
    id: genId('l'),
    from: from.id,
    to: to.id,
    medium,
    speedGbps: defaultSpeedFor(from.type, to.type, medium),
    lengthM: 3
  }
}

/* ------------------------------------------------------ Normalisation */

function sanitizeNode(raw: unknown): BoardNode | null {
  const node = (raw ?? {}) as Partial<BoardNode>
  if (!node.type || !findCatalogItem(String(node.type))) return null

  return {
    id: String(node.id || genId()),
    type: String(node.type),
    label: String(node.label ?? findCatalogItem(String(node.type))!.label).slice(0, 80),
    x: Number.isFinite(Number(node.x)) ? Number(node.x) : 0,
    y: Number.isFinite(Number(node.y)) ? Number(node.y) : 0,
    config: typeof node.config === 'object' && node.config ? node.config : {}
  }
}

function sanitizeLink(raw: unknown, nodeIds: Set<string>): BoardLink | null {
  const link = (raw ?? {}) as Partial<BoardLink>
  const from = String(link.from ?? '')
  const to = String(link.to ?? '')

  // Un lien vers un nœud disparu n'a plus de sens.
  if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return null

  const medium = findMedium(String(link.medium)) ? (link.medium as MediumId) : 'cat6a'

  return {
    id: String(link.id || genId('l')),
    from,
    to,
    medium,
    fromPort: link.fromPort ? String(link.fromPort) : undefined,
    toPort: link.toPort ? String(link.toPort) : undefined,
    speedGbps: Number(link.speedGbps) > 0 ? Number(link.speedGbps) : 1,
    lengthM: Number(link.lengthM) >= 0 ? Number(link.lengthM) : 3,
    label: link.label ? String(link.label).slice(0, 60) : undefined
  }
}

export function normalizeBoard(raw: unknown): Board {
  const board = (raw ?? {}) as Partial<Board>
  const now = new Date().toISOString()

  const nodes = (Array.isArray(board.nodes) ? board.nodes : [])
    .map(sanitizeNode)
    .filter((node): node is BoardNode => node !== null)

  const nodeIds = new Set(nodes.map(node => node.id))
  const links = (Array.isArray(board.links) ? board.links : [])
    .map(link => sanitizeLink(link, nodeIds))
    .filter((link): link is BoardLink => link !== null)

  return {
    id: String(board.id || genId('b')),
    name: String(board.name || 'Plan 1').slice(0, 60),
    nodes,
    links,
    createdAt: String(board.createdAt || now),
    updatedAt: String(board.updatedAt || now)
  }
}

export function normalizeWorkspace(raw: unknown): TopologyWorkspace {
  const workspace = (raw ?? {}) as Partial<TopologyWorkspace>

  const boards = Array.isArray(workspace.boards) && workspace.boards.length
    ? workspace.boards.map(normalizeBoard)
    : [createBoard()]

  const activeBoardId = boards.some(board => board.id === workspace.activeBoardId)
    ? String(workspace.activeBoardId)
    : boards[0]!.id

  return { boards, activeBoardId }
}
