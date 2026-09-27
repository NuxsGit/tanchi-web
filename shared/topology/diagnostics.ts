import { findCatalogItem, findMedium, type CatalogItem } from './catalog'
import {
  dataPortCount,
  effectivePorts,
  portSlots,
  slotUsage,
  type Board,
  type BoardLink,
  type BoardNode
} from './model'

/**
 * Contrôleur de cohérence du plan.
 *
 * Chaque règle est indépendante, rattachée à un domaine, et renvoie en plus du
 * constat la correction attendue : un diagnostic sans piste d'action ne sert à
 * rien sur un plan de deux cents équipements.
 */

export type Severity = 'error' | 'warning' | 'info'
export type DiagCategory = 'cabling' | 'network' | 'security' | 'power' | 'ops'

export const CATEGORY_LABELS: Record<DiagCategory, string> = {
  cabling: 'Câblage',
  network: 'Réseau',
  security: 'Sécurité',
  power: 'Énergie',
  ops: 'Exploitation'
}

export const CATEGORY_ICONS: Record<DiagCategory, string> = {
  cabling: 'i-lucide-cable',
  network: 'i-lucide-network',
  security: 'i-lucide-shield',
  power: 'i-lucide-zap',
  ops: 'i-lucide-clipboard-list'
}

export interface Diagnostic {
  id: string
  rule: string
  category: DiagCategory
  severity: Severity
  title: string
  detail: string
  /** Ce qu'il faut faire pour lever le constat. */
  fix: string
  nodeIds: string[]
  linkIds: string[]
}

interface Context {
  board: Board
  item: (node: BoardNode) => CatalogItem | undefined
  node: (id: string) => BoardNode | undefined
  linksOf: (nodeId: string) => BoardLink[]
  /** Liaisons de données, hors énergie et console. */
  dataLinksOf: (nodeId: string) => BoardLink[]
  powerLinksOf: (nodeId: string) => BoardLink[]
  other: (link: BoardLink, nodeId: string) => BoardNode | undefined
  isSwitching: (node: BoardNode) => boolean
  isExternal: (node: BoardNode) => boolean
}

type Rule = (ctx: Context) => Omit<Diagnostic, 'id'>[]

/* --------------------------------------------------------- Utilitaires */

/** Réseau /24 d'une adresse, base des contrôles de plan d'adressage. */
function subnet24(ip?: string): string | null {
  if (!ip) return null
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  if (parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
}

const isValidIp = (ip?: string) => subnet24(ip) !== null

/** Ports historiquement en clair, signalés à l'exposition. */
const PLAINTEXT = new Set([21, 23, 25, 80, 110, 143, 161, 389, 512, 513, 514])

/* ------------------------------------------------------- Règles câblage */

const mediumMismatch: Rule = ({ board, node, item }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const link of board.links) {
    const medium = findMedium(link.medium)
    const from = node(link.from)
    const to = node(link.to)
    if (!medium || !from || !to) continue

    const accepts = (target: BoardNode) => {
      if (medium.family === 'énergie') {
        return Boolean(item(target)?.needsPower)
          || effectivePorts(target).some(port => port.connector === 'power')
      }
      const ports = effectivePorts(target)
      return ports.length === 0 || ports.some(port => medium.connectors.includes(port.connector))
    }

    if (!accepts(from) || !accepts(to)) {
      const guilty = !accepts(from) ? from : to
      out.push({
        rule: 'medium', category: 'cabling', severity: 'error',
        title: `Câble ${medium.label} incompatible avec ${guilty.label}`,
        detail: `${guilty.label} n'expose aucun connecteur ${medium.connectors.join(' / ')}.`,
        fix: 'Changez de support, ou intercalez un convertisseur de média.',
        nodeIds: [from.id, to.id], linkIds: [link.id]
      })
    }
  }

  return out
}

const speedLimits: Rule = ({ board, node }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const link of board.links) {
    const medium = findMedium(link.medium)
    const from = node(link.from)
    const to = node(link.to)
    if (!medium || !from || !to || medium.family === 'énergie') continue

    if (link.speedGbps > medium.maxSpeedGbps) {
      out.push({
        rule: 'speed-medium', category: 'cabling', severity: 'error',
        title: `${medium.label} ne tient pas ${link.speedGbps} Gb/s`,
        detail: `Ce support plafonne à ${medium.maxSpeedGbps} Gb/s.`,
        fix: 'Passez sur un support supérieur, ou corrigez le débit annoncé.',
        nodeIds: [from.id, to.id], linkIds: [link.id]
      })
      continue
    }

    const maxPort = (target: BoardNode) => {
      const ports = effectivePorts(target)
      if (!ports.length) return Infinity
      return ports.reduce((max, port) => Math.max(max, port.speedGbps), 0)
    }

    const limit = Math.min(maxPort(from), maxPort(to))
    if (Number.isFinite(limit) && link.speedGbps > limit) {
      out.push({
        rule: 'speed-port', category: 'cabling', severity: 'warning',
        title: `Liaison ${link.speedGbps} Gb/s bridée à ${limit} Gb/s`,
        detail: `Le port le plus lent des deux extrémités s'arrête à ${limit} Gb/s.`,
        fix: 'Remplacez la carte réseau ou le module optique le plus lent.',
        nodeIds: [from.id, to.id], linkIds: [link.id]
      })
    }
  }

  return out
}

const cableLength: Rule = ({ board, node }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const link of board.links) {
    const medium = findMedium(link.medium)
    if (!medium) continue

    const ends = [node(link.from)?.id, node(link.to)?.id].filter(Boolean) as string[]

    if (link.lengthM > medium.maxLengthM) {
      out.push({
        rule: 'length', category: 'cabling', severity: 'error',
        title: `Câble ${medium.label} trop long (${link.lengthM} m)`,
        detail: `La norme s'arrête à ${medium.maxLengthM} m.`,
        fix: medium.family === 'cuivre'
          ? 'Passez en fibre, ou ajoutez un répartiteur intermédiaire.'
          : 'Choisissez une fibre monomode, ou rapprochez les équipements.',
        nodeIds: ends, linkIds: [link.id]
      })
      continue
    }

    // Zone de marge : au-delà de 90 % de la norme, la moindre rallonge casse.
    if (medium.maxLengthM > 0 && link.lengthM > medium.maxLengthM * 0.9) {
      out.push({
        rule: 'length-margin', category: 'cabling', severity: 'warning',
        title: `${medium.label} proche de la limite (${link.lengthM}/${medium.maxLengthM} m)`,
        detail: 'Il ne reste presque aucune marge pour le brassage et les réserves.',
        fix: 'Prévoyez un support de catégorie supérieure sur ce trajet.',
        nodeIds: ends, linkIds: [link.id]
      })
    }

    if (link.lengthM === 0 && medium.family !== 'radio') {
      out.push({
        rule: 'length-zero', category: 'cabling', severity: 'info',
        title: 'Longueur de câble non renseignée',
        detail: 'Sans longueur, les contrôles de portée ne s\'appliquent pas.',
        fix: 'Indiquez la longueur réelle dans l\'inspecteur.',
        nodeIds: ends, linkIds: [link.id]
      })
    }
  }

  return out
}

/** Occupation par point de câblage, dès que la liaison en désigne un. */
const portOverflow: Rule = ({ board, item }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const node of board.nodes) {
    const spec = item(node)
    if (!spec || spec.kind === 'service' || spec.kind === 'external') continue

    for (const slot of portSlots(node)) {
      const used = slotUsage(board.links, node.id, slot.id)
      if (used > slot.count) {
        out.push({
          rule: 'port-overflow', category: 'cabling', severity: 'error',
          title: `${node.label} : ${slot.connector.toUpperCase()} en surcharge (${used}/${slot.count})`,
          detail: 'Plus de câbles branchés que de ports sur ce groupe.',
          fix: 'Ajoutez des ports dans l\'inspecteur, ou répartissez sur un commutateur.',
          nodeIds: [node.id], linkIds: []
        })
      }
    }

    // Repli pour les liaisons posées sans point précis.
    const untyped = board.links.filter(
      link => (link.from === node.id && !link.fromPort) || (link.to === node.id && !link.toPort)
    ).filter(link => findMedium(link.medium)?.family !== 'énergie').length

    const capacity = dataPortCount(node)
    if (capacity && untyped > capacity) {
      out.push({
        rule: 'ports', category: 'cabling', severity: 'error',
        title: `${node.label} : ${untyped} liaisons pour ${capacity} ports`,
        detail: 'La capacité totale de l\'équipement est dépassée.',
        fix: 'Ajoutez un module d\'extension, ou un commutateur intermédiaire.',
        nodeIds: [node.id], linkIds: []
      })
    }
  }

  return out
}

/** Deux terminaux reliés en direct : il manque un équipement actif. */
const endpointToEndpoint: Rule = ({ board, node, item }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const link of board.links) {
    if (findMedium(link.medium)?.family === 'énergie') continue

    const from = node(link.from)
    const to = node(link.to)
    if (!from || !to) continue

    if (item(from)?.kind === 'endpoint' && item(to)?.kind === 'endpoint') {
      out.push({
        rule: 'endpoint-direct', category: 'cabling', severity: 'warning',
        title: `${from.label} et ${to.label} sont reliés en direct`,
        detail: 'Deux terminaux raccordés sans équipement actif entre eux.',
        fix: 'Intercalez un commutateur, ou documentez le câble croisé.',
        nodeIds: [from.id, to.id], linkIds: [link.id]
      })
    }
  }

  return out
}

const duplicateLinks: Rule = ({ board, node }) => {
  const groups = new Map<string, BoardLink[]>()

  for (const link of board.links) {
    if (findMedium(link.medium)?.family === 'énergie') continue
    const key = [link.from, link.to].sort().join('|')
    groups.set(key, [...(groups.get(key) ?? []), link])
  }

  return [...groups.values()]
    .filter(links => links.length > 1)
    .map(links => ({
      rule: 'duplicate',
      category: 'cabling' as DiagCategory,
      severity: 'info' as Severity,
      title: `${links.length} liaisons entre ${node(links[0]!.from)?.label} et ${node(links[0]!.to)?.label}`,
      detail: 'Agrégation volontaire, ou doublon involontaire.',
      fix: 'Nommez ces liens « LACP » si l\'agrégation est voulue.',
      nodeIds: [links[0]!.from, links[0]!.to],
      linkIds: links.map(link => link.id)
    }))
}

/* -------------------------------------------------------- Règles réseau */

const orphanNodes: Rule = ({ board, item, dataLinksOf }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const node of board.nodes) {
    const spec = item(node)
    if (!spec || spec.kind === 'external') continue
    if (spec.kind === 'passive' && !spec.ports.length) continue

    // Un PDU ou un onduleur n'a que des prises secteur : rien à câbler en données.
    const hasDataPort = effectivePorts(node).some(
      port => port.connector !== 'power' && port.connector !== 'serial'
    )
    if (!hasDataPort) continue

    if (!dataLinksOf(node.id).length) {
      out.push({
        rule: 'orphan', category: 'network', severity: 'warning',
        title: `${node.label} n'est relié à rien`,
        detail: 'Aucune liaison de données.',
        fix: 'Reliez-le à un commutateur, ou retirez-le du plan.',
        nodeIds: [node.id], linkIds: []
      })
    }
  }

  return out
}

const switchingLoop: Rule = ({ board, node, item, isSwitching }) => {
  const switches = board.nodes.filter(isSwitching)
  if (switches.length < 3) return []

  const ids = new Set(switches.map(item => item.id))
  const adjacency = new Map<string, string[]>()
  for (const id of ids) adjacency.set(id, [])

  for (const link of board.links) {
    if (!ids.has(link.from) || !ids.has(link.to)) continue
    adjacency.get(link.from)!.push(link.to)
    adjacency.get(link.to)!.push(link.from)
  }

  const seen = new Set<string>()
  const path: string[] = []

  const walk = (current: string, parent: string | null): boolean => {
    seen.add(current)
    path.push(current)

    for (const neighbour of adjacency.get(current) ?? []) {
      if (neighbour === parent) continue
      if (seen.has(neighbour)) return true
      if (walk(neighbour, current)) return true
    }

    path.pop()
    return false
  }

  for (const id of ids) {
    if (seen.has(id)) continue
    if (!walk(id, null)) continue

    // Une boucle passant par un équipement de niveau 3 est un chemin routé.
    const routed = path.some((pid) => {
      const candidate = node(pid)
      return candidate ? item(candidate)?.category === 'routing' : false
    })

    // Un graphe biparti est un tissu leaf-spine : chaque leaf ne parle qu'aux
    // spines, jamais à un autre leaf. C'est une architecture, pas une boucle.
    const colour = new Map<string, number>()
    let bipartite = true
    const start = path[0]!
    colour.set(start, 0)
    const queue = [start]

    while (queue.length && bipartite) {
      const current = queue.shift()!
      for (const neighbour of adjacency.get(current) ?? []) {
        if (!colour.has(neighbour)) {
          colour.set(neighbour, 1 - colour.get(current)!)
          queue.push(neighbour)
        } else if (colour.get(neighbour) === colour.get(current)) {
          bipartite = false
          break
        }
      }
    }

    const fabric = routed || bipartite

    return [{
      rule: fabric ? 'fabric' : 'loop',
      category: 'network',
      severity: fabric ? 'info' : 'warning',
      title: fabric
        ? (routed ? 'Maillage redondant entre équipements de niveau 3' : 'Tissu maillé leaf-spine détecté')
        : 'Boucle de commutation détectée',
      detail: `Chemin fermé : ${path.map(pid => node(pid)?.label ?? pid).join(' → ')}.`,
      fix: fabric
        ? 'Vérifiez que le routage ou l\'EVPN gère bien cette redondance.'
        : 'Activez le spanning-tree, ou supprimez une liaison redondante.',
      nodeIds: [...path], linkIds: []
    }]
  }

  return []
}

const vlanMismatch: Rule = ({ board, node, isSwitching }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const link of board.links) {
    if (findMedium(link.medium)?.family === 'énergie') continue

    const from = node(link.from)
    const to = node(link.to)
    if (!from || !to) continue

    const a = from.config.vlan
    const b = to.config.vlan
    if (!a || !b || a === b) continue
    if (isSwitching(from) && isSwitching(to)) continue

    out.push({
      rule: 'vlan', category: 'network', severity: 'warning',
      title: `VLAN ${a} et ${b} face à face`,
      detail: `${from.label} et ${to.label} ne sont pas dans le même VLAN.`,
      fix: 'Alignez les VLAN, ou ajoutez un routage inter-VLAN.',
      nodeIds: [from.id, to.id], linkIds: [link.id]
    })
  }

  return out
}

const addressing: Rule = ({ board }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  const byIp = new Map<string, BoardNode[]>()
  const byVlan = new Map<number, BoardNode[]>()

  for (const node of board.nodes) {
    const ip = node.config.ip?.trim()
    if (!ip) continue

    if (!isValidIp(ip)) {
      out.push({
        rule: 'ip-format', category: 'network', severity: 'error',
        title: `Adresse invalide sur ${node.label}`,
        detail: `« ${ip} » n'est pas une adresse IPv4.`,
        fix: 'Corrigez l\'adresse dans l\'inspecteur.',
        nodeIds: [node.id], linkIds: []
      })
      continue
    }

    byIp.set(ip, [...(byIp.get(ip) ?? []), node])
    if (node.config.vlan) byVlan.set(node.config.vlan, [...(byVlan.get(node.config.vlan) ?? []), node])
  }

  for (const [ip, nodes] of byIp) {
    if (nodes.length > 1) {
      out.push({
        rule: 'ip-duplicate', category: 'network', severity: 'error',
        title: `Adresse ${ip} attribuée ${nodes.length} fois`,
        detail: nodes.map(node => node.label).join(', '),
        fix: 'Attribuez une adresse unique à chaque équipement.',
        nodeIds: nodes.map(node => node.id), linkIds: []
      })
    }
  }

  // Un même VLAN réparti sur plusieurs réseaux : le routage manquera.
  for (const [vlan, nodes] of byVlan) {
    const subnets = new Set(nodes.map(node => subnet24(node.config.ip)).filter(Boolean) as string[])
    if (subnets.size > 1) {
      out.push({
        rule: 'ip-subnet', category: 'network', severity: 'warning',
        title: `VLAN ${vlan} réparti sur ${subnets.size} réseaux`,
        detail: [...subnets].join(', '),
        fix: 'Un VLAN porte un seul réseau IP, sinon prévoyez du routage.',
        nodeIds: nodes.map(node => node.id), linkIds: []
      })
    }
  }

  return out
}

/**
 * Îlots : un groupe d'équipements sans chemin vers une sortie.
 *
 * Le parcours part des équipements externes, de routage et de sécurité ; tout
 * ce qui n'est pas atteint forme un réseau isolé, souvent un oubli de câblage.
 */
const isolatedIslands: Rule = ({ board, item, isExternal }) => {
  const dataLinks = board.links.filter(link => findMedium(link.medium)?.family !== 'énergie')
  if (!dataLinks.length || board.nodes.length < 3) return []

  const roots = board.nodes.filter(
    node => isExternal(node) || item(node)?.category === 'routing' || item(node)?.category === 'security'
  )
  if (!roots.length) return []

  const adjacency = new Map<string, string[]>()
  for (const link of dataLinks) {
    adjacency.set(link.from, [...(adjacency.get(link.from) ?? []), link.to])
    adjacency.set(link.to, [...(adjacency.get(link.to) ?? []), link.from])
  }

  const reached = new Set<string>()
  const queue = roots.map(node => node.id)
  while (queue.length) {
    const current = queue.shift()!
    if (reached.has(current)) continue
    reached.add(current)
    for (const next of adjacency.get(current) ?? []) if (!reached.has(next)) queue.push(next)
  }

  // Les équipements sans aucun câble sont déjà signalés comme orphelins.
  const stranded = board.nodes.filter(
    node => !reached.has(node.id) && (adjacency.get(node.id)?.length ?? 0) > 0
  )
  if (!stranded.length) return []

  return [{
    rule: 'island', category: 'network', severity: 'warning',
    title: `${stranded.length} équipement(s) sans chemin vers la sortie`,
    detail: stranded.map(node => node.label).join(', '),
    fix: 'Raccordez cet îlot au cœur de réseau ou au routeur.',
    nodeIds: stranded.map(node => node.id), linkIds: []
  }]
}

const uplinkResilience: Rule = ({ board, item, dataLinksOf, other, isSwitching }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const node of board.nodes) {
    if (!isSwitching(node)) continue

    const links = dataLinksOf(node.id)
    if (links.length < 3) continue

    const uplinks = links.filter((link) => {
      const target = other(link, node.id)
      const spec = target ? item(target) : undefined
      return spec?.switching || spec?.category === 'routing' || spec?.category === 'security'
    })

    if (uplinks.length === 1) {
      out.push({
        rule: 'uplink', category: 'network', severity: 'info',
        title: `${node.label} n'a qu'un seul lien montant`,
        detail: `${links.length - 1} équipements dépendent de cette unique liaison.`,
        fix: 'Ajoutez une seconde liaison vers un autre équipement de cœur.',
        nodeIds: [node.id], linkIds: uplinks.map(link => link.id)
      })
      continue
    }

    // Rapport de sur-souscription : débit desservi contre débit montant.
    if (uplinks.length) {
      const access = links
        .filter(link => !uplinks.includes(link))
        .reduce((sum, link) => sum + link.speedGbps, 0)
      const uplink = uplinks.reduce((sum, link) => sum + link.speedGbps, 0)

      if (uplink > 0 && access / uplink > 20) {
        out.push({
          rule: 'oversubscription', category: 'network', severity: 'warning',
          title: `${node.label} : sur-souscription ${Math.round(access / uplink)}:1`,
          detail: `${access} Gb/s desservis pour ${uplink} Gb/s montants.`,
          fix: 'Augmentez le débit montant, ou agrégez plusieurs liens.',
          nodeIds: [node.id], linkIds: uplinks.map(link => link.id)
        })
      }
    }
  }

  return out
}

const coreServices: Rule = ({ board, item }) => {
  const endpoints = board.nodes.filter(node => item(node)?.kind === 'endpoint')
  if (endpoints.length < 3) return []

  const has = (id: string) => board.nodes.some(node => node.type === id)
  const missing: string[] = []
  if (!has('svc-dhcp')) missing.push('DHCP')
  if (!has('svc-dns')) missing.push('DNS')
  if (!has('svc-ntp')) missing.push('NTP')

  if (!missing.length) return []

  return [{
    rule: 'core-services', category: 'network', severity: 'info',
    title: `Service${missing.length > 1 ? 's' : ''} d'infrastructure absent${missing.length > 1 ? 's' : ''} : ${missing.join(', ')}`,
    detail: `${endpoints.length} postes figurent sur le plan.`,
    fix: 'Ajoutez ces services depuis la catégorie « Services réseau ».',
    nodeIds: endpoints.slice(0, 3).map(node => node.id), linkIds: []
  }]
}

/* ------------------------------------------------------ Règles sécurité */

const wanExposure: Rule = ({ board, item, linksOf, other, isExternal }) => {
  const out: Omit<Diagnostic, 'id'>[] = []
  const externals = board.nodes.filter(isExternal)
  if (!externals.length) return out

  const externalIds = new Set(externals.map(node => node.id))

  for (const node of board.nodes) {
    const spec = item(node)
    if (!spec || spec.kind === 'external') continue
    if (spec.category === 'security' || spec.category === 'routing') continue

    const exposed = linksOf(node.id).some((link) => {
      const target = other(link, node.id)
      return target ? externalIds.has(target.id) : false
    })

    if (exposed) {
      out.push({
        rule: 'wan-direct', category: 'security', severity: 'error',
        title: `${node.label} est branché directement sur le WAN`,
        detail: 'Aucun filtrage entre cet équipement et le lien opérateur.',
        fix: 'Intercalez un pare-feu ou un routeur de périphérie.',
        nodeIds: [node.id], linkIds: []
      })
    }
  }

  // Accès opérateur sans le moindre équipement de filtrage sur le plan.
  const hasFirewall = board.nodes.some(node => item(node)?.category === 'security')
  if (!hasFirewall) {
    out.push({
      rule: 'no-firewall', category: 'security', severity: 'error',
      title: 'Aucun pare-feu sur le plan',
      detail: 'Le réseau dispose d\'un accès extérieur sans équipement de filtrage.',
      fix: 'Ajoutez un pare-feu entre le lien opérateur et le réseau interne.',
      nodeIds: externals.map(node => node.id), linkIds: []
    })
  }

  return out
}

const exposedServices: Rule = ({ board, dataLinksOf }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  for (const node of board.nodes) {
    const services = node.config.services ?? []
    if (!services.length) continue

    if (!dataLinksOf(node.id).length) {
      out.push({
        rule: 'open-port', category: 'security', severity: 'error',
        title: `${node.label} expose ${services.length} port(s) sans réseau`,
        detail: services.map(service => `${service.port}/${service.protocol.toUpperCase()}`).join(', '),
        fix: 'Câblez l\'équipement, ou retirez ces services de sa fiche.',
        nodeIds: [node.id], linkIds: []
      })
      continue
    }

    const clear = services.filter(service => PLAINTEXT.has(service.port))
    if (clear.length) {
      out.push({
        rule: 'plaintext', category: 'security', severity: 'warning',
        title: `${node.label} expose un service en clair`,
        detail: clear.map(service => `${service.name} (${service.port})`).join(', '),
        fix: 'Basculez sur la variante chiffrée : SSH, HTTPS, LDAPS, SNMPv3.',
        nodeIds: [node.id], linkIds: []
      })
    }
  }

  return out
}

/* ------------------------------------------------------- Règles énergie */

const powerRules: Rule = ({ board, item, powerLinksOf, dataLinksOf, other }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  const sources = board.nodes.filter(node => item(node)?.category === 'power'
    && effectivePorts(node).some(port => port.connector === 'power'))
  if (!sources.length) return out

  for (const node of board.nodes) {
    const spec = item(node)
    if (!spec?.needsPower) continue

    const links = powerLinksOf(node.id)

    // Un terminal relié à un commutateur PoE est alimenté par son câble réseau.
    const poeFed = spec.kind === 'endpoint' || spec.category === 'wireless'
      ? dataLinksOf(node.id).some(link => item(other(link, node.id) ?? node)?.poe)
      : false

    if (!links.length && poeFed) continue

    if (!links.length) {
      out.push({
        rule: 'power-missing', category: 'power', severity: 'warning',
        title: `${node.label} n'est pas alimenté`,
        detail: 'Aucun cordon secteur relié à cet équipement.',
        fix: 'Reliez sa prise d\'alimentation à un PDU ou un onduleur.',
        nodeIds: [node.id], linkIds: []
      })
      continue
    }

    const inlets = portSlots(node)
      .filter(slot => slot.family === 'power')
      .reduce((total, slot) => total + slot.count, 0)

    if (inlets > 1 && links.length < inlets) {
      out.push({
        rule: 'psu-partial', category: 'power', severity: 'info',
        title: `${node.label} : ${links.length}/${inlets} alimentation(s) branchée(s)`,
        detail: 'La redondance d\'alimentation n\'est pas complète.',
        fix: 'Branchez la seconde alimentation sur une autre source.',
        nodeIds: [node.id], linkIds: []
      })
    }

    // Deux cordons sur la même source : pas de voie A/B.
    if (links.length > 1) {
      const feeds = new Set(links.map(link => other(link, node.id)?.id).filter(Boolean))
      if (feeds.size === 1) {
        out.push({
          rule: 'psu-same-feed', category: 'power', severity: 'warning',
          title: `${node.label} : les deux alimentations sur la même source`,
          detail: 'Une panne de cette source coupe l\'équipement malgré sa redondance.',
          fix: 'Répartissez les cordons sur deux PDU ou deux onduleurs distincts.',
          nodeIds: [node.id], linkIds: links.map(link => link.id)
        })
      }
    }
  }

  // Distribution électrique sans source secourue.
  const hasUps = board.nodes.some(node => node.type === 'pwr-ups' || node.type === 'pwr-genset')
  if (!hasUps) {
    out.push({
      rule: 'no-ups', category: 'power', severity: 'info',
      title: 'Aucune source secourue',
      detail: 'Le plan comporte une distribution électrique sans onduleur.',
      fix: 'Ajoutez un onduleur en amont des PDU.',
      nodeIds: sources.map(node => node.id), linkIds: []
    })
  }

  return out
}

/* -------------------------------------------------- Règles exploitation */

const operations: Rule = ({ board, item }) => {
  const out: Omit<Diagnostic, 'id'>[] = []

  // Étiquettes en double : ambiguïté à l'astreinte.
  const byLabel = new Map<string, BoardNode[]>()
  for (const node of board.nodes) {
    const key = node.label.trim().toLowerCase()
    if (key) byLabel.set(key, [...(byLabel.get(key) ?? []), node])
  }

  for (const nodes of byLabel.values()) {
    if (nodes.length > 1) {
      out.push({
        rule: 'label-duplicate', category: 'ops', severity: 'info',
        title: `${nodes.length} équipements nommés « ${nodes[0]!.label} »`,
        detail: 'Des noms identiques compliquent la supervision et l\'astreinte.',
        fix: 'Numérotez-les, par exemple SRV-01 et SRV-02.',
        nodeIds: nodes.map(node => node.id), linkIds: []
      })
    }
  }

  // Deux équipements à la même position en baie.
  const byRack = new Map<string, BoardNode[]>()
  for (const node of board.nodes) {
    const unit = node.config.rackUnit?.trim().toUpperCase()
    if (unit) byRack.set(unit, [...(byRack.get(unit) ?? []), node])
  }

  for (const [unit, nodes] of byRack) {
    if (nodes.length > 1) {
      out.push({
        rule: 'rack-collision', category: 'ops', severity: 'error',
        title: `Position ${unit} occupée par ${nodes.length} équipements`,
        detail: nodes.map(node => node.label).join(', '),
        fix: 'Corrigez la position en baie de l\'un d\'eux.',
        nodeIds: nodes.map(node => node.id), linkIds: []
      })
    }
  }

  // Supervision absente sur un plan déjà conséquent.
  const monitored = board.nodes.some(node => item(node)?.category === 'monitoring')
  if (!monitored && board.nodes.length >= 8) {
    out.push({
      rule: 'no-monitoring', category: 'ops', severity: 'info',
      title: 'Aucune supervision sur le plan',
      detail: `${board.nodes.length} équipements sans collecteur de métriques ni de journaux.`,
      fix: 'Ajoutez un collecteur depuis la catégorie « Supervision ».',
      nodeIds: [], linkIds: []
    })
  }

  return out
}

/* ------------------------------------------------------------ Moteur */

const RULES: Rule[] = [
  mediumMismatch,
  speedLimits,
  cableLength,
  portOverflow,
  endpointToEndpoint,
  duplicateLinks,
  orphanNodes,
  switchingLoop,
  vlanMismatch,
  addressing,
  isolatedIslands,
  uplinkResilience,
  coreServices,
  wanExposure,
  exposedServices,
  powerRules,
  operations
]

export interface DiagnosticReport {
  diagnostics: Diagnostic[]
  errors: number
  warnings: number
  infos: number
  /** Répartition par domaine, pour le tableau de bord du contrôleur. */
  byCategory: Record<DiagCategory, number>
  /** Note de santé du plan, de 0 à 100. */
  score: number
}

export function analyseBoard(board: Board): DiagnosticReport {
  const linkIndex = new Map<string, BoardLink[]>()
  for (const link of board.links) {
    linkIndex.set(link.from, [...(linkIndex.get(link.from) ?? []), link])
    linkIndex.set(link.to, [...(linkIndex.get(link.to) ?? []), link])
  }

  const nodeIndex = new Map(board.nodes.map(node => [node.id, node]))
  const itemOf = (node: BoardNode) => findCatalogItem(node.type)
  const linksOf = (nodeId: string) => linkIndex.get(nodeId) ?? []
  const familyOf = (link: BoardLink) => findMedium(link.medium)?.family

  const ctx: Context = {
    board,
    item: itemOf,
    node: id => nodeIndex.get(id),
    linksOf,
    dataLinksOf: nodeId => linksOf(nodeId)
      .filter(link => familyOf(link) !== 'énergie' && familyOf(link) !== 'console'),
    powerLinksOf: nodeId => linksOf(nodeId).filter(link => familyOf(link) === 'énergie'),
    other: (link, nodeId) => nodeIndex.get(link.from === nodeId ? link.to : link.from),
    isSwitching: node => Boolean(itemOf(node)?.switching),
    isExternal: node => itemOf(node)?.kind === 'external'
  }

  const collected: Omit<Diagnostic, 'id'>[] = []
  for (const rule of RULES) {
    try {
      collected.push(...rule(ctx))
    } catch {
      // Une règle en défaut ne doit pas emporter tout le rapport.
    }
  }

  // Tri par gravité puis par domaine : l'essentiel d'abord.
  const weight: Record<Severity, number> = { error: 0, warning: 1, info: 2 }
  collected.sort((a, b) => weight[a.severity] - weight[b.severity] || a.category.localeCompare(b.category))

  const diagnostics: Diagnostic[] = collected.map((item, index) => ({
    ...item,
    id: `${item.rule}-${index}`
  }))

  const errors = diagnostics.filter(item => item.severity === 'error').length
  const warnings = diagnostics.filter(item => item.severity === 'warning').length
  const infos = diagnostics.filter(item => item.severity === 'info').length

  const byCategory = { cabling: 0, network: 0, security: 0, power: 0, ops: 0 } as Record<DiagCategory, number>
  for (const item of diagnostics) byCategory[item.category] += 1

  // Les remarques pèsent peu : elles guident sans dégrader la note.
  const penalty = errors * 10 + warnings * 4 + infos * 0.5
  const score = board.nodes.length ? Math.max(0, Math.round(100 - penalty)) : 100

  return { diagnostics, errors, warnings, infos, byCategory, score }
}
