/**
 * Registre IEEE des préfixes d'adresses MAC.
 *
 * L'index vit côté serveur : un méga-octet et demi n'a rien à faire dans le
 * paquet du navigateur. Il est construit à la première demande puis conservé
 * en mémoire pour la durée du processus.
 */

export interface OuiMatch {
  vendor: string
  /** Lettre de registre : L (MA-L), M (MA-M), S (MA-S), I (IAB). */
  registry: string
  /** Préfixe effectivement retenu. */
  prefix: string
  /**
   * Vrai quand seul le bloc parent est connu : l'IEEE a délégué ce préfixe et
   * le sous-bloc n'est pas dans notre instantané.
   */
  delegated: boolean
}

/** Nom porté par les blocs MA-L que l'IEEE a redécoupés. */
const DELEGATED = 'IEEE Registration Authority'

interface Index {
  entries: Map<string, string>
  /** Date de l'instantané du registre. */
  updated: string
}

let index: Index | null = null
let building: Promise<Index> | null = null

async function build(): Promise<Index> {
  const raw = await useStorage('assets:server').getItem('oui.txt')

  const text = typeof raw === 'string'
    ? raw
    : new TextDecoder().decode(raw as unknown as Uint8Array)

  const entries = new Map<string, string>()
  let updated = 'inconnue'

  for (const line of text.split('\n')) {
    if (!line) continue

    if (line.startsWith('#')) {
      updated = line.slice(1).trim()
      continue
    }

    // Format : lettre de registre | préfixe | organisation.
    const first = line.indexOf('|')
    const second = line.indexOf('|', first + 1)
    if (first < 0 || second < 0) continue

    // La valeur garde la lettre de registre en tête : un caractère de plus
    // par entrée, contre un objet de plus sur quarante-six mille.
    entries.set(line.slice(first + 1, second), line[0]! + line.slice(second + 1))
  }

  return { entries, updated }
}

async function useIndex(): Promise<Index> {
  if (index) return index

  // Deux requêtes simultanées ne doivent pas construire l'index deux fois.
  building ??= build().then(result => {
    index = result
    building = null
    return result
  })

  return building
}

/**
 * Cherche le propriétaire d'une adresse.
 *
 * L'ordre compte : un bloc MA-S de 36 bits prime sur le MA-M de 28 bits qui le
 * contient, lui-même prioritaire sur le MA-L de 24 bits. Sans cela, toute
 * adresse d'un bloc redécoupé serait attribuée à l'IEEE elle-même.
 */
export async function resolveOui(normalized: string): Promise<OuiMatch | null> {
  const { entries } = await useIndex()

  for (const length of [9, 7, 6]) {
    const prefix = normalized.slice(0, length)
    const value = entries.get(prefix)
    if (!value) continue

    const vendor = value.slice(1)
    return {
      vendor,
      registry: value[0]!,
      prefix,
      delegated: length === 6 && vendor === DELEGATED
    }
  }

  return null
}

/** Date de l'instantané du registre embarqué. */
export async function ouiUpdatedAt(): Promise<string> {
  return (await useIndex()).updated
}

/** Nombre de préfixes connus, pour l'affichage. */
export async function ouiSize(): Promise<number> {
  return (await useIndex()).entries.size
}
