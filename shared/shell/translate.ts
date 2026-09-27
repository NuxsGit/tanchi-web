/**
 * Moteur de traduction « phrase vers commande ».
 *
 * Deux temps : on choisit l'intention par appariement pondéré de mots-clés,
 * puis on extrait les paramètres de la phrase pour remplir la recette de la
 * plateforme visée. Quand rien ne dépasse le seuil, l'outil le dit — il ne
 * fabrique jamais une commande par ressemblance approximative.
 */

import { INTENTS } from './intents'
import { GLOSSARY, WELL_KNOWN_PORTS, type Intent, type PlatformId, type Recipe } from './types'

/** Mots de liaison sans valeur discriminante, écartés de l'extraction. */
const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l',
  'sur', 'dans', 'vers', 'a', 'au', 'aux', 'et', 'ou', 'en', 'pour', 'par', 'avec', 'depuis',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cet', 'cette',
  'est', 'sont', 'que', 'qui', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'combien',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'faut', 'peux', 'veux', 'voudrais', 'aimerais',
  'stp', 'svp', 'merci', 'please', 'the', 'my',
  'machine', 'serveur', 'systeme', 'poste', 'hote', 'local', 'locale', 'distant', 'distante',
  'commande', 'faire', 'fais', 'donne', 'donner', 'moi', 'me', 'se', 'y', 'n', 'pas', 'plus',
  // Verbes de consultation : ils portent l'intention, jamais la valeur.
  'voir', 'vois', 'affiche', 'afficher', 'montre', 'montrer', 'regarder', 'consulter',
  'lister', 'liste', 'obtenir', 'avoir', 'connaitre', 'savoir', 'verifier', 'checker',
  'sortir', 'sort', 'trouve', 'cherche', 'recuperer', 'sur', 'toutes', 'tous', 'tout'
])

/** Services usuels, reconnus sans mot déclencheur. */
const KNOWN_SERVICES = new Set([
  'nginx', 'apache2', 'httpd', 'sshd', 'ssh', 'docker', 'containerd', 'mariadb', 'mysql',
  'postgresql', 'postgres', 'redis', 'fail2ban', 'cron', 'crond', 'chronyd', 'ntp', 'ntpd',
  'bind9', 'named', 'php-fpm', 'haproxy', 'keepalived', 'prometheus', 'grafana', 'elasticsearch',
  'smbd', 'nmbd', 'nfs-server', 'firewalld', 'ufw', 'systemd-resolved', 'networkmanager',
  'jenkins', 'gitlab', 'rabbitmq', 'memcached', 'vsftpd', 'proftpd', 'dovecot', 'postfix'
])

const IFACE_PATTERN = /^(?:eth|ens|enp|eno|wlan|wlp|bond|br|tun|tap|vmbr|veth|lo|gi|fa|te|ether|sfp|wan|lan)[\w./-]*$/i
const IP_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?\b/g
const DOMAIN_PATTERN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i

/** Retire les accents et la ponctuation pour comparer sans surprise. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[?!,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ----------------------------------------------------------- Appariement */

export interface Candidate {
  intent: Intent
  score: number
  /** Mots-clés effectivement trouvés, pour justifier le choix. */
  matched: string[]
  confidence: number
}

function scoreIntent(intent: Intent, normalized: string): Candidate | null {
  if (intent.exclude?.some(term => normalized.includes(normalize(term)))) return null

  let score = 0
  let anchored = false
  const matched: string[] = []

  for (const [word, weight] of intent.keywords) {
    const needle = normalize(word)
    // Un mot-clé d'un seul terme doit correspondre à un mot entier ; une
    // locution est cherchée telle quelle.
    const found = needle.includes(' ')
      ? normalized.includes(needle)
      : new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s?)( |$)`).test(normalized)

    if (!found) continue

    score += weight
    matched.push(word)
    if (weight >= 4) anchored = true
  }

  // Sans ancre, il faut un faisceau de termes secondaires pour compenser.
  if (!anchored && score < 7) return null
  if (score === 0) return null

  return { intent, score, matched, confidence: Math.min(1, score / 10) }
}

export function rankIntents(query: string, limit = 4): Candidate[] {
  const normalized = normalize(query)
  if (!normalized) return []

  return INTENTS
    .map(intent => scoreIntent(intent, normalized))
    .filter((candidate): candidate is Candidate => candidate !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/* ------------------------------------------------------------ Paramètres */

export interface SlotValue {
  id: string
  label: string
  value: string
  /** Vrai si la valeur vient d'un défaut et non de la phrase. */
  assumed: boolean
}

export function extractSlots(query: string, intent: Intent): SlotValue[] {
  const normalized = normalize(query)
  const raw = query.trim()

  // Les adresses se lisent sur le texte d'origine : la normalisation ne les
  // touche pas, mais les points doivent rester collés.
  const addresses = [...raw.matchAll(IP_PATTERN)].map(match => match[0]!)
  let addressCursor = 0

  const used = new Set<string>()
  const values: SlotValue[] = []

  // Port explicite, puis port nommé, puis nombre isolé plausible.
  let port: string | null = null
  let proto: string | null = null

  // Sans slot de port, on ne cherche pas : « postgresql » est un nom de
  // service avant d'être le port 5432, et le consommer ici le rendrait
  // invisible à l'extraction du service.
  const wantsPort = intent.slots.some(slot => slot.id === 'port' || slot.id === 'vlan')

  if (wantsPort) {
    const explicit = normalized.match(/\bports?\s+(?:numero\s+)?(\d{1,5})\b/)
    if (explicit) port = explicit[1]!

    for (const [name, definition] of Object.entries(WELL_KNOWN_PORTS)) {
      if (new RegExp(`(^| )${name}( |$)`).test(normalized)) {
        port ??= String(definition.port)
        proto ??= definition.proto
        used.add(name)
        break
      }
    }

    if (!port) {
      for (const match of normalized.matchAll(/\b(\d{1,5})\b/g)) {
        const candidate = Number(match[1])
        // Un nombre appartenant à une adresse n'est pas un port.
        if (addresses.some(address => address.includes(match[1]!))) continue
        if (candidate >= 1 && candidate <= 65535) { port = match[1]!; break }
      }
    }
  }

  const explicitProto = normalized.match(/\b(tcp|udp|icmp)\b/)
  if (explicitProto) proto = explicitProto[1]!

  // Forme « compte@machine », telle qu'on l'écrit pour ssh, scp ou rsync.
  const account = raw.match(/\b([\w.-]+)@([\w.-]+)\b/)

  const paths = [...raw.matchAll(/(?:^|\s)((?:\/|[A-Za-z]:\\)[\w./\\-]+)/g)].map(match => match[1]!)
  const devices = paths.filter(item => item.startsWith('/dev/'))

  const tokens = normalized.split(' ').filter(Boolean)
  const intentWords = new Set(intent.keywords.flatMap(([word]) => normalize(word).split(' ')))

  /** Mots restants, une fois retirés liaisons, mots-clés et valeurs déjà lues. */
  const leftovers = tokens.filter(token =>
    !STOPWORDS.has(token)
    && !intentWords.has(token)
    && !used.has(token)
    && !/^\d+$/.test(token)
    && !addresses.some(address => normalize(address).includes(token))
    && token.length > 1
  )

  let leftoverCursor = 0
  const takeLeftover = (predicate?: (value: string) => boolean): string | null => {
    for (let position = leftoverCursor; position < leftovers.length; position++) {
      const value = leftovers[position]!
      if (predicate && !predicate(value)) continue
      leftovers.splice(position, 1)
      return value
    }
    return null
  }

  for (const slot of intent.slots) {
    let value: string | null = null

    switch (slot.id) {
      case 'port':
        value = port
        break

      case 'proto':
        value = proto
        break

      case 'ip':
      case 'network':
        value = addresses[addressCursor] ?? null
        if (value) addressCursor++
        break

      case 'mode':
        value = normalized.match(/\b([0-7]{3,4})\b/)?.[1] ?? null
        break

      case 'vlan':
        value = normalized.match(/\bvlan\s*(\d{1,4})\b/)?.[1] ?? (port && Number(port) <= 4094 ? port : null)
        break

      case 'device':
        value = devices[0] ?? null
        break

      case 'path':
        value = paths.find(item => !devices.includes(item)) ?? null
        break

      case 'iface':
        value = takeLeftover(item => IFACE_PATTERN.test(item))
        break

      case 'host':
        value = account?.[2]
          ?? takeLeftover(item => DOMAIN_PATTERN.test(item))
          ?? addresses[addressCursor]
          ?? null
        if (!value) break
        if (addresses[addressCursor] === value) addressCursor++
        break

      case 'service':
        value = normalized.match(/\bservices?\s+([\w.-]+)/)?.[1]
          ?? takeLeftover(item => KNOWN_SERVICES.has(item))
          ?? takeLeftover()
        break

      case 'user':
        // Un jeton pointé est un nom de domaine ou un fichier, jamais un login :
        // sans ce garde, « copier ma clé sur serveur.local » prenait l'hôte
        // comme utilisateur et laissait le slot hôte vide.
        value = account?.[1]
          ?? normalized.match(/\b(?:utilisateur|user|compte|login)\s+([\w-]+)/)?.[1]
          ?? takeLeftover(item => !item.includes('.'))
        break

      case 'group':
        value = normalized.match(/\bgroupe?\s+([\w.-]+)/)?.[1] ?? null
        break

      default:
        value = takeLeftover()
    }

    values.push({
      id: slot.id,
      label: slot.label,
      value: value ?? slot.fallback ?? '',
      assumed: !value && Boolean(slot.fallback)
    })
  }

  return values
}

/** Masque décimal correspondant à une longueur de préfixe. */
function maskFromPrefix(prefix: number): string {
  const value = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return [24, 16, 8, 0].map(shift => (value >>> shift) & 0xff).join('.')
}

/**
 * Complète les paramètres par leurs formes dérivées.
 *
 * Un même réseau ne s'écrit pas pareil partout : Linux et JunOS acceptent la
 * notation CIDR, Cisco veut un masque décimal, et ses listes d'accès un joker
 * inversé. Plutôt que de dupliquer la valeur dans chaque recette, on expose
 * les variantes et chaque plateforme prend celle qui lui convient.
 */
function derive(values: SlotValue[]): SlotValue[] {
  const extra: SlotValue[] = []

  for (const slot of values) {
    if (!slot.value) continue

    extra.push({ id: `${slot.id}_up`, label: slot.label, value: slot.value.toUpperCase(), assumed: slot.assumed })

    const match = slot.value.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/)
    if (!match) continue

    const address = match[1]!
    const prefix = match[2] === undefined ? 32 : Number(match[2])
    if (prefix < 0 || prefix > 32) continue

    const mask = maskFromPrefix(prefix)
    const wildcard = mask.split('.').map(part => 255 - Number(part)).join('.')

    extra.push(
      { id: `${slot.id}_addr`, label: slot.label, value: address, assumed: slot.assumed },
      { id: `${slot.id}_mask`, label: slot.label, value: mask, assumed: slot.assumed },
      { id: `${slot.id}_wildcard`, label: slot.label, value: wildcard, assumed: slot.assumed }
    )
  }

  return [...values, ...extra]
}

/* -------------------------------------------------------------- Rendu */

export interface RenderedRecipe {
  commands: string[]
  verify?: string
  undo?: string
  note?: string
  danger?: string
  /** Paramètres attendus que la phrase n'a pas fournis. */
  missing: string[]
}

function fill(template: string, values: SlotValue[]): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const slot = values.find(item => item.id === key)
    return slot?.value ? slot.value : whole
  })
}

export function renderRecipe(recipe: Recipe, given: SlotValue[]): RenderedRecipe {
  const values = derive(given)

  const rendered: RenderedRecipe = {
    commands: recipe.commands.map(command => fill(command, values)),
    verify: recipe.verify ? fill(recipe.verify, values) : undefined,
    undo: recipe.undo ? fill(recipe.undo, values) : undefined,
    note: recipe.note ? fill(recipe.note, values) : undefined,
    danger: recipe.danger,
    missing: []
  }

  const remaining = new Set<string>()
  for (const text of [...rendered.commands, rendered.verify ?? '', rendered.undo ?? '']) {
    for (const match of text.matchAll(/\{(\w+)\}/g)) remaining.add(match[1]!)
  }

  rendered.missing = [...remaining]
  return rendered
}

/* ------------------------------------------------------------ Traduction */

export interface Translation {
  intent: Intent
  confidence: number
  matched: string[]
  values: SlotValue[]
  /** Absent quand la plateforme n'a pas d'équivalent. */
  recipe: RenderedRecipe | null
  /** Plateformes qui, elles, savent le faire. */
  availableOn: PlatformId[]
}

export function translate(query: string, platform: PlatformId, limit = 4): Translation[] {
  return rankIntents(query, limit).map(candidate => {
    const values = extractSlots(query, candidate.intent)
    const recipe = candidate.intent.platforms[platform]

    return {
      intent: candidate.intent,
      confidence: candidate.confidence,
      matched: candidate.matched,
      values,
      recipe: recipe ? renderRecipe(recipe, values) : null,
      availableOn: Object.keys(candidate.intent.platforms) as PlatformId[]
    }
  })
}

/* ------------------------------------------------------------- Explication */

export interface Explanation {
  token: string
  meaning: string
}

/** Décompose une commande et commente les éléments connus du glossaire. */
export function explainCommand(command: string): Explanation[] {
  const seen = new Set<string>()
  const out: Explanation[] = []

  // Les locutions du glossaire sont cherchées d'abord, avant le découpage.
  for (const key of Object.keys(GLOSSARY)) {
    if (!key.includes(' ')) continue
    if (command.includes(key) && !seen.has(key)) {
      seen.add(key)
      out.push({ token: key, meaning: GLOSSARY[key]! })
    }
  }

  for (const rawToken of command.split(/\s+/)) {
    const token = rawToken.replace(/[;'"`]+$/, '').replace(/^[;'"`]+/, '')
    if (!token || seen.has(token)) continue

    // Un drapeau composé comme --add-port=22 se ramène à sa partie stable.
    const base = token.includes('=') ? token.slice(0, token.indexOf('=')) : token
    const meaning = GLOSSARY[token] ?? GLOSSARY[base]
    if (!meaning) continue

    seen.add(token)
    out.push({ token: base, meaning })
  }

  return out
}

/** Recherche libre dans le catalogue, pour la vue « ce que je sais faire ». */
export function searchIntents(query: string): Intent[] {
  const needle = normalize(query)
  if (!needle) return INTENTS

  return INTENTS.filter(intent =>
    normalize(intent.label).includes(needle)
    || normalize(intent.category).includes(needle)
    || intent.keywords.some(([word]) => normalize(word).includes(needle))
    || intent.examples.some(example => normalize(example).includes(needle))
  )
}
