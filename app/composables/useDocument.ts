export type DocScope = 'user' | 'team'

export interface DocumentPayload<T = unknown> {
  data: T | null
  revision: number
  updatedAt: string | null
  updatedBy: string | null
  scope: DocScope
  scopeId: number
  writable: boolean
}

export interface DocScopeRef {
  scope: DocScope
  teamId?: number
}

/**
 * Accès générique aux documents applicatifs (FlowMatrix, TopologyBoard, Draw…).
 *
 * La portée décide du partage : `user` pour un brouillon personnel, `team` pour
 * un document que toute l'équipe modifie. Le numéro de révision protège contre
 * l'écrasement d'un coéquipier.
 */
export const useDocument = <T>(app: 'fmd' | 'topology' | 'subnet' | 'learn' | 'draw') => {
  const revision = ref(0)
  const updatedAt = ref<string | null>(null)
  const updatedBy = ref<string | null>(null)
  const conflict = ref<DocumentPayload<T> | null>(null)
  const saving = ref(false)

  function remember(payload: DocumentPayload<T>) {
    revision.value = payload.revision
    updatedAt.value = payload.updatedAt
    updatedBy.value = payload.updatedBy
  }

  async function load(ref_: DocScopeRef): Promise<DocumentPayload<T>> {
    const query: Record<string, string> = { scope: ref_.scope }
    if (ref_.scope === 'team' && ref_.teamId) query.teamId = String(ref_.teamId)

    const { document } = await $fetch<{ document: DocumentPayload<T> }>(`/api/docs/${app}`, { query })
    remember(document)
    conflict.value = null
    return document
  }

  /**
   * Enregistre une nouvelle révision.
   *
   * En cas de conflit, la version du serveur est exposée dans `conflict` pour
   * que l'appelant propose un choix plutôt que d'écraser en silence.
   */
  async function save(ref_: DocScopeRef, data: T): Promise<boolean> {
    saving.value = true
    try {
      const { document } = await $fetch<{ document: DocumentPayload<T> }>(`/api/docs/${app}`, {
        method: 'PUT',
        body: {
          data,
          scope: ref_.scope,
          teamId: ref_.teamId,
          revision: revision.value
        }
      })
      remember(document)
      conflict.value = null
      return true
    } catch (error) {
      const payload = (error as { data?: { data?: { document?: DocumentPayload<T> } } })?.data?.data
      if (payload?.document) {
        conflict.value = payload.document
        return false
      }
      throw error
    } finally {
      saving.value = false
    }
  }

  /** Reprend la version du serveur et repart de sa révision. */
  function resolveWithRemote(): T | null {
    if (!conflict.value) return null
    const data = conflict.value.data
    remember(conflict.value)
    conflict.value = null
    return data
  }

  /** Impose la version locale, en repartant de la révision du serveur. */
  function forceLocal() {
    if (!conflict.value) return
    revision.value = conflict.value.revision
    conflict.value = null
  }

  const savedLabel = computed(() => {
    if (saving.value) return 'Enregistrement…'
    if (!updatedAt.value) return 'Jamais enregistré'

    const date = new Date(`${updatedAt.value.replace(' ', 'T')}Z`)
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return updatedBy.value ? `Enregistré à ${time} par ${updatedBy.value}` : `Enregistré à ${time}`
  })

  return {
    revision, updatedAt, updatedBy, conflict, saving, savedLabel,
    load, save, resolveWithRemote, forceLocal
  }
}
