import { ouiSize, ouiUpdatedAt, resolveOui, type OuiMatch } from '~~/server/utils/oui'

/** Au-delà, la page devient de toute façon illisible. */
const MAX_ADDRESSES = 2000

/**
 * Résout le propriétaire d'un lot d'adresses.
 *
 * Le client envoie les adresses déjà normalisées ; l'analyse elle-même se fait
 * dans le navigateur, seul le registre demande le serveur.
 */
export default defineEventHandler(async (event) => {
  requireUser(event)

  const body = await readBody<{ addresses?: unknown }>(event)
  const list = Array.isArray(body?.addresses) ? body.addresses : []

  assert(list.length <= MAX_ADDRESSES, `Trop d'adresses en une fois (${MAX_ADDRESSES} au maximum).`, 413)

  const results: Record<string, OuiMatch | null> = {}

  for (const item of list) {
    const normalized = String(item).toUpperCase()
    if (!/^[0-9A-F]{12}$|^[0-9A-F]{16}$/.test(normalized)) continue
    if (normalized in results) continue

    results[normalized] = await resolveOui(normalized)
  }

  return {
    results,
    registry: {
      updated: await ouiUpdatedAt(),
      size: await ouiSize()
    }
  }
})
