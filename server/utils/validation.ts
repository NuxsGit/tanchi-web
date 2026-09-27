export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STATUS_LABELS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large'
}

/**
 * `message` porte le texte destiné à l'utilisateur ; `statusMessage` reste un
 * libellé HTTP court, comme h3 l'attend.
 */
export function assert(condition: unknown, message: string, statusCode = 400): asserts condition {
  if (condition) return

  throw createError({
    statusCode,
    statusMessage: STATUS_LABELS[statusCode] ?? 'Error',
    message,
    data: { message }
  })
}

export function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
