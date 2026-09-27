/**
 * Domaine métier de Tanchi FlowMatrix Designer (FMD).
 *
 * Portage fidèle de la logique du projet React d'origine
 * (github.com/NuxsGit/Tanchi-FlowMatrix-Designer), isolé ici pour être partagé
 * entre le rendu Vue et la validation côté serveur.
 */

export type FlowAction = 'ALLOW' | 'DENY'
export type FlowStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Section {
  id: string
  name: string
  color: string
}

export interface AddressObject {
  id: string
  name: string
  value: string
  comment: string
}

export interface ServiceObject {
  id: string
  name: string
  protocol: string
  port: string
  comment: string
}

export interface MatrixObjects {
  addresses: AddressObject[]
  services: ServiceObject[]
}

export interface Flow {
  id: string
  ruleName: string
  source: string
  nomSource: string
  destination: string
  nomDestination: string
  application: string
  protocol: string
  action: FlowAction
  status: FlowStatus
  fromZone: string
  toZone: string
  natSrc: string
  natDst: string
  comment: string
  sectionId: string | null
}

export interface Matrix {
  id: string
  name: string
  flows: Flow[]
  sections: Section[]
  objects: MatrixObjects
  createdAt: string
  updatedAt: string
}

export interface FlowForm {
  ruleName: string
  source: string
  nomSource: string
  destination: string
  nomDestination: string
  application: string
  protocol: string
  action: FlowAction
  fromZone: string
  toZone: string
  natSrc: string
  natDst: string
  comment: string
  sectionId: string
}

export interface Workspace {
  matrices: Matrix[]
  activeMatrixId: string
}

export const SECTION_COLORS = [
  '#08A87C', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899',
  '#10B981', '#F97316', '#6366F1', '#EF4444', '#06B6D4'
]

export const APP_PROTOCOLS: Record<string, string> = {
  HTTP: '80/TCP',
  HTTPS: '443/TCP',
  SSH: '22/TCP',
  TELNET: '23/TCP',
  FTP: '21/TCP',
  SMTP: '25/TCP',
  DNS: '53/UDP',
  LDAP: '389/TCP',
  LDAPS: '636/TCP',
  KERBEROS: '88/TCP',
  RDP: '3389/TCP',
  SMB: '445/TCP',
  SNMP: '161/UDP',
  SYSLOG: '514/UDP',
  NTP: '123/UDP',
  MYSQL: '3306/TCP',
  MSSQL: '1433/TCP',
  POSTGRESQL: '5432/TCP',
  ORACLE: '1521/TCP',
  WINRM: '5985/TCP',
  'WINRM-HTTPS': '5986/TCP',
  OPENVPN: '1194/UDP',
  WIREGUARD: '51820/UDP',
  BGP: '179/TCP'
}

export const EMPTY_FORM: FlowForm = {
  ruleName: '',
  source: '',
  nomSource: '',
  destination: '',
  nomDestination: '',
  application: '',
  protocol: '',
  action: 'ALLOW',
  fromZone: 'TRUST',
  toZone: 'SERVERS',
  natSrc: '',
  natDst: '',
  comment: '',
  sectionId: ''
}

export const EMPTY_OBJECTS: MatrixObjects = { addresses: [], services: [] }

/* ------------------------------------------------------------- Utilitaires */

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalize(value: unknown): string {
  return String(value ?? '').trim()
}

export function createSection(name: string, index: number): Section {
  return {
    id: genId(),
    name: normalize(name),
    color: SECTION_COLORS[index % SECTION_COLORS.length]!
  }
}

export function createMatrix(name = 'Matrice 1'): Matrix {
  const now = new Date().toISOString()
  return {
    id: genId(),
    name,
    flows: [],
    sections: [],
    objects: { addresses: [], services: [] },
    createdAt: now,
    updatedAt: now
  }
}

/* ------------------------------------------------------------- Protocoles */

export function isValidProtocolToken(value: string): boolean {
  const token = normalize(value)
  if (!token) return false
  if (/^any$/i.test(token)) return true

  const match = token.match(/^(\d{1,5})(?:-(\d{1,5}))?\/(tcp|udp)$/i)
  if (!match) return false

  const start = Number(match[1])
  const end = Number(match[2] ?? match[1])
  return start >= 1 && start <= 65535 && end >= 1 && end <= 65535 && start <= end
}

export function isValidProtocol(value: string): boolean {
  const normalized = normalize(value)
  if (!normalized) return false
  return normalized
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
    .every(isValidProtocolToken)
}

export function normalizeProtocol(value: string): string {
  return normalize(value)
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (/^any$/i.test(token)) return 'any'
      const match = token.match(/^(\d{1,5})(?:-(\d{1,5}))?\/(tcp|udp)$/i)
      if (!match) return token.toUpperCase()
      const start = Number(match[1])
      const end = match[2] ? Number(match[2]) : null
      return `${start}${end ? `-${end}` : ''}/${match[3]!.toUpperCase()}`
    })
    .join(', ')
}

export function getApplicationProtocol(application: string): string {
  const key = Object.keys(APP_PROTOCOLS).find(
    item => item.toLowerCase() === normalize(application).toLowerCase()
  )
  return key ? APP_PROTOCOLS[key]! : ''
}

/* ---------------------------------------------------------------- Conflits */

export function buildConflictKey(
  flow: Pick<Flow, 'source' | 'destination' | 'protocol'>
): string {
  const source = normalize(flow.source).toLowerCase()
  const destination = normalize(flow.destination).toLowerCase()
  const protocol = normalize(flow.protocol).toLowerCase()
  return source && destination && protocol ? `${source}|${destination}|${protocol}` : ''
}

/** Clés apparaissant plus d'une fois : recouvrement de règles. */
export function findConflictKeys(flows: Flow[]): Set<string> {
  const counts = new Map<string, number>()
  for (const flow of flows) {
    const key = buildConflictKey(flow)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key))
}

export function statusLabel(status: FlowStatus): string {
  if (status === 'APPROVED') return 'APPROUVÉ'
  if (status === 'REJECTED') return 'REFUSÉ'
  return 'PENDING'
}

/* --------------------------------------------------------- Export Juniper */

export function splitValues(value: string): string[] {
  return normalize(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export function buildJuniperApplication(flow: Flow): string {
  const apps = splitValues(flow.application)
  const protocols = splitValues(flow.protocol)

  if (apps.length > 1) return `[ ${apps.join(' ')} ]`
  if (apps.length === 1) return apps[0]!
  if (protocols.length > 1) {
    return `[ ${protocols
      .map(item => (item === 'any' ? 'any' : `junos-${item.replace('/', '-').toLowerCase()}`))
      .join(' ')} ]`
  }
  if (protocols[0]) {
    return protocols[0] === 'any'
      ? 'any'
      : `junos-${protocols[0].replace('/', '-').toLowerCase()}`
  }
  return 'any'
}

export function buildPolicyName(flow: Flow, index: number): string {
  return `${index + 1}-${flow.source}-${flow.destination}-${flow.application || flow.protocol}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildJuniperConfig(flows: Flow[]): string {
  if (!flows.length) return 'Aucun flux pour le moment.'

  const lines: string[] = ['# TANCHI - Flow Matrix Designer', '']

  flows.forEach((flow, index) => {
    const policyName = buildPolicyName(flow, index)
    const source = splitValues(flow.source)
    const destination = splitValues(flow.destination)
    const sourceValue = source.length > 1 ? `[ ${source.join(' ')} ]` : source[0] || 'any'
    const destinationValue =
      destination.length > 1 ? `[ ${destination.join(' ')} ]` : destination[0] || 'any'
    const prefix = `set security policies from-zone ${flow.fromZone} to-zone ${flow.toZone} policy ${policyName}`

    lines.push(`# ${index + 1} - ${flow.ruleName || `${flow.source} -> ${flow.destination}`}`)
    lines.push(`${prefix} match source-address ${sourceValue}`)
    lines.push(`${prefix} match destination-address ${destinationValue}`)
    lines.push(`${prefix} match application ${buildJuniperApplication(flow)}`)
    lines.push(`${prefix} then ${flow.action.toLowerCase()}`)

    if (flow.natSrc) lines.push(`# Source NAT: ${flow.natSrc}`)
    if (flow.natDst) lines.push(`# Destination NAT: ${flow.natDst}`)
    if (flow.comment) lines.push(`# Commentaire: ${flow.comment}`)

    lines.push('')
  })

  return lines.join('\n')
}

export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export const CSV_HEADERS = [
  'Rule Name', 'Source', 'Nom source', 'Destination', 'Nom destination',
  'Application', 'Protocol', 'Action', 'Status', 'Zone source',
  'Zone destination', 'Source NAT', 'Destination NAT', 'Section', 'Commentaire'
]

export function buildCsv(flows: Flow[], sections: Section[]): string {
  const rows = flows.map((flow) => {
    const sectionName = sections.find(section => section.id === flow.sectionId)?.name ?? ''
    return [
      flow.ruleName, flow.source, flow.nomSource, flow.destination, flow.nomDestination,
      flow.application, flow.protocol, flow.action, flow.status, flow.fromZone,
      flow.toZone, flow.natSrc, flow.natDst, sectionName, flow.comment
    ].map(csvEscape).join(',')
  })

  return [CSV_HEADERS.join(','), ...rows].join('\n')
}

/* ------------------------------------------------------------ Import JSON */

export function normalizeImportedFlow(
  raw: Record<string, unknown>,
  resolveSectionId: (rawSectionId: unknown, rawSectionName: unknown) => string | null
): Flow | null {
  const source = normalize(raw.source ?? raw.Source ?? raw.src ?? raw.Src)
  const destination = normalize(raw.destination ?? raw.Destination ?? raw.dst ?? raw.Dst)
  const protocol = normalizeProtocol(
    normalize(
      raw.protocol ?? raw.Protocol ?? raw.proto ?? raw['Port/Protocol'] ?? raw['port/protocol']
    )
  )

  if (!source || !destination || !protocol || !isValidProtocol(protocol)) return null

  const action: FlowAction =
    normalize(raw.action ?? raw.Action).toUpperCase() === 'DENY' ? 'DENY' : 'ALLOW'
  const statusRaw = normalize(raw.status ?? raw.Status).toUpperCase()
  const status: FlowStatus =
    statusRaw === 'APPROVED' || statusRaw === 'REJECTED' ? statusRaw : 'PENDING'

  return {
    id: genId(),
    ruleName: normalize(raw.ruleName ?? raw['Rule Name'] ?? raw.rule_name),
    source,
    nomSource: normalize(raw.nomSource ?? raw.nom_source ?? raw['Nom source']),
    destination,
    nomDestination: normalize(raw.nomDestination ?? raw.nom_destination ?? raw['Nom destination']),
    application: normalize(raw.application ?? raw.Application ?? raw.app ?? raw.App),
    protocol,
    action,
    status,
    fromZone: normalize(raw.fromZone ?? raw.FromZone ?? raw['Zone source']) || 'TRUST',
    toZone: normalize(raw.toZone ?? raw.ToZone ?? raw['Zone destination']) || 'SERVERS',
    natSrc: normalize(raw.natSrc ?? raw.nat_src ?? raw['Source NAT']),
    natDst: normalize(raw.natDst ?? raw.nat_dst ?? raw['Destination NAT']),
    comment: normalize(raw.comment ?? raw.Comment ?? raw.Commentaire),
    sectionId: resolveSectionId(raw.sectionId, raw.sectionName ?? raw.Section)
  }
}

/* ------------------------------------------------------- Normalisation DB */

export function normalizeMatrix(matrix: Matrix): Matrix {
  return {
    ...matrix,
    flows: Array.isArray(matrix.flows) ? matrix.flows : [],
    sections: Array.isArray(matrix.sections) ? matrix.sections : [],
    objects: {
      addresses: Array.isArray(matrix.objects?.addresses)
        ? matrix.objects.addresses.map(address => ({
            id: address.id ?? genId(),
            name: normalize(address.name).toUpperCase(),
            value: normalize(address.value),
            comment: normalize(address.comment)
          }))
        : [],
      services: Array.isArray(matrix.objects?.services)
        ? matrix.objects.services.map(service => ({
            id: service.id ?? genId(),
            name: normalize(service.name).toUpperCase(),
            protocol: normalizeProtocol(service.protocol),
            port: normalize(service.port),
            comment: normalize(service.comment)
          }))
        : []
    }
  }
}

/** Remet un espace de travail arbitraire dans un état exploitable. */
export function normalizeWorkspace(raw: unknown): Workspace {
  const parsed = (raw ?? {}) as Partial<Workspace>
  const matrices =
    Array.isArray(parsed.matrices) && parsed.matrices.length
      ? parsed.matrices.map(matrix => normalizeMatrix(matrix as Matrix))
      : [createMatrix()]

  const activeMatrixId = matrices.some(matrix => matrix.id === parsed.activeMatrixId)
    ? (parsed.activeMatrixId as string)
    : matrices[0]!.id

  return { matrices, activeMatrixId }
}

/** Pack de règles Active Directory prêt à l'emploi. */
export function buildBulkAdFlows(): Flow[] {
  return [
    { application: 'LDAP', protocol: '389/TCP' },
    { application: 'KERBEROS', protocol: '88/TCP' },
    { application: 'DNS', protocol: '53/UDP' }
  ].map(item => ({
    id: genId(),
    ruleName: `ALLOW-${item.application}-AD`,
    source: 'USERS',
    nomSource: 'Utilisateurs',
    destination: 'AD01',
    nomDestination: 'Active Directory',
    application: item.application,
    protocol: item.protocol,
    action: 'ALLOW' as FlowAction,
    status: 'PENDING' as FlowStatus,
    fromZone: 'TRUST',
    toZone: 'SERVERS',
    natSrc: '',
    natDst: '',
    comment: 'Bulk AD',
    sectionId: null
  }))
}
