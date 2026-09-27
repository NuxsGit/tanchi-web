/**
 * Analyse, validation et explication d'expressions cron.
 *
 * Couvre la syntaxe Vixie/Debian à cinq champs, les noms de mois et de jours,
 * les pas, les listes et les intervalles, ainsi que les macros `@daily` & co.
 */

export interface CronField {
  name: string
  min: number
  max: number
  /** Noms acceptés à la place des nombres, indexés à partir de `min`. */
  names?: string[]
}

export const FIELDS: CronField[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'heure', min: 0, max: 23 },
  { name: 'jour du mois', min: 1, max: 31 },
  {
    name: 'mois',
    min: 1,
    max: 12,
    names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  },
  {
    name: 'jour de la semaine',
    min: 0,
    max: 7,
    names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  }
]

export const MACROS: Record<string, { expression: string, label: string }> = {
  '@yearly': { expression: '0 0 1 1 *', label: 'une fois par an, le 1er janvier à minuit' },
  '@annually': { expression: '0 0 1 1 *', label: 'une fois par an, le 1er janvier à minuit' },
  '@monthly': { expression: '0 0 1 * *', label: 'le 1er de chaque mois à minuit' },
  '@weekly': { expression: '0 0 * * 0', label: 'chaque dimanche à minuit' },
  '@daily': { expression: '0 0 * * *', label: 'chaque jour à minuit' },
  '@midnight': { expression: '0 0 * * *', label: 'chaque jour à minuit' },
  '@hourly': { expression: '0 * * * *', label: 'au début de chaque heure' },
  '@reboot': { expression: '', label: 'au démarrage de la machine' }
}

export interface FieldResult {
  field: CronField
  raw: string
  /** Valeurs retenues, triées. */
  values: number[]
  /** Vrai si le champ couvre toute sa plage. */
  wildcard: boolean
  error: string | null
  explanation: string
}

export interface CronResult {
  valid: boolean
  expression: string
  /** Expression développée quand une macro a été employée. */
  expanded: string
  macro: string | null
  fields: FieldResult[]
  errors: string[]
  summary: string
  nextRuns: string[]
}

const DAY_LABELS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTH_LABELS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

/** Traduit un jeton nommé (`MON`, `JAN`) en nombre. */
function resolveToken(token: string, field: CronField): number | null {
  const upper = token.toUpperCase()

  if (field.names) {
    const index = field.names.indexOf(upper)
    if (index >= 0) return index + (field.name === 'mois' ? 1 : 0)
  }

  if (!/^\d+$/.test(token)) return null
  return Number(token)
}

/** Développe un champ en liste de valeurs, ou renvoie une erreur explicite. */
export function parseField(raw: string, field: CronField): FieldResult {
  const base: FieldResult = {
    field, raw, values: [], wildcard: false, error: null, explanation: ''
  }

  if (!raw) return { ...base, error: `Champ ${field.name} vide.` }

  const values = new Set<number>()

  for (const part of raw.split(',')) {
    const [rangePart, stepPart] = part.split('/')

    let step = 1
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) === 0) {
        return { ...base, error: `Pas invalide « /${stepPart} » dans le champ ${field.name}.` }
      }
      step = Number(stepPart)
    }

    let start = field.min
    let end = field.max

    if (rangePart !== '*' && rangePart !== '') {
      if (rangePart!.includes('-')) {
        const [from, to] = rangePart!.split('-')
        const a = resolveToken(from ?? '', field)
        const b = resolveToken(to ?? '', field)

        if (a === null || b === null) {
          return { ...base, error: `Intervalle illisible « ${rangePart} » dans le champ ${field.name}.` }
        }
        if (a > b) {
          return { ...base, error: `Intervalle inversé « ${rangePart} » dans le champ ${field.name}.` }
        }
        start = a
        end = b
      } else {
        const single = resolveToken(rangePart ?? '', field)
        if (single === null) {
          return { ...base, error: `Valeur illisible « ${rangePart} » dans le champ ${field.name}.` }
        }
        start = single
        end = stepPart === undefined ? single : field.max
      }
    }

    if (start < field.min || end > field.max) {
      return {
        ...base,
        error: `Le champ ${field.name} accepte ${field.min} à ${field.max}, reçu « ${part} ».`
      }
    }

    for (let value = start; value <= end; value += step) values.add(value)
  }

  const sorted = [...values].sort((a, b) => a - b)
  const wildcard = raw === '*'

  return {
    ...base,
    values: sorted,
    wildcard,
    explanation: explainField(raw, sorted, field, wildcard)
  }
}

/** Ordinal français, pour les jours du mois. */
function ordinal(value: number): string {
  return value === 1 ? '1er' : String(value)
}

function joinFr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`
}

/** Rendu d'une valeur selon la nature du champ. */
function label(value: number, field: CronField): string {
  switch (field.name) {
    case 'jour de la semaine': return DAY_LABELS[value === 7 ? 0 : value]!
    case 'mois': return MONTH_LABELS[value - 1]!
    case 'jour du mois': return ordinal(value)
    case 'heure': return `${value} h`
    default: return String(value)
  }
}

/**
 * Explication d'un champ, en français naturel.
 *
 * Chaque nature de champ a sa tournure : « du lundi au vendredi » plutôt que
 * « jour de la semaine de lundi à vendredi ».
 */
function explainField(raw: string, values: number[], field: CronField, wildcard: boolean): string {
  if (wildcard) {
    switch (field.name) {
      case 'jour de la semaine': return 'tous les jours de la semaine'
      case 'mois': return 'tous les mois'
      case 'jour du mois': return 'tous les jours du mois'
      case 'heure': return 'à toute heure'
      default: return 'à chaque minute'
    }
  }

  const stepMatch = raw.match(/^(\*|\d+-\d+|[A-Za-z]+-[A-Za-z]+)\/(\d+)$/)
  if (stepMatch) {
    const step = Number(stepMatch[2])
    const unit = field.name === 'jour de la semaine' ? 'jours' : `${field.name}s`
    const scope = stepMatch[1] === '*'
      ? ''
      : ` ${rangePhrase(values[0]!, values[values.length - 1]!, field)}`
    return `toutes les ${step} ${unit}${scope}`
  }

  const isRange = raw.includes('-') && !raw.includes(',')
  if (isRange) return rangePhrase(values[0]!, values[values.length - 1]!, field)

  const listed = joinFr(values.map(value => label(value, field)))

  switch (field.name) {
    case 'jour de la semaine': return `le ${listed}`
    case 'mois': return `en ${listed}`
    case 'jour du mois': return `le ${listed}`
    case 'heure': return `à ${listed}`
    default: return values.length === 1 ? `à la minute ${listed}` : `aux minutes ${listed}`
  }
}

function rangePhrase(from: number, to: number, field: CronField): string {
  switch (field.name) {
    case 'jour de la semaine': return `du ${label(from, field)} au ${label(to, field)}`
    case 'mois': return `de ${label(from, field)} à ${label(to, field)}`
    case 'jour du mois': return `du ${label(from, field)} au ${label(to, field)}`
    case 'heure': return `de ${label(from, field)} à ${label(to, field)}`
    default: return `de la minute ${from} à ${to}`
  }
}

/* ------------------------------------------------------- Prochaines exécutions */

function matches(date: Date, fields: FieldResult[]): boolean {
  const [minute, hour, dom, month, dow] = fields

  if (!minute!.values.includes(date.getMinutes())) return false
  if (!hour!.values.includes(date.getHours())) return false
  if (!month!.values.includes(date.getMonth() + 1)) return false

  const day = date.getDate()
  const weekday = date.getDay()
  const weekdayValues = dow!.values.map(value => (value === 7 ? 0 : value))

  // Règle Vixie : si les deux champs de jour sont restreints, l'un OU l'autre suffit.
  const domRestricted = !dom!.wildcard
  const dowRestricted = !dow!.wildcard

  if (domRestricted && dowRestricted) {
    return dom!.values.includes(day) || weekdayValues.includes(weekday)
  }
  if (domRestricted) return dom!.values.includes(day)
  if (dowRestricted) return weekdayValues.includes(weekday)
  return true
}

/**
 * Prochaines exécutions.
 *
 * Le parcours saute de minute en minute mais s'arrête au bout de quatre ans :
 * une expression comme « 29 février un lundi » peut être très espacée.
 */
export function nextRuns(fields: FieldResult[], count = 5, from = new Date()): Date[] {
  const runs: Date[] = []
  const cursor = new Date(from.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const limit = 4 * 366 * 24 * 60
  for (let step = 0; step < limit && runs.length < count; step++) {
    if (matches(cursor, fields)) runs.push(new Date(cursor.getTime()))
    cursor.setMinutes(cursor.getMinutes() + 1)
  }

  return runs
}

/* --------------------------------------------------------------- Résumé */

function buildSummary(fields: FieldResult[]): string {
  const [minute, hour, dom, month, dow] = fields

  /* -------- Moment de la journée -------- */
  const time = (() => {
    if (minute!.wildcard && hour!.wildcard) return 'chaque minute'

    const stepMinute = minute!.raw.match(/^\*\/(\d+)$/)
    if (stepMinute) {
      const cadence = `toutes les ${stepMinute[1]} minutes`
      return hour!.wildcard ? cadence : `${cadence} ${hour!.explanation}`
    }

    if (minute!.wildcard) return `chaque minute ${hour!.explanation}`

    const stepHour = hour!.raw.match(/^\*\/(\d+)$/)
    if (stepHour && minute!.values.length === 1) {
      return `toutes les ${stepHour[1]} heures, à la minute ${minute!.values[0]}`
    }

    if (hour!.wildcard) {
      return minute!.values.length === 1
        ? `à la minute ${minute!.values[0]} de chaque heure`
        : `aux minutes ${joinFr(minute!.values.map(String))} de chaque heure`
    }

    // Heures et minutes fixes : on écrit les horaires en toutes lettres.
    if (minute!.values.length === 1 && !hour!.raw.includes('-')) {
      const stamps = hour!.values.map(
        value => `${String(value).padStart(2, '0')} h ${String(minute!.values[0]).padStart(2, '0')}`
      )
      return `à ${joinFr(stamps)}`
    }

    return `${minute!.explanation}, ${hour!.explanation}`
  })()

  /* -------- Jours concernés -------- */
  const days: string[] = []
  if (!dom!.wildcard) days.push(dom!.explanation)
  if (!dow!.wildcard) days.push(dow!.explanation)

  const parts = [time]

  if (days.length) {
    // Règle Vixie : deux champs de jour restreints se cumulent en « ou ».
    parts.push(days.length === 2 ? `${days[0]} ou ${days[1]}` : days[0]!)
  } else if (month!.wildcard) {
    parts.push('tous les jours')
  }

  if (!month!.wildcard) parts.push(month!.explanation)

  return parts.join(', ')
}

export function parseCron(expression: string, from = new Date()): CronResult {
  const input = expression.trim()

  const empty: CronResult = {
    valid: false, expression: input, expanded: input, macro: null,
    fields: [], errors: [], summary: '', nextRuns: []
  }

  if (!input) return { ...empty, errors: ['Expression vide.'] }

  // Macros : on les développe avant analyse.
  let working = input
  let macro: string | null = null

  if (input.startsWith('@')) {
    const entry = MACROS[input.toLowerCase()]
    if (!entry) {
      return { ...empty, errors: [`Macro inconnue « ${input} ». Attendu : ${Object.keys(MACROS).join(', ')}.`] }
    }

    macro = input.toLowerCase()
    if (!entry.expression) {
      return {
        ...empty, valid: true, macro, expanded: '—',
        summary: entry.label, nextRuns: []
      }
    }
    working = entry.expression
  }

  const parts = working.split(/\s+/)
  if (parts.length !== 5) {
    return {
      ...empty,
      expanded: working,
      macro,
      errors: [`Cinq champs attendus (minute heure jour mois jour-semaine), ${parts.length} reçu(s).`]
    }
  }

  const fields = parts.map((part, index) => parseField(part, FIELDS[index]!))
  const errors = fields.map(field => field.error).filter(Boolean) as string[]

  if (errors.length) {
    return { ...empty, expanded: working, macro, fields, errors }
  }

  return {
    valid: true,
    expression: input,
    expanded: working,
    macro,
    fields,
    errors: [],
    summary: buildSummary(fields),
    nextRuns: nextRuns(fields, 5, from).map(date =>
      date.toLocaleString('fr-FR', {
        weekday: 'short', day: '2-digit', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    )
  }
}

export const CRON_PRESETS: { label: string, expression: string }[] = [
  { label: 'Toutes les 5 minutes', expression: '*/5 * * * *' },
  { label: 'Toutes les 15 minutes', expression: '*/15 * * * *' },
  { label: 'Chaque heure', expression: '0 * * * *' },
  { label: 'Chaque nuit à 3 h', expression: '0 3 * * *' },
  { label: 'Jours ouvrés à 8 h', expression: '0 8 * * MON-FRI' },
  { label: 'Chaque lundi à 6 h', expression: '0 6 * * MON' },
  { label: 'Le 1er du mois à minuit', expression: '0 0 1 * *' },
  { label: 'Deux fois par jour', expression: '0 6,18 * * *' },
  { label: 'Toutes les 6 heures', expression: '0 */6 * * *' },
  { label: 'Sauvegarde du dimanche', expression: '30 2 * * SUN' }
]
