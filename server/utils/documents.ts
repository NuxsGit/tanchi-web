import type { H3Event } from 'h3'
import type { DocumentRow } from './db'
import { useDb } from './db'

/**
 * Magasin de documents applicatifs.
 *
 * Un document est identifié par son application et sa portée : personnelle
 * (`user`) ou partagée par une équipe (`team`). La portée équipe est ce qui
 * permet à plusieurs membres de travailler sur la même matrice ou le même plan.
 */

export type DocScope = 'user' | 'team'
export const DOC_APPS = ['fmd', 'topology', 'subnet', 'learn', 'draw'] as const
export type DocApp = typeof DOC_APPS[number]

export interface DocumentPayload {
  data: unknown
  revision: number
  updatedAt: string | null
  updatedBy: string | null
  scope: DocScope
  scopeId: number
  /** Vrai si l'utilisateur peut écrire dans ce document. */
  writable: boolean
}

export function isDocApp(value: unknown): value is DocApp {
  return typeof value === 'string' && (DOC_APPS as readonly string[]).includes(value)
}

/** Vérifie l'accès et renvoie la portée effective. */
export function resolveScope(
  event: H3Event,
  scope: unknown,
  teamId: unknown
): { scope: DocScope, scopeId: number, writable: boolean } {
  const user = requireUser(event)

  if (scope === 'team') {
    const id = Number(teamId)
    assert(Number.isInteger(id), 'Identifiant d\'équipe invalide.')

    const membership = useDb()
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(id, user.id) as { role: string } | undefined

    assert(membership, 'Équipe introuvable.', 404)
    return { scope: 'team', scopeId: id, writable: true }
  }

  return { scope: 'user', scopeId: user.id, writable: true }
}

export function readDocument(
  app: DocApp,
  scope: DocScope,
  scopeId: number,
  writable: boolean
): DocumentPayload {
  const row = useDb().prepare(`
    SELECT d.*, u.username AS author
    FROM documents d LEFT JOIN users u ON u.id = d.updated_by
    WHERE d.app = ? AND d.scope = ? AND d.scope_id = ?
  `).get(app, scope, scopeId) as (DocumentRow & { author: string | null }) | undefined

  if (!row) {
    return { data: null, revision: 0, updatedAt: null, updatedBy: null, scope, scopeId, writable }
  }

  let data: unknown = null
  try {
    data = JSON.parse(row.data)
  } catch {
    // Document illisible : on repart d'une page blanche plutôt que de planter.
    data = null
  }

  return {
    data,
    revision: row.revision,
    updatedAt: row.updated_at,
    updatedBy: row.author,
    scope,
    scopeId,
    writable
  }
}

export class RevisionConflict extends Error {
  constructor(public readonly current: DocumentPayload) {
    super('Document modifié entre-temps.')
  }
}

/**
 * Écrit une nouvelle révision.
 *
 * `expectedRevision` protège contre l'écrasement silencieux : si un coéquipier
 * a enregistré entre la lecture et l'écriture, l'appel échoue et renvoie la
 * version du serveur pour que l'interface propose de recharger.
 */
export function writeDocument(
  app: DocApp,
  scope: DocScope,
  scopeId: number,
  data: unknown,
  userId: number,
  expectedRevision: number | null
): DocumentPayload {
  const db = useDb()
  const serialized = JSON.stringify(data)

  const commit = db.transaction(() => {
    const existing = db.prepare(
      'SELECT revision FROM documents WHERE app = ? AND scope = ? AND scope_id = ?'
    ).get(app, scope, scopeId) as { revision: number } | undefined

    const current = existing?.revision ?? 0

    if (expectedRevision !== null && expectedRevision !== current) {
      throw new RevisionConflict(readDocument(app, scope, scopeId, true))
    }

    if (existing) {
      db.prepare(`
        UPDATE documents
        SET data = ?, revision = revision + 1, updated_at = datetime('now'), updated_by = ?
        WHERE app = ? AND scope = ? AND scope_id = ?
      `).run(serialized, userId, app, scope, scopeId)
    } else {
      db.prepare(`
        INSERT INTO documents (app, scope, scope_id, data, revision, updated_by)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(app, scope, scopeId, serialized, userId)
    }
  })

  commit()
  return readDocument(app, scope, scopeId, true)
}
