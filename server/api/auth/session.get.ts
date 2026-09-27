export default defineEventHandler((event) => {
  const user = getCurrentUser(event)
  return { user: user ? toPublicUser(user) : null }
})
