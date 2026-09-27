/** Renvoie vers le dashboard les visiteurs déjà connectés. */
export default defineNuxtRouteMiddleware(async () => {
  const { token, user, ready, fetchSession } = useAuth()

  if (!ready.value) await fetchSession()

  if (token.value || user.value) {
    return navigateTo('/dashboard')
  }
})
