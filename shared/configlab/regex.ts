/**
 * Validation, explication et test d'expressions régulières.
 *
 * L'explication parcourt le motif jeton par jeton : c'est ce qui permet de
 * pointer précisément la partie incomprise, plutôt que de paraphraser le tout.
 */

export interface RegexToken {
  /** Fragment brut du motif. */
  raw: string
  /** Position dans le motif, pour la mise en évidence. */
  index: number
  kind: 'ancre' | 'classe' | 'quantificateur' | 'groupe' | 'échappement' | 'littéral' | 'alternative'
  explanation: string
}

export interface RegexMatch {
  value: string
  index: number
  groups: { name: string, value: string | undefined }[]
}

export interface RegexResult {
  valid: boolean
  error: string | null
  pattern: string
  flags: string
  tokens: RegexToken[]
  summary: string
  matches: RegexMatch[]
  /** Nombre de groupes capturants. */
  groupCount: number
}

export const FLAG_LABELS: Record<string, string> = {
  g: 'toutes les occurrences',
  i: 'insensible à la casse',
  m: 'multiligne : ^ et $ à chaque ligne',
  s: 'le point accepte les sauts de ligne',
  u: 'motif Unicode',
  y: 'ancré à la position courante'
}

const CLASS_LABELS: Record<string, string> = {
  '\\d': 'un chiffre',
  '\\D': 'tout sauf un chiffre',
  '\\w': 'un caractère de mot (lettre, chiffre ou souligné)',
  '\\W': 'tout sauf un caractère de mot',
  '\\s': 'un espace, une tabulation ou un saut de ligne',
  '\\S': 'tout sauf un espace',
  '\\b': 'une frontière de mot',
  '\\B': 'une position qui n\'est pas une frontière de mot',
  '\\n': 'un saut de ligne',
  '\\t': 'une tabulation',
  '\\r': 'un retour chariot'
}

/** Décrit un quantificateur en clair. */
function quantifierLabel(raw: string): string {
  const lazy = raw.endsWith('?') && raw.length > 1 && raw !== '??'
  const core = lazy ? raw.slice(0, -1) : raw
  const suffix = lazy ? ', au plus court' : ''

  if (core === '*') return `répété zéro fois ou plus${suffix}`
  if (core === '+') return `répété une fois ou plus${suffix}`
  if (core === '?') return `présent ou absent${suffix}`

  const exact = core.match(/^\{(\d+)\}$/)
  if (exact) return `répété exactement ${exact[1]} fois${suffix}`

  const open = core.match(/^\{(\d+),\}$/)
  if (open) return `répété au moins ${open[1]} fois${suffix}`

  const range = core.match(/^\{(\d+),(\d+)\}$/)
  if (range) return `répété de ${range[1]} à ${range[2]} fois${suffix}`

  return 'répétition'
}

/** Contenu d'une classe de caractères, décrit intervalle par intervalle. */
function describeCharClass(body: string): string {
  const negated = body.startsWith('^')
  const content = negated ? body.slice(1) : body

  const parts: string[] = []
  let index = 0

  while (index < content.length) {
    if (content[index] === '\\') {
      const escape = content.slice(index, index + 2)
      parts.push(CLASS_LABELS[escape] ?? `le caractère « ${escape[1]} »`)
      index += 2
      continue
    }

    if (content[index + 1] === '-' && content[index + 2] && content[index + 2] !== ']') {
      parts.push(`de « ${content[index]} » à « ${content[index + 2]} »`)
      index += 3
      continue
    }

    parts.push(`« ${content[index]} »`)
    index += 1
  }

  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} ou ${parts[parts.length - 1]}`
    : parts[0] ?? 'rien'

  return negated ? `tout caractère sauf ${list}` : `un caractère parmi ${list}`
}

/** Découpe le motif en jetons commentés. */
export function tokenize(pattern: string): RegexToken[] {
  const tokens: RegexToken[] = []
  let index = 0
  let literal = ''
  let literalStart = 0

  const flushLiteral = () => {
    if (!literal) return
    tokens.push({
      raw: literal,
      index: literalStart,
      kind: 'littéral',
      explanation: `le texte exact « ${literal} »`
    })
    literal = ''
  }

  while (index < pattern.length) {
    const char = pattern[index]!

    // Quantificateur : il porte sur ce qui précède.
    const quantifier = pattern.slice(index).match(/^(\*\?|\+\?|\?\?|\{\d+(,\d*)?\}\??|[*+?])/)
    if (quantifier && tokens.length + (literal ? 1 : 0) > 0) {
      // Un quantificateur après un littéral ne porte que sur son dernier caractère.
      if (literal.length > 1) {
        const last = literal.slice(-1)
        literal = literal.slice(0, -1)
        flushLiteral()
        tokens.push({
          raw: last, index: index - 1, kind: 'littéral',
          explanation: `le caractère « ${last} »`
        })
      } else {
        flushLiteral()
      }

      tokens.push({
        raw: quantifier[0], index, kind: 'quantificateur',
        explanation: quantifierLabel(quantifier[0])
      })
      index += quantifier[0].length
      continue
    }

    if (char === '\\') {
      flushLiteral()
      const escape = pattern.slice(index, index + 2)
      tokens.push({
        raw: escape, index, kind: 'échappement',
        explanation: CLASS_LABELS[escape] ?? `le caractère littéral « ${escape[1]} »`
      })
      index += 2
      continue
    }

    if (char === '[') {
      flushLiteral()
      let end = index + 1
      while (end < pattern.length && (pattern[end] !== ']' || pattern[end - 1] === '\\')) end++

      const body = pattern.slice(index + 1, end)
      tokens.push({
        raw: pattern.slice(index, end + 1), index, kind: 'classe',
        explanation: describeCharClass(body)
      })
      index = end + 1
      continue
    }

    if (char === '(') {
      flushLiteral()
      const ahead = pattern.slice(index)

      const named = ahead.match(/^\(\?<([A-Za-z_][\w$]*)>/)
      const kindMap: [RegExp, string][] = [
        [/^\(\?:/, 'un groupe non capturant'],
        [/^\(\?=/, 'suivi de (assertion avant positive)'],
        [/^\(\?!/, 'non suivi de (assertion avant négative)'],
        [/^\(\?<=/, 'précédé de (assertion arrière positive)'],
        [/^\(\?<!/, 'non précédé de (assertion arrière négative)']
      ]

      const special = kindMap.find(([regex]) => regex.test(ahead))
      const raw = named ? named[0] : special ? ahead.match(special[0])![0] : '('

      tokens.push({
        raw, index, kind: 'groupe',
        explanation: named
          ? `début du groupe nommé « ${named[1]} »`
          : special
            ? `début d'${special[1]}`
            : 'début d\'un groupe capturant'
      })
      index += raw.length
      continue
    }

    if (char === ')') {
      flushLiteral()
      tokens.push({ raw: ')', index, kind: 'groupe', explanation: 'fin du groupe' })
      index++
      continue
    }

    if (char === '^' || char === '$') {
      flushLiteral()
      tokens.push({
        raw: char, index, kind: 'ancre',
        explanation: char === '^' ? 'début de la chaîne ou de la ligne' : 'fin de la chaîne ou de la ligne'
      })
      index++
      continue
    }

    if (char === '|') {
      flushLiteral()
      tokens.push({ raw: '|', index, kind: 'alternative', explanation: 'ou bien' })
      index++
      continue
    }

    if (char === '.') {
      flushLiteral()
      tokens.push({
        raw: '.', index, kind: 'classe',
        explanation: 'n\'importe quel caractère, sauf saut de ligne'
      })
      index++
      continue
    }

    if (!literal) literalStart = index
    literal += char
    index++
  }

  flushLiteral()
  return tokens
}

/** Message d'erreur du moteur, ramené à une phrase utilisable. */
function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  const table: [RegExp, string][] = [
    [/Unterminated group/i, 'Parenthèse ouvrante sans fermeture.'],
    [/Unmatched '\)'/i, 'Parenthèse fermante en trop.'],
    [/Unterminated character class/i, 'Crochet ouvrant sans fermeture.'],
    [/Nothing to repeat/i, 'Quantificateur placé sans motif à répéter.'],
    [/Invalid group/i, 'Groupe mal formé.'],
    [/Invalid escape/i, 'Séquence d\'échappement inconnue.'],
    [/numbers out of order/i, 'Bornes de répétition inversées, par exemple {5,2}.'],
    [/Invalid regular expression flags/i, 'Option inconnue.']
  ]

  const match = table.find(([regex]) => regex.test(message))
  return match ? match[1] : message.replace(/^Invalid regular expression: /, '')
}

export function analyseRegex(pattern: string, flags: string, sample: string): RegexResult {
  const base: RegexResult = {
    valid: false, error: null, pattern, flags,
    tokens: [], summary: '', matches: [], groupCount: 0
  }

  if (!pattern) return { ...base, error: 'Motif vide.' }

  let regex: RegExp
  try {
    regex = new RegExp(pattern, flags)
  } catch (error) {
    return { ...base, error: readableError(error) }
  }

  const tokens = tokenize(pattern)

  // Comptage des groupes capturants, en ignorant les groupes non capturants.
  const groupCount = (pattern.match(/\((?!\?[:=!<])/g) ?? []).length
    + (pattern.match(/\(\?<[A-Za-z_]/g) ?? []).length

  const matches: RegexMatch[] = []
  if (sample) {
    const runner = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`)
    let found: RegExpExecArray | null
    let guard = 0

    while ((found = runner.exec(sample)) !== null && guard++ < 200) {
      matches.push({
        value: found[0],
        index: found.index,
        groups: found.slice(1).map((value, position) => ({
          name: `groupe ${position + 1}`,
          value
        })).concat(
          Object.entries(found.groups ?? {}).map(([name, value]) => ({ name, value }))
        )
      })

      // Un motif de largeur nulle ferait boucler la lecture.
      if (found[0] === '') runner.lastIndex++
    }
  }

  const summary = tokens.length
    ? `Recherche ${tokens.map(token => token.explanation).join(', puis ')}.`
    : ''

  return {
    valid: true, error: null, pattern, flags, tokens,
    summary, matches, groupCount
  }
}

export const REGEX_PRESETS: { label: string, pattern: string, flags: string, sample: string }[] = [
  {
    label: 'Adresse e-mail',
    pattern: '^[\\w.+-]+@[\\w-]+\\.[A-Za-z]{2,}$',
    flags: '',
    sample: 'contact@tanchi.io'
  },
  {
    label: 'Adresse IPv4',
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    flags: 'g',
    sample: 'Passerelle 192.168.1.1, DNS 10.0.0.53'
  },
  {
    label: 'Ligne de journal Nginx',
    pattern: '^(\\S+) \\S+ \\S+ \\[([^\\]]+)\\] "(\\w+) ([^"]+)" (\\d{3})',
    flags: '',
    sample: '10.0.0.7 - - [20/Aug/2026:10:07:00 +0200] "GET /index.html HTTP/1.1" 200'
  },
  {
    label: 'Horodatage ISO',
    pattern: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
    flags: 'g',
    sample: '2026-08-20T10:07:00 puis 2026-08-21T03:00:00'
  },
  {
    label: 'Adresse MAC',
    pattern: '(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}',
    flags: 'g',
    sample: 'Port 3 : 00:1B:44:11:3A:B7'
  },
  {
    label: 'Bloc CIDR',
    pattern: '\\b\\d{1,3}(?:\\.\\d{1,3}){3}/\\d{1,2}\\b',
    flags: 'g',
    sample: 'Réseaux 10.0.0.0/8 et 192.168.1.0/24'
  }
]
