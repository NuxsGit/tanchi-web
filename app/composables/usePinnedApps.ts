import type { PublicUser } from '~~/server/utils/auth'
import { findApp, isPinnable, normalizePinnedApps } from '~~/shared/apps'

/**
 * Modules épinglés dans la barre latérale.
 *
 * La liste est vide par défaut : la navigation ne se remplit que sur décision
 * explicite depuis le hub, ce qui évite une barre saturée dès l'inscription.
 */
export const usePinnedApps = () => {
  const { user, applyUser } = useAuth()
  const toast = useToast()

  const pinned = computed(() => normalizePinnedApps(user.value?.pinnedApps ?? []))

  const isPinned = (id: string) => pinned.value.includes(id)

  /** Limite alignée sur `normalizePinnedApps`, pour prévenir avant l'appel. */
  const LIMIT = 8
  const isFull = computed(() => pinned.value.length >= LIMIT)

  async function persist(next: string[]) {
    // Mise à jour optimiste : la barre réagit au clic, le serveur confirme.
    const previous = user.value?.pinnedApps ?? []
    if (user.value) user.value.pinnedApps = next

    try {
      const { user: updated } = await $fetch<{ user: PublicUser }>('/api/account/preferences', {
        method: 'PATCH',
        body: { pinnedApps: next }
      })
      applyUser(updated)
    } catch (error) {
      if (user.value) user.value.pinnedApps = previous
      toast.add({ title: 'Épinglage non enregistré', description: apiError(error), color: 'error' })
    }
  }

  async function toggle(id: string) {
    const app = findApp(id)
    if (!app || !isPinnable(app)) return

    if (isPinned(id)) {
      await persist(pinned.value.filter(item => item !== id))
      toast.add({ title: `${app.short} retiré de la navigation`, color: 'neutral' })
      return
    }

    if (isFull.value) {
      toast.add({
        title: 'Navigation pleine',
        description: `${LIMIT} modules au maximum. Retirez-en un d'abord.`,
        color: 'warning'
      })
      return
    }

    await persist([...pinned.value, id])
    toast.add({ title: `${app.short} ajouté à la navigation`, color: 'success' })
  }

  return { pinned, isPinned, isFull, toggle, limit: LIMIT }
}
