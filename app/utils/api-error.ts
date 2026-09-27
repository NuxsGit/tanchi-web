/** Message lisible porté par une erreur `$fetch`, avec repli. */
export function apiError(cause: unknown, fallback = 'Une erreur est survenue.'): string {
  const data = (cause as { data?: { message?: string, statusMessage?: string } })?.data
  return data?.message || data?.statusMessage || fallback
}
