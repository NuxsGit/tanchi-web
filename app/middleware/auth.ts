/**
 * Protège les routes privées (`/dashboard`, `/apps`, `/settings`).
 * Déclaré page par page via `definePageMeta({ middleware: 'auth' })`.
 *
 * Le middleware de la navigation initiale s'exécute avant les plugins : on
 * hydrate donc la session ici si ce n'est pas déjà fait, plutôt que de se fier
 * à l'ordre d'exécution.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { token, user, ready, fetchSession } = useAuth()

  if (!ready.value) await fetchSession()

  if (!token.value && !user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
