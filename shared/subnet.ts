/**
 * Arithmétique IPv4 de TanchiSubNet.
 *
 * Tout est calculé sur des entiers 32 bits non signés — d'où les `>>> 0`
 * systématiques, JavaScript traitant les opérateurs binaires en signé.
 */

export interface Cidr {
  /** Adresse réseau, en entier 32 bits. */
  address: number
  prefix: number
}

export interface SubnetInfo {
  cidr: string
  address: string
  prefix: number
  mask: string
  wildcard: string
  network: string
  broadcast: string
  firstHost: string | null
  lastHost: string | null
  /** Adresses attribuables à des machines. */
  usableHosts: number
  totalAddresses: number
  /** Classe historique, encore utilisée dans les documents d'architecture. */
  class: string
  scope: 'privée' | 'publique' | 'loopback' | 'lien-local' | 'multicast' | 'réservée'
  binary: string
  /** Découpage possible en sous-réseaux, pour le dimensionnement. */
  parent: string | null
}

/* ------------------------------------------------------------ Parsing */

export function parseIp(value: string): number | null {
  const parts = value.trim().split('.')
  if (parts.length !== 4) return null

  let result = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    result = (result << 8) | octet
  }

  return result >>> 0
}

export function formatIp(value: number): string {
  const n = value >>> 0
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

/** Accepte `10.0.0.0/24`, `10.0.0.0 255.255.255.0` ou une adresse seule. */
export function parseCidr(value: string): Cidr | null {
  const input = value.trim()
  if (!input) return null

  const [head, tail] = input.split(/[/\s]+/)
  const address = parseIp(head ?? '')
  if (address === null) return null

  if (tail === undefined) return { address, prefix: 32 }

  // Notation décimale pointée : 255.255.255.0
  if (tail.includes('.')) {
    const mask = parseIp(tail)
    if (mask === null) return null
    const prefix = prefixFromMask(mask)
    return prefix === null ? null : { address, prefix }
  }

  if (!/^\d{1,2}$/.test(tail)) return null
  const prefix = Number(tail)
  if (prefix > 32) return null

  return { address, prefix }
}

/** Un masque valide n'a que des 1 contigus à gauche. */
export function prefixFromMask(mask: number): number | null {
  const value = mask >>> 0
  const inverted = ~value >>> 0

  // Un masque correct devient, une fois inversé, une puissance de deux moins un.
  if (((inverted + 1) & inverted) !== 0) return null

  let prefix = 0
  for (let bit = 31; bit >= 0; bit--) {
    if ((value >>> bit) & 1) prefix++
    else break
  }

  return prefix
}

export function maskFor(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

export function networkOf(address: number, prefix: number): number {
  return (address & maskFor(prefix)) >>> 0
}

export function broadcastOf(address: number, prefix: number): number {
  return (networkOf(address, prefix) | (~maskFor(prefix) >>> 0)) >>> 0
}

export function cidrToString(cidr: Cidr): string {
  return `${formatIp(networkOf(cidr.address, cidr.prefix))}/${cidr.prefix}`
}

/* --------------------------------------------------------- Description */

const SCOPES: { test: (n: number) => boolean, scope: SubnetInfo['scope'] }[] = [
  { test: n => n >>> 24 === 10, scope: 'privée' },
  { test: n => (n >>> 20) === 0xac1, scope: 'privée' },
  { test: n => (n >>> 16) === 0xc0a8, scope: 'privée' },
  { test: n => n >>> 24 === 127, scope: 'loopback' },
  { test: n => (n >>> 16) === 0xa9fe, scope: 'lien-local' },
  { test: n => n >>> 28 === 0xe, scope: 'multicast' },
  { test: n => n >>> 28 === 0xf, scope: 'réservée' }
]

function scopeOf(address: number): SubnetInfo['scope'] {
  return SCOPES.find(entry => entry.test(address >>> 0))?.scope ?? 'publique'
}

function classOf(address: number): string {
  const first = address >>> 24
  if (first < 128) return 'A'
  if (first < 192) return 'B'
  if (first < 224) return 'C'
  if (first < 240) return 'D (multicast)'
  return 'E (réservée)'
}

function toBinary(address: number, prefix: number): string {
  const bits = (address >>> 0).toString(2).padStart(32, '0')
  const octets = bits.match(/.{8}/g) ?? []
  const joined = octets.join('.')

  // Marque visuelle de la frontière réseau / hôte.
  const cut = prefix + Math.floor(prefix / 8) - (prefix % 8 === 0 && prefix > 0 ? 1 : 0)
  return `${joined.slice(0, cut)}|${joined.slice(cut)}`
}

/** Nombre d'adresses attribuables, en tenant compte des cas /31 et /32. */
export function usableHosts(prefix: number): number {
  if (prefix >= 32) return 1
  if (prefix === 31) return 2
  return Math.pow(2, 32 - prefix) - 2
}

export function totalAddresses(prefix: number): number {
  return Math.pow(2, 32 - prefix)
}

export function describe(input: string | Cidr): SubnetInfo | null {
  const cidr = typeof input === 'string' ? parseCidr(input) : input
  if (!cidr) return null

  const { address, prefix } = cidr
  const network = networkOf(address, prefix)
  const broadcast = broadcastOf(address, prefix)
  const mask = maskFor(prefix)

  // /31 : liaison point à point, les deux adresses sont utilisables (RFC 3021).
  // /32 : hôte unique.
  const hasHostRange = prefix <= 30
  const firstHost = prefix === 32 ? network : prefix === 31 ? network : network + 1
  const lastHost = prefix === 32 ? network : prefix === 31 ? broadcast : broadcast - 1

  return {
    cidr: `${formatIp(network)}/${prefix}`,
    address: formatIp(address),
    prefix,
    mask: formatIp(mask),
    wildcard: formatIp(~mask >>> 0),
    network: formatIp(network),
    broadcast: hasHostRange ? formatIp(broadcast) : '—',
    firstHost: formatIp(firstHost),
    lastHost: formatIp(lastHost),
    usableHosts: usableHosts(prefix),
    totalAddresses: totalAddresses(prefix),
    class: classOf(network),
    scope: scopeOf(network),
    binary: toBinary(network, prefix),
    parent: prefix > 0 ? `${formatIp(networkOf(network, prefix - 1))}/${prefix - 1}` : null
  }
}

/* ------------------------------------------------------- Dimensionnement */

/** Préfixe le plus court capable d'accueillir ce nombre de machines. */
export function prefixForHosts(hosts: number): number {
  if (hosts <= 0) return 32
  if (hosts === 1) return 32
  if (hosts === 2) return 31

  for (let prefix = 30; prefix >= 0; prefix--) {
    if (usableHosts(prefix) >= hosts) return prefix
  }
  return 0
}

export interface SplitResult {
  subnets: Cidr[]
  /** Vrai si le découpage a été tronqué pour ne pas produire trop de lignes. */
  truncated: boolean
  total: number
}

/** Découpe un bloc en sous-réseaux réguliers du préfixe demandé. */
export function split(parent: Cidr, newPrefix: number, limit = 512): SplitResult {
  if (newPrefix < parent.prefix || newPrefix > 32) {
    return { subnets: [], truncated: false, total: 0 }
  }

  const total = Math.pow(2, newPrefix - parent.prefix)
  const step = totalAddresses(newPrefix)
  const base = networkOf(parent.address, parent.prefix)

  const subnets: Cidr[] = []
  for (let index = 0; index < Math.min(total, limit); index++) {
    subnets.push({ address: (base + index * step) >>> 0, prefix: newPrefix })
  }

  return { subnets, truncated: total > limit, total }
}

export interface VlsmRequest {
  name: string
  hosts: number
}

export interface VlsmAllocation {
  name: string
  hosts: number
  cidr: string
  network: string
  mask: string
  firstHost: string
  lastHost: string
  broadcast: string
  usableHosts: number
  /** Adresses perdues par l'arrondi à la puissance de deux supérieure. */
  waste: number
}

export interface VlsmResult {
  allocations: VlsmAllocation[]
  /** Demandes qui n'entrent pas dans le bloc parent. */
  rejected: { name: string, hosts: number, reason: string }[]
  /** Blocs restants, exprimés au plus court. */
  free: string[]
  usedAddresses: number
  totalAddresses: number
}

/**
 * Attribution VLSM.
 *
 * Les demandes sont servies de la plus grande à la plus petite : c'est ce qui
 * limite la fragmentation et laisse les blocs libres alignés.
 */
export function allocateVlsm(parent: Cidr, requests: VlsmRequest[]): VlsmResult {
  const base = networkOf(parent.address, parent.prefix)
  const end = broadcastOf(parent.address, parent.prefix)

  const sorted = [...requests]
    .map((request, index) => ({ ...request, index }))
    .filter(request => request.hosts > 0)
    .sort((a, b) => b.hosts - a.hosts || a.index - b.index)

  const allocations: VlsmAllocation[] = []
  const rejected: VlsmResult['rejected'] = []
  let cursor = base

  for (const request of sorted) {
    const prefix = prefixForHosts(request.hosts)

    if (prefix < parent.prefix) {
      rejected.push({
        name: request.name,
        hosts: request.hosts,
        reason: `Nécessite un /${prefix}, plus large que le bloc parent /${parent.prefix}.`
      })
      continue
    }

    const size = totalAddresses(prefix)
    // Un sous-réseau démarre toujours sur une frontière alignée sur sa taille.
    const aligned = (Math.ceil(cursor / size) * size) >>> 0

    if (aligned + size - 1 > end) {
      rejected.push({
        name: request.name,
        hosts: request.hosts,
        reason: 'Plus assez de place dans le bloc parent.'
      })
      continue
    }

    const info = describe({ address: aligned, prefix })!
    allocations.push({
      name: request.name,
      hosts: request.hosts,
      cidr: info.cidr,
      network: info.network,
      mask: info.mask,
      firstHost: info.firstHost ?? '—',
      lastHost: info.lastHost ?? '—',
      broadcast: info.broadcast,
      usableHosts: info.usableHosts,
      waste: info.usableHosts - request.hosts
    })

    cursor = (aligned + size) >>> 0
  }

  // Restitution des blocs libres, découpés au plus large possible.
  const free: string[] = []
  let position = cursor
  while (position <= end) {
    let prefix = 32
    for (let candidate = 0; candidate <= 32; candidate++) {
      const size = totalAddresses(candidate)
      if (position % size === 0 && position + size - 1 <= end) {
        prefix = candidate
        break
      }
    }

    free.push(`${formatIp(position)}/${prefix}`)
    position = (position + totalAddresses(prefix)) >>> 0
    if (free.length > 32) break
  }

  return {
    allocations: allocations.sort((a, b) => parseIp(a.network)! - parseIp(b.network)!),
    rejected,
    free,
    usedAddresses: (cursor - base) >>> 0,
    totalAddresses: totalAddresses(parent.prefix)
  }
}

/* ------------------------------------------------------- Chevauchements */

export function overlaps(a: Cidr, b: Cidr): boolean {
  const startA = networkOf(a.address, a.prefix)
  const endA = broadcastOf(a.address, a.prefix)
  const startB = networkOf(b.address, b.prefix)
  const endB = broadcastOf(b.address, b.prefix)
  return startA <= endB && startB <= endA
}

export function contains(parent: Cidr, child: Cidr): boolean {
  return networkOf(child.address, parent.prefix) === networkOf(parent.address, parent.prefix)
    && child.prefix >= parent.prefix
}

/** Plus petit bloc englobant une liste d'adresses ou de réseaux. */
export function summarize(cidrs: Cidr[]): Cidr | null {
  if (!cidrs.length) return null

  let low = networkOf(cidrs[0]!.address, cidrs[0]!.prefix)
  let high = broadcastOf(cidrs[0]!.address, cidrs[0]!.prefix)

  for (const cidr of cidrs.slice(1)) {
    low = Math.min(low, networkOf(cidr.address, cidr.prefix))
    high = Math.max(high, broadcastOf(cidr.address, cidr.prefix))
  }

  for (let prefix = 32; prefix >= 0; prefix--) {
    if (networkOf(low, prefix) === networkOf(high, prefix)) {
      return { address: networkOf(low, prefix), prefix }
    }
  }

  return { address: 0, prefix: 0 }
}

/** Une adresse appartient-elle au réseau ? */
export function includesAddress(cidr: Cidr, address: number): boolean {
  return networkOf(address, cidr.prefix) === networkOf(cidr.address, cidr.prefix)
}

/* --------------------------------------------------------- Plan sauvegardé */

export interface SubnetEntry {
  id: string
  name: string
  cidr: string
  vlan?: number
  notes?: string
}

export interface SubnetPlan {
  entries: SubnetEntry[]
  /** Bloc parent du plan, pour le contrôle de cohérence. */
  supernet?: string
}

export function normalizePlan(raw: unknown): SubnetPlan {
  const plan = (raw ?? {}) as Partial<SubnetPlan>

  const entries = (Array.isArray(plan.entries) ? plan.entries : [])
    .map((entry, index) => {
      const item = (entry ?? {}) as Partial<SubnetEntry>
      const cidr = parseCidr(String(item.cidr ?? ''))
      if (!cidr) return null

      return {
        id: String(item.id || `s${index}`),
        name: String(item.name ?? '').slice(0, 60),
        cidr: cidrToString(cidr),
        vlan: Number(item.vlan) > 0 ? Number(item.vlan) : undefined,
        notes: item.notes ? String(item.notes).slice(0, 200) : undefined
      }
    })
    .filter((entry): entry is SubnetEntry => entry !== null)

  const supernet = plan.supernet && parseCidr(String(plan.supernet))
    ? cidrToString(parseCidr(String(plan.supernet))!)
    : undefined

  return { entries, supernet }
}

/** Chevauchements au sein d'un plan : la faute la plus coûteuse à débusquer. */
export function findConflicts(entries: SubnetEntry[]): { a: SubnetEntry, b: SubnetEntry }[] {
  const conflicts: { a: SubnetEntry, b: SubnetEntry }[] = []

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = parseCidr(entries[i]!.cidr)
      const b = parseCidr(entries[j]!.cidr)
      if (a && b && overlaps(a, b)) conflicts.push({ a: entries[i]!, b: entries[j]! })
    }
  }

  return conflicts
}
