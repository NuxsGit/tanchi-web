import { isDocApp, readDocument, resolveScope } from '~~/server/utils/documents'

export default defineEventHandler((event) => {
  const app = getRouterParam(event, 'app')
  assert(isDocApp(app), 'Application inconnue.', 404)

  const query = getQuery(event)
  const { scope, scopeId, writable } = resolveScope(event, query.scope, query.teamId)

  return { document: readDocument(app!, scope, scopeId, writable) }
})
