/**
 * Analyse d'adresses MAC.
 *
 * Tout ce qui se déduit des octets eux-mêmes se calcule ici, sans réseau ni
 * base de données : nature de l'adresse, portée, correspondances multicast,
 * dérivation EUI-64. Seul le nom du constructeur demande le registre IEEE,
 * qui vit côté serveur car il pèse un méga-octet et demi.
 */

export type MacFormat = 'colon' | 'hyphen' | 'dot' | 'bare' | 'space'
export type MacCase = 'upper' | 'lower'

export interface MacFormatDefinition {
  id: MacFormat
  label: string
  /** Exemple affiché dans le sélecteur. */
  sample: string
  hint: string
}

export const MAC_FORMATS: MacFormatDefinition[] = [
  { id: 'colon', label: 'Deux-points', sample: '00:1b:44:11:3a:b7', hint: 'Linux, IEEE, la plupart des outils' },
  { id: 'hyphen', label: 'Tirets', sample: '00-1B-44-11-3A-B7', hint: 'Windows, ipconfig' },
  { id: 'dot', label: 'Points', sample: '001b.4411.3ab7', hint: 'Cisco IOS' },
  { id: 'bare', label: 'Compact', sample: '001b44113ab7', hint: 'Fichiers, scripts, filtres' },
  { id: 'space', label: 'Espaces', sample: '00 1b 44 11 3a b7', hint: 'Analyseurs de trames' }
]

export type MacCast = 'unicast' | 'multicast' | 'broadcast'
export type MacAdmin = 'universelle' | 'locale'

export interface MacDerived {
  label: string
  value: string
  hint?: string
}

export interface MacAnalysis {
  /** Texte tel qu'il a été trouvé dans la saisie. */
  input: string
  /** Ligne de la saisie, pour situer une erreur. */
  line: number
  valid: boolean
  error?: string

  /** Hexadécimal majuscule sans séparateur. */
  normalized: string
  bytes: number[]
  bits: 48 | 64

  cast: MacCast
  administration: MacAdmin
  /** Préfixes candidats pour le registre, du plus long au plus court. */
  prefixes: string[]
  oui: string
  nic: string

  /** Adresse reconnue comme réservée à un usage précis. */
  special: { label: string, detail: string } | null
  /** Environnement virtuel déduit du préfixe. */
  virtual: string | null
  derived: MacDerived[]
}

/* ------------------------------------------------------------- Formatage */

const HEX = /^[0-9A-Fa-f]+$/

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase()
}

/** Rend une adresse dans le format demandé. */
export function formatMac(bytes: number[], format: MacFormat, casing: MacCase = 'lower'): string {
  const parts = bytes.map(toHex)

  let out: string
  switch (format) {
    case 'hyphen': out = parts.join('-'); break
    case 'space': out = parts.join(' '); break
    case 'bare': out = parts.join(''); break
    case 'dot': {
      const flat = parts.join('')
      out = (flat.match(/.{1,4}/g) ?? []).join('.')
      break
    }
    default: out = parts.join(':')
  }

  return casing === 'upper' ? out.toUpperCase() : out.toLowerCase()
}

/* --------------------------------------------------------------- Lecture */

/** Convertit un jeton en octets, ou explique pourquoi il n'en est pas un. */
export function parseMac(token: string): { bytes: number[] } | { error: string } {
  const trimmed = token.trim().replace(/[,;.]+$/, '')
  if (!trimmed) return { error: 'Entrée vide.' }

  // Forme Cisco : trois groupes de quatre chiffres.
  if (/^[0-9A-Fa-f]{4}(\.[0-9A-Fa-f]{4}){2,3}$/.test(trimmed)) {
    return bytesFromHex(trimmed.replace(/\./g, ''))
  }

  const separators = trimmed.match(/[:\-\s.]/g) ?? []
  const kinds = new Set(separators)

  if (kinds.size > 1) {
    return { error: 'Séparateurs mélangés dans la même adresse.' }
  }

  if (separators.length === 0) return bytesFromHex(trimmed)

  const groups = trimmed.split(/[:\-\s.]/).filter(Boolean)

  // Certains outils écrivent 0:1b:44:... en omettant le zéro de tête.
  if (groups.every(group => group.length >= 1 && group.length <= 2 && HEX.test(group))) {
    return bytesFromHex(groups.map(group => group.padStart(2, '0')).join(''))
  }

  if (!groups.every(group => HEX.test(group))) {
    return { error: 'Caractère non hexadécimal.' }
  }

  return bytesFromHex(groups.join(''))
}

function bytesFromHex(hex: string): { bytes: number[] } | { error: string } {
  if (!HEX.test(hex)) return { error: 'Caractère non hexadécimal.' }

  if (hex.length !== 12 && hex.length !== 16) {
    const octets = hex.length / 2
    return {
      error: Number.isInteger(octets)
        ? `${octets} octet(s) : il en faut 6 (MAC-48) ou 8 (EUI-64).`
        : 'Nombre impair de chiffres hexadécimaux.'
    }
  }

  const bytes = (hex.match(/.{2}/g) ?? []).map(pair => parseInt(pair, 16))
  return { bytes }
}

/* ------------------------------------------------------- Cas particuliers */

interface SpecialRule {
  /** Préfixe hexadécimal majuscule ; l'adresse entière si elle est unique. */
  prefix: string
  label: string
  detail: string
}

const SPECIALS: SpecialRule[] = [
  { prefix: 'FFFFFFFFFFFF', label: 'Diffusion générale', detail: 'Destinée à toutes les stations du domaine de diffusion.' },
  { prefix: '0180C2000000', label: 'Spanning Tree (BPDU)', detail: 'Trames de topologie 802.1D échangées entre commutateurs.' },
  { prefix: '0180C2000001', label: 'Contrôle de flux 802.3x', detail: 'Trame PAUSE, demande de suspension d\'émission.' },
  { prefix: '0180C2000002', label: 'Protocole à lien lent (LACP)', detail: 'Agrégation de liens et OAM 802.3ah.' },
  { prefix: '0180C2000003', label: 'Authentification 802.1X', detail: 'Trames EAPOL du contrôle d\'accès au port.' },
  { prefix: '0180C2000008', label: 'Spanning Tree (ponts fournisseur)', detail: 'BPDU des ponts de réseau d\'opérateur.' },
  { prefix: '0180C200000E', label: 'LLDP', detail: 'Annonce de voisinage 802.1AB.' },
  { prefix: '0180C2000021', label: 'GVRP / MVRP', detail: 'Enregistrement dynamique de VLAN.' },
  { prefix: '011B19000000', label: 'PTP (IEEE 1588)', detail: 'Synchronisation d\'horloge de précision.' },
  { prefix: '01000CCCCCCC', label: 'CDP / VTP / DTP / UDLD', detail: 'Protocoles propriétaires Cisco de découverte et de VLAN.' },
  { prefix: '01000CCCCCCD', label: 'PVST+', detail: 'Spanning Tree par VLAN, variante Cisco.' },
  { prefix: '01005E', label: 'Multicast IPv4', detail: 'Correspondance d\'un groupe IPv4 sur Ethernet.' },
  { prefix: '3333', label: 'Multicast IPv6', detail: 'Correspondance d\'un groupe IPv6 sur Ethernet.' },
  { prefix: '00005E0001', label: 'VRRP', detail: 'Adresse virtuelle d\'un routeur redondant.' },
  { prefix: '00005E0002', label: 'VRRP IPv6', detail: 'Adresse virtuelle VRRPv3 pour IPv6.' },
  { prefix: '00000C07AC', label: 'HSRP v1', detail: 'Adresse virtuelle de passerelle redondante Cisco.' },
  { prefix: '00000C9F', label: 'HSRP v2 IPv4', detail: 'Adresse virtuelle HSRP version 2.' },
  { prefix: '0005730A', label: 'HSRP v2 IPv6', detail: 'Adresse virtuelle HSRP version 2 pour IPv6.' }
]

/** Préfixes trahissant une machine virtuelle plutôt qu'un matériel. */
const VIRTUAL: { prefix: string, label: string }[] = [
  { prefix: '000569', label: 'VMware (ESX historique)' },
  { prefix: '000C29', label: 'VMware Workstation / ESXi' },
  { prefix: '001C14', label: 'VMware' },
  { prefix: '005056', label: 'VMware (attribution vCenter)' },
  { prefix: '080027', label: 'VirtualBox' },
  { prefix: '0A0027', label: 'VirtualBox (interface hôte)' },
  { prefix: '00155D', label: 'Hyper-V' },
  { prefix: '0003FF', label: 'Microsoft Virtual PC / Hyper-V historique' },
  { prefix: '00163E', label: 'Xen' },
  { prefix: '001C42', label: 'Parallels' },
  { prefix: '525400', label: 'QEMU / KVM' },
  { prefix: '0242', label: 'Docker (interface de conteneur)' },
  { prefix: '0242AC', label: 'Docker (réseau ponté)' }
]

/* --------------------------------------------------------------- Analyse */

function ipv4FromMulticast(bytes: number[]): MacDerived {
  // Seuls 23 bits sont transportés : 32 groupes partagent la même adresse MAC.
  const value = `224.${bytes[3]! & 0x7f}.${bytes[4]}.${bytes[5]}`
  return {
    label: 'Groupe IPv4 correspondant',
    value,
    hint: '23 bits seulement sont recopiés : 31 autres groupes partagent cette adresse.'
  }
}

/** Rend un groupe de 16 bits sans ses zéros de tête, comme l'exige IPv6. */
function group16(high: number, low: number): string {
  return ((high << 8) | low).toString(16)
}

function ipv6FromMulticast(bytes: number[]): MacDerived {
  if (bytes[2] === 0xff) {
    return {
      label: 'Groupe IPv6 correspondant',
      value: `ff02::1:ff${toHex(bytes[3]!).toLowerCase()}:${group16(bytes[4]!, bytes[5]!).padStart(4, '0')}`,
      hint: 'Multicast sollicité, employé par la découverte de voisins.'
    }
  }

  const high = group16(bytes[2]!, bytes[3]!)
  const low = group16(bytes[4]!, bytes[5]!)

  // Un groupe nul se fond dans la compression « :: ».
  const tail = high === '0' ? low : `${high}:${low}`

  return {
    label: 'Groupe IPv6 correspondant',
    value: `ff02::${tail}`,
    hint: 'Les 32 derniers bits du groupe sont recopiés tels quels.'
  }
}

/** Forme EUI-64 et identifiant d'interface IPv6 dérivés d'une MAC-48. */
function eui64(bytes: number[]): MacDerived[] {
  const expanded = [bytes[0]!, bytes[1]!, bytes[2]!, 0xff, 0xfe, bytes[3]!, bytes[4]!, bytes[5]!]
  const modified = [...expanded]
  modified[0] = modified[0]! ^ 0x02

  // Chaque groupe de 16 bits perd ses zéros de tête, pas seulement le premier.
  const identifier = [
    group16(modified[0]!, modified[1]!),
    group16(modified[2]!, modified[3]!),
    group16(modified[4]!, modified[5]!),
    group16(modified[6]!, modified[7]!)
  ].join(':')

  return [
    { label: 'EUI-64', value: formatMac(expanded, 'colon', 'lower') },
    {
      label: 'Adresse lien-local IPv6',
      value: `fe80::${identifier}`,
      hint: 'Identifiant d\'interface EUI-64 modifié : le bit U/L est inversé.'
    }
  ]
}

export function analyseMac(input: string, line = 1): MacAnalysis {
  const parsed = parseMac(input)

  const base: MacAnalysis = {
    input: input.trim(),
    line,
    valid: false,
    normalized: '',
    bytes: [],
    bits: 48,
    cast: 'unicast',
    administration: 'universelle',
    prefixes: [],
    oui: '',
    nic: '',
    special: null,
    virtual: null,
    derived: []
  }

  if ('error' in parsed) return { ...base, error: parsed.error }

  const { bytes } = parsed
  const normalized = bytes.map(toHex).join('')
  const first = bytes[0]!

  const cast: MacCast = normalized === 'FFFFFFFFFFFF'
    ? 'broadcast'
    : (first & 0x01) === 1 ? 'multicast' : 'unicast'

  const administration: MacAdmin = (first & 0x02) === 2 ? 'locale' : 'universelle'

  const special = SPECIALS.find(rule => normalized.startsWith(rule.prefix)) ?? null
  const virtual = VIRTUAL.find(rule => normalized.startsWith(rule.prefix))?.label ?? null

  const derived: MacDerived[] = []
  if (normalized.startsWith('01005E') && (bytes[3]! & 0x80) === 0) derived.push(ipv4FromMulticast(bytes))
  if (normalized.startsWith('3333')) derived.push(ipv6FromMulticast(bytes))

  if (bytes.length === 6 && cast === 'unicast') derived.push(...eui64(bytes))

  if (bytes.length === 8 && bytes[3] === 0xff && bytes[4] === 0xfe) {
    derived.push({
      label: 'MAC-48 d\'origine',
      value: formatMac([bytes[0]!, bytes[1]!, bytes[2]!, bytes[5]!, bytes[6]!, bytes[7]!], 'colon', 'lower'),
      hint: 'Le bourrage FF:FE indique une EUI-64 construite depuis une MAC-48.'
    })
  }

  if (special?.prefix === '00005E0001' || special?.prefix === '00005E0002') {
    derived.push({ label: 'Identifiant de routeur virtuel', value: String(bytes[5]) })
  }

  if (special?.prefix === '00000C07AC') {
    derived.push({ label: 'Groupe HSRP', value: String(bytes[5]) })
  }

  // Les préfixes vont du plus long au plus court : MA-S et IAB priment sur
  // MA-M, qui prime sur MA-L. Sinon un bloc délégué serait attribué à l'IEEE.
  const prefixes = [normalized.slice(0, 9), normalized.slice(0, 7), normalized.slice(0, 6)]

  return {
    ...base,
    valid: true,
    normalized,
    bytes,
    bits: bytes.length === 8 ? 64 : 48,
    cast,
    administration,
    prefixes,
    oui: normalized.slice(0, 6),
    nic: normalized.slice(6),
    special: special ? { label: special.label, detail: special.detail } : null,
    virtual,
    derived
  }
}

/* -------------------------------------------------- Extraction d'un texte */

/** Formes reconnues dans un texte libre, de la plus longue à la plus courte. */
const PATTERNS = [
  /\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){7}\b/g,
  /\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b/g,
  /\b[0-9A-Fa-f]{4}(?:\.[0-9A-Fa-f]{4}){3}\b/g,
  /\b[0-9A-Fa-f]{4}(?:\.[0-9A-Fa-f]{4}){2}\b/g,
  /\b[0-9A-Fa-f]{16}\b/g,
  /\b[0-9A-Fa-f]{12}\b/g
]

/** Vrai si la ligne ne contient que des caractères d'adresse. */
const ONLY_MAC_CHARS = /^[0-9A-Fa-f:.\-\s]+$/

/**
 * Extrait les adresses d'une saisie libre.
 *
 * Une ligne qui ne contient que des caractères d'adresse est découpée en
 * jetons et chacun est analysé — y compris s'il est invalide, pour que
 * l'erreur soit signalée plutôt que la ligne ignorée. Les autres lignes,
 * typiquement une sortie de commande, sont ratissées par motif.
 */
export function extractMacs(text: string): MacAnalysis[] {
  const results: MacAnalysis[] = []

  text.split('\n').forEach((raw, position) => {
    const line = position + 1
    const trimmed = raw.trim()
    if (!trimmed) return

    if (ONLY_MAC_CHARS.test(trimmed)) {
      const tokens = trimmed.split(/\s+/).filter(Boolean)

      // Forme « aa bb cc dd ee ff » : les octets sont séparés par des espaces.
      if ((tokens.length === 6 || tokens.length === 8) && tokens.every(token => /^[0-9A-Fa-f]{2}$/.test(token))) {
        results.push(analyseMac(tokens.join(':'), line))
        return
      }

      tokens.forEach(token => results.push(analyseMac(token, line)))
      return
    }

    // Ligne de journal ou sortie de commande : on ratisse par motif.
    const found = new Set<string>()
    for (const pattern of PATTERNS) {
      for (const match of trimmed.matchAll(pattern)) {
        const value = match[0]!
        // Un motif plus long a pu déjà couvrir cette portion du texte.
        if ([...found].some(seen => seen.includes(value))) continue
        found.add(value)
      }
    }

    found.forEach(value => results.push(analyseMac(value, line)))
  })

  return results
}

/* ------------------------------------------------------------- Étiquettes */

export const CAST_LABELS: Record<MacCast, { label: string, detail: string, color: string }> = {
  unicast: {
    label: 'Unicast',
    detail: 'Destinée à une seule interface.',
    color: 'neutral'
  },
  multicast: {
    label: 'Multicast',
    detail: 'Destinée à un groupe : le bit de poids faible du premier octet est à 1.',
    color: 'info'
  },
  broadcast: {
    label: 'Diffusion',
    detail: 'Destinée à toutes les stations du segment.',
    color: 'warning'
  }
}

export const ADMIN_LABELS: Record<MacAdmin, { label: string, detail: string }> = {
  universelle: {
    label: 'Universelle',
    detail: 'Attribuée par le constructeur depuis un bloc IEEE : le préfixe identifie une entreprise.'
  },
  locale: {
    label: 'Locale',
    detail: 'Attribuée localement — adresse aléatoire, machine virtuelle ou configuration manuelle. Aucun constructeur ne peut en être déduit.'
  }
}

export const REGISTRY_LABELS: Record<string, { label: string, bits: number }> = {
  L: { label: 'MA-L', bits: 24 },
  M: { label: 'MA-M', bits: 28 },
  S: { label: 'MA-S', bits: 36 },
  I: { label: 'IAB', bits: 36 }
}

export const MAC_SAMPLE = `00:1B:44:11:3A:B7
00-15-5D-38-1C-0A
0050.56c0.0008
FFFFFFFFFFFF
01:00:5e:00:00:fb
33:33:00:00:00:01
00:00:5e:00:01:2a
52:54:00:9d:41:6f
a4:83:e7:2f:11:c9
02:42:ac:11:00:02
? (192.168.1.1) at 3c:22:fb:8a:11:02 [ether] on eth0
lladdr 8c:85:90:14:5f:03 REACHABLE`
