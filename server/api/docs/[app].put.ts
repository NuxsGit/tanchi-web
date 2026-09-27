import { RevisionConflict, isDocApp, resolveScope, writeDocument } from '~~/server/utils/documents'

/** Limite de garde : un plan ou une matrice réaliste pèse quelques dizaines de Ko. */
const MAX_BYTES = 4 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const app = getRouterParam(event, 'app')
  assert(isDocApp(app), 'Application inconnue.', 404)

  const user = requireUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  assert(body?.data !== undefined, 'Contenu manquant.')

  const { scope, scopeId } = resolveScope(event, body?.scope, body?.teamId)

  const serialized = JSON.stringify(body.data)
  assert(Buffer.byteLength(serialized, 'utf8') <= MAX_BYTES, 'Document trop volumineux.', 413)

  const expected = body.revision === undefined || body.revision === null
    ? null
    : Number(body.revision)

  try {
    return { document: writeDocument(app!, scope, scopeId, body.data, user.id, expected) }
  } catch (cause) {
    if (cause instanceof RevisionConflict) {
      // 409 : l'appelant doit décider entre recharger et réappliquer.
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: `Modifié entre-temps par ${cause.current.updatedBy ?? 'un coéquipier'}.`,
        data: {
          message: `Modifié entre-temps par ${cause.current.updatedBy ?? 'un coéquipier'}.`,
          document: cause.current
        }
      })
    }
    throw cause
  }
})
