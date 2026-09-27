/**
 * Hydrate la session une seule fois au démarrage, avant le premier rendu :
 * les middlewares de route disposent ainsi d'un état fiable sans requête
 * supplémentaire à chaque navigation.
 */
export default defineNuxtPlugin(async () => {
  const { ready, fetchSession } = useAuth()
  if (!ready.value) await fetchSession()
})
