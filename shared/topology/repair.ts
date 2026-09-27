import { MEDIA, findMedium, isOptical, type Connector, type MediumId } from './catalog'
import {
  analyseBoard,
  type DiagCategory,
  type Diagnostic,
  type DiagnosticReport
} from './diagnostics'
import {
  inferCable,
  portSlots,
  slotUsage,
  type Board,
  type BoardLink,
  type BoardNode,
  type PortSlot
} from './model'

/**
 * Correction automatique d'un plan.
 *
 * Le principe : ne réparer que ce qui découle mécaniquement des données —
 * choisir un câble compatible, libérer une adresse en double, brancher une
 * alimentation disponible. Tout ce qui relève d'une décision d'architecture
 * (ajouter un pare-feu, supprimer une boucle) est laissé à l'utilisateur, avec
 * le constat correspondant.
 */

export interface RepairChange {
  rule: string
  category: DiagCategory
  /** Résumé lisible de la modification appliquée. */
  label: string
  detail: string
  nodeIds: string[]
  linkIds: string[]
}

export interface RepairResult {
  board: Board
  changes: RepairChange[]
  /** Constats subsistants, qui demandent un arbitrage humain. */
  unresolved: Diagnostic[]
  before: DiagnosticReport
  after: DiagnosticReport
}

/** Substituts chiffrés des services historiquement en clair. */
const SECURE_ALTERNATIVES: Record<number, { name: string, port: number, protocol: 'tcp' | 'udp' }> = {
  21: { name: 'SFTP', port: 22, protocol: 'tcp' },
  23: { name: 'SSH', port: 22, protocol: 'tcp' },
  25: { name: 'SMTPS', port: 465, protocol: 'tcp' },
  80: { name: 'HTTPS', port: 443, protocol: 'tcp' },
  110: { name: 'POP3S', port: 995, protocol: 'tcp' },
  143: { name: 'IMAPS', port: 993, protocol: 'tcp' },
  389: { name: 'LDAPS', port: 636, protocol: 'tcp' },
  512: { name: 'SSH', port: 22, protocol: 'tcp' },
  513: { name: 'SSH', port: 22, protocol: 'tcp' },
  514: { name: 'Syslog TLS', port: 6514, protocol: 'tcp' }
}

/*
 * SNMP (161) n'apparaît pas ici : la version 3 chiffrée conserve le même port.
 * C'est un changement de configuration, pas de port, donc laissé à l'opérateur.
 */

/** Règles que la correction automatique ne prend pas en charge. */
const STRUCTURAL = new Set([
  'orphan', 'island', 'loop', 'no-firewall', 'wan-direct', 'oversubscription',
  'uplink', 'core-services', 'no-monitoring', 'no-ups', 'endpoint-direct',
  'duplicate', 'vlan', 'ip-subnet', 'port-overflow', 'ports', 'psu-partial', 'fabric'
])

type Usage = Map<string, number>

const key = (nodeId: string, slotId: string) => `${nodeId}|${slotId}`

function buildUsage(board: Board): Usage {
  const usage: Usage = new Map()
  for (const link of board.links) {
    if (link.fromPort) usage.set(key(link.from, link.fromPort), (usage.get(key(link.from, link.fromPort)) ?? 0) + 1)
    if (link.toPort) usage.set(key(link.to, link.toPort), (usage.get(key(link.to, link.toPort)) ?? 0) + 1)
  }
  return usage
}

function freeSlots(node: BoardNode, family: 'data' | 'power' | 'console', usage: Usage): PortSlot[] {
  return portSlots(node)
    .filter(slot => slot.family === family)
    .filter(slot => (usage.get(key(node.id, slot.id)) ?? 0) < slot.count)
}

function take(usage: Usage, nodeId: string, slotId: string) {
  usage.set(key(nodeId, slotId), (usage.get(key(nodeId, slotId)) ?? 0) + 1)
}

function release(usage: Usage, nodeId: string, slotId?: string) {
  if (!slotId) return
  usage.set(key(nodeId, slotId), Math.max(0, (usage.get(key(nodeId, slotId)) ?? 0) - 1))
}

/** Meilleure paire de prises pour une liaison, à distance donnée. */
function bestPair(
  from: BoardNode,
  to: BoardNode,
  family: 'data' | 'power' | 'console',
  lengthM: number,
  usage: Usage
): { a: PortSlot, b: PortSlot, medium: MediumId, speed: number } | null {
  let best: { a: PortSlot, b: PortSlot, medium: MediumId, speed: number, score: number } | null = null

  for (const a of freeSlots(from, family, usage)) {
    for (const b of freeSlots(to, family, usage)) {
      const cable = inferCable(a.connector, b.connector, a.speedGbps, b.speedGbps, lengthM)
      if (!cable) continue

      const spec = findMedium(cable.medium)
      if (spec && lengthM > spec.maxLengthM) continue

      const copper = a.connector === 'rj45' && b.connector === 'rj45'
      let score = Math.min(a.speedGbps, b.speedGbps)
      if (a.connector === b.connector) score += 100
      if (copper && lengthM > 90) score -= 1000

      if (!best || score > best.score) {
        best = { a, b, medium: cable.medium, speed: cable.speedGbps, score }
      }
    }
  }

  return best ? { a: best.a, b: best.b, medium: best.medium, speed: best.speed } : null
}

/** Prochaine adresse libre du même /24. */
function nextFreeIp(ip: string, taken: Set<string>): string | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null

  const base = `${parts[0]}.${parts[1]}.${parts[2]}`
  for (let host = 2; host < 255; host++) {
    const candidate = `${base}.${host}`
    if (!taken.has(candidate)) return candidate
  }
  return null
}

/* --------------------------------------------------------- Réparations */

/** Rattache les liaisons posées sans prise précise. */
function attachPorts(board: Board, usage: Usage, changes: RepairChange[]) {
  for (const link of board.links) {
    if (link.fromPort && link.toPort) continue

    const from = board.nodes.find(node => node.id === link.from)
    const to = board.nodes.find(node => node.id === link.to)
    if (!from || !to) continue

    const family = findMedium(link.medium)?.family === 'énergie' ? 'power' : 'data'
    const pair = bestPair(from, to, family, link.lengthM, usage)
    if (!pair) continue

    link.fromPort = pair.a.id
    link.toPort = pair.b.id
    take(usage, from.id, pair.a.id)
    take(usage, to.id, pair.b.id)

    changes.push({
      rule: 'attach-ports', category: 'cabling',
      label: `${from.label} → ${to.label} : liaison rattachée à des prises réelles`,
      detail: `${pair.a.connector.toUpperCase()} sur ${from.label}, ${pair.b.connector.toUpperCase()} sur ${to.label}.`,
      nodeIds: [from.id, to.id], linkIds: [link.id]
    })
  }
}

/** Support incompatible, débit hors norme, longueur excessive. */
function repairCabling(board: Board, usage: Usage, changes: RepairChange[]) {
  for (const link of board.links) {
    const from = board.nodes.find(node => node.id === link.from)
    const to = board.nodes.find(node => node.id === link.to)
    const medium = findMedium(link.medium)
    if (!from || !to || !medium) continue

    const slotA = link.fromPort ? portSlots(from).find(slot => slot.id === link.fromPort) : undefined
    const slotB = link.toPort ? portSlots(to).find(slot => slot.id === link.toPort) : undefined

    const accepts = (slot?: PortSlot) => !slot || medium.connectors.includes(slot.connector)
    const powerLink = medium.family === 'énergie'

    // 1. Connectique incompatible, ou longueur au-delà de la norme.
    const tooLong = link.lengthM > medium.maxLengthM
    const incompatible = !powerLink && (!accepts(slotA) || !accepts(slotB))

    if (incompatible || tooLong) {
      // On tente d'abord de garder les prises et de changer de support.
      const candidate = slotA && slotB
        ? inferCable(slotA.connector, slotB.connector, slotA.speedGbps, slotB.speedGbps, link.lengthM)
        : null
      const candidateSpec = candidate ? findMedium(candidate.medium) : null

      if (candidate && candidateSpec && link.lengthM <= candidateSpec.maxLengthM) {
        const previous = medium.label
        link.medium = candidate.medium
        link.speedGbps = Math.min(link.speedGbps || candidate.speedGbps, candidateSpec.maxSpeedGbps)

        changes.push({
          rule: tooLong ? 'length' : 'medium', category: 'cabling',
          label: `${from.label} → ${to.label} : ${previous} remplacé par ${candidateSpec.label}`,
          detail: tooLong
            ? `${link.lengthM} m dépassait la portée de ${previous}.`
            : 'Le support ne correspondait pas à la connectique des deux extrémités.',
          nodeIds: [from.id, to.id], linkIds: [link.id]
        })
        continue
      }

      // Sinon, on cherche un autre couple de prises capable de tenir la distance.
      release(usage, from.id, link.fromPort)
      release(usage, to.id, link.toPort)

      const pair = bestPair(from, to, powerLink ? 'power' : 'data', link.lengthM, usage)
      if (pair) {
        const previous = medium.label
        link.fromPort = pair.a.id
        link.toPort = pair.b.id
        link.medium = pair.medium
        link.speedGbps = pair.speed
        take(usage, from.id, pair.a.id)
        take(usage, to.id, pair.b.id)

        changes.push({
          rule: tooLong ? 'length' : 'medium', category: 'cabling',
          label: `${from.label} → ${to.label} : passage en ${findMedium(pair.medium)?.label}`,
          detail: `Liaison déplacée sur des prises ${pair.a.connector.toUpperCase()} / ${pair.b.connector.toUpperCase()}, ${previous} ne convenait pas.`,
          nodeIds: [from.id, to.id], linkIds: [link.id]
        })
        continue
      }

      // Rien de compatible : on rend les prises et on laisse le constat.
      take(usage, from.id, link.fromPort ?? '')
      take(usage, to.id, link.toPort ?? '')
      continue
    }

    // 2. Débit au-delà du support ou des ports.
    const portLimit = Math.min(
      slotA?.speedGbps ?? Infinity,
      slotB?.speedGbps ?? Infinity,
      medium.maxSpeedGbps || Infinity
    )

    if (!powerLink && Number.isFinite(portLimit) && link.speedGbps > portLimit) {
      const previous = link.speedGbps
      link.speedGbps = portLimit

      changes.push({
        rule: 'speed', category: 'cabling',
        label: `${from.label} → ${to.label} : débit ramené à ${portLimit} Gb/s`,
        detail: `${previous} Gb/s dépassait la capacité du support ou des ports.`,
        nodeIds: [from.id, to.id], linkIds: [link.id]
      })
    }

    // 3. Longueur non renseignée.
    if (link.lengthM === 0 && medium.family !== 'radio') {
      link.lengthM = powerLink ? 2 : 3
      changes.push({
        rule: 'length-zero', category: 'cabling',
        label: `${from.label} → ${to.label} : longueur estimée à ${link.lengthM} m`,
        detail: 'Aucune longueur n\'était renseignée ; ajustez-la si nécessaire.',
        nodeIds: [from.id, to.id], linkIds: [link.id]
      })
    }
  }
}

/** Adresses invalides et doublons. */
function repairAddressing(board: Board, changes: RepairChange[]) {
  const taken = new Set<string>()
  const seen = new Set<string>()

  for (const node of board.nodes) {
    const ip = node.config.ip?.trim()
    if (!ip) continue

    const valid = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)
      && ip.split('.').every(part => Number(part) <= 255)

    if (!valid) {
      node.config = { ...node.config, ip: undefined }
      changes.push({
        rule: 'ip-format', category: 'network',
        label: `${node.label} : adresse « ${ip} » retirée`,
        detail: 'Cette valeur n\'est pas une adresse IPv4 valide.',
        nodeIds: [node.id], linkIds: []
      })
      continue
    }

    if (seen.has(ip)) {
      const replacement = nextFreeIp(ip, taken)
      if (replacement) {
        node.config = { ...node.config, ip: replacement }
        taken.add(replacement)
        changes.push({
          rule: 'ip-duplicate', category: 'network',
          label: `${node.label} : ${ip} → ${replacement}`,
          detail: 'Cette adresse était déjà attribuée à un autre équipement.',
          nodeIds: [node.id], linkIds: []
        })
        continue
      }
    }

    seen.add(ip)
    taken.add(ip)
  }
}

/** Noms en double et collisions de position en baie. */
function repairInventory(board: Board, changes: RepairChange[]) {
  const byLabel = new Map<string, BoardNode[]>()
  for (const node of board.nodes) {
    const label = node.label.trim().toLowerCase()
    if (label) byLabel.set(label, [...(byLabel.get(label) ?? []), node])
  }

  for (const nodes of byLabel.values()) {
    if (nodes.length < 2) continue
    nodes.forEach((node, index) => {
      const renamed = `${node.label}-${String(index + 1).padStart(2, '0')}`
      changes.push({
        rule: 'label-duplicate', category: 'ops',
        label: `${node.label} → ${renamed}`,
        detail: `${nodes.length} équipements portaient ce nom.`,
        nodeIds: [node.id], linkIds: []
      })
      node.label = renamed
    })
  }

  const byUnit = new Map<string, BoardNode[]>()
  for (const node of board.nodes) {
    const unit = node.config.rackUnit?.trim().toUpperCase()
    if (unit) byUnit.set(unit, [...(byUnit.get(unit) ?? []), node])
  }

  const occupied = new Set(byUnit.keys())

  for (const [unit, nodes] of byUnit) {
    if (nodes.length < 2) continue

    // Le premier garde sa place, les suivants descendent d'un U libre.
    for (const node of nodes.slice(1)) {
      const number = Number(unit.replace(/\D/g, ''))
      let candidate: string | null = null

      for (let offset = 1; offset < 42 && !candidate; offset++) {
        const below = `U${String(Math.max(1, number - offset)).padStart(2, '0')}`
        if (!occupied.has(below)) candidate = below
      }

      if (!candidate) continue
      occupied.add(candidate)

      changes.push({
        rule: 'rack-collision', category: 'ops',
        label: `${node.label} : position ${unit} → ${candidate}`,
        detail: 'Deux équipements occupaient la même position en baie.',
        nodeIds: [node.id], linkIds: []
      })
      node.config = { ...node.config, rackUnit: candidate }
    }
  }
}

/** Branche les équipements non alimentés sur une source disponible. */
function repairPower(board: Board, usage: Usage, changes: RepairChange[]) {
  const sources = board.nodes.filter(node =>
    portSlots(node).some(slot => slot.family === 'power')
    && ['pwr-pdu', 'pwr-ups', 'pwr-genset', 'pwr-ats'].includes(node.type)
  )
  if (!sources.length) return

  for (const node of board.nodes) {
    if (sources.includes(node)) continue

    const inlets = portSlots(node).filter(slot => slot.family === 'power')
    if (!inlets.length) continue

    const powered = board.links.filter(
      link => findMedium(link.medium)?.family === 'énergie'
        && (link.from === node.id || link.to === node.id)
    )
    if (powered.length) continue

    const inlet = inlets.find(slot => (usage.get(key(node.id, slot.id)) ?? 0) < slot.count)
    if (!inlet) continue

    const source = sources.find(candidate =>
      freeSlots(candidate, 'power', usage).length > 0
    )
    if (!source) continue

    const outlet = freeSlots(source, 'power', usage)[0]!

    board.links.push({
      id: `l-fix-${node.id}-${outlet.id}`,
      from: source.id,
      to: node.id,
      fromPort: outlet.id,
      toPort: inlet.id,
      medium: 'power',
      speedGbps: 0,
      lengthM: 2
    })

    take(usage, source.id, outlet.id)
    take(usage, node.id, inlet.id)

    changes.push({
      rule: 'power-missing', category: 'power',
      label: `${node.label} alimenté depuis ${source.label}`,
      detail: 'Cet équipement n\'avait aucun cordon secteur.',
      nodeIds: [node.id, source.id], linkIds: []
    })
  }
}

/** Répartit les alimentations doublées sur deux sources distinctes. */
function repairPowerFeeds(board: Board, usage: Usage, changes: RepairChange[]) {
  const sources = board.nodes.filter(node =>
    ['pwr-pdu', 'pwr-ups', 'pwr-genset', 'pwr-ats'].includes(node.type)
  )
  if (sources.length < 2) return

  for (const node of board.nodes) {
    const cords = board.links.filter(
      link => findMedium(link.medium)?.family === 'énergie'
        && (link.from === node.id || link.to === node.id)
    )
    if (cords.length < 2) continue

    const feeds = cords.map(link => (link.from === node.id ? link.to : link.from))
    if (new Set(feeds).size > 1) continue

    const current = feeds[0]
    const alternative = sources.find(candidate =>
      candidate.id !== current && freeSlots(candidate, 'power', usage).length > 0
    )
    if (!alternative) continue

    const cord = cords[1]!
    const outlet = freeSlots(alternative, 'power', usage)[0]!
    const previousId = cord.from === node.id ? cord.to : cord.from
    const previous = board.nodes.find(item => item.id === previousId)

    release(usage, previousId, cord.from === node.id ? cord.toPort : cord.fromPort)

    if (cord.from === node.id) {
      cord.to = alternative.id
      cord.toPort = outlet.id
    } else {
      cord.from = alternative.id
      cord.fromPort = outlet.id
    }
    take(usage, alternative.id, outlet.id)

    changes.push({
      rule: 'psu-same-feed', category: 'power',
      label: `${node.label} : seconde alimentation déplacée sur ${alternative.label}`,
      detail: `Les deux cordons partaient de ${previous?.label ?? 'la même source'}.`,
      nodeIds: [node.id, alternative.id], linkIds: [cord.id]
    })
  }
}

/** Remplace les services en clair par leur équivalent chiffré. */
function repairServices(board: Board, changes: RepairChange[]) {
  for (const node of board.nodes) {
    const services = node.config.services
    if (!services?.length) continue

    let touched = false
    const next = services.map((service) => {
      const secure = SECURE_ALTERNATIVES[service.port]
      if (!secure) return service

      touched = true
      changes.push({
        rule: 'plaintext', category: 'security',
        label: `${node.label} : ${service.name} (${service.port}) → ${secure.name} (${secure.port})`,
        detail: 'Ce service circulait en clair.',
        nodeIds: [node.id], linkIds: []
      })
      return { ...secure }
    })

    if (touched) node.config = { ...node.config, services: next }
  }
}

/* --------------------------------------------------------------- Moteur */

/**
 * Produit une copie corrigée du plan.
 *
 * L'original n'est jamais modifié : l'appelant décide d'appliquer le résultat
 * ou non, après avoir vu la liste des changements.
 */
export function repairBoard(board: Board): RepairResult {
  const before = analyseBoard(board)
  const copy: Board = JSON.parse(JSON.stringify(board))
  const changes: RepairChange[] = []
  const usage = buildUsage(copy)

  attachPorts(copy, usage, changes)
  repairCabling(copy, usage, changes)
  repairAddressing(copy, changes)
  repairInventory(copy, changes)
  repairPower(copy, usage, changes)
  repairPowerFeeds(copy, usage, changes)
  repairServices(copy, changes)

  copy.updatedAt = new Date().toISOString()

  const after = analyseBoard(copy)
  const unresolved = after.diagnostics.filter(item => STRUCTURAL.has(item.rule) || item.severity !== 'info')

  return { board: copy, changes, unresolved, before, after }
}
