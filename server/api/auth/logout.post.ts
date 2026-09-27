export default defineEventHandler((event) => {
  destroySession(event)
  return { ok: true }
})
