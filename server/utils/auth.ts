import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import type { UserRow } from './db'
import { useDb } from './db'
import { normalizePinnedApps } from '~~/shared/apps'

export const SESSION_COOKIE = 'tanchi_session'
/** Miroirs lisibles par le client, posés par `useAuth` (cf. composable). */
export const MIRROR_COOKIES = ['tanchi_token', 'tanchi_user']
const SESSION_DAYS = 7

/* --------------------------------------------------------- Mots de passe */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !digest) return false

  const expected = Buffer.from(digest, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/* ------------------------------------------------------------- Sessions */

/**
 * `Secure` uniquement quand la requête arrive réellement en HTTPS : une
 * instance auto-hébergée servie en HTTP sur un LAN doit pouvoir ouvrir une
 * session. Forçable via `TANCHI_SECURE_COOKIES=true` derrière un reverse proxy
 * TLS qui termine le chiffrement en amont.
 */
function useSecureCookie(event: H3Event): boolean {
  if (process.env.TANCHI_SECURE_COOKIES === 'true') return true
  if (process.env.TANCHI_SECURE_COOKIES === 'false') return false

  return getRequestProtocol(event) === 'https'
}

export function createSession(event: H3Event, userId: number): string {
  const db = useDb()
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)

  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expires.toISOString())

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookie(event),
    expires
  })

  return token
}

export function destroySession(event: H3Event): void {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) useDb().prepare('DELETE FROM sessions WHERE token = ?').run(token)

  deleteCookie(event, SESSION_COOKIE, { path: '/' })

  // Sans cela, le miroir survivrait à la déconnexion et laisserait passer un
  // rendu de page protégée avant d'être corrigé par l'hydratation.
  for (const name of MIRROR_COOKIES) deleteCookie(event, name, { path: '/' })
}

/** Utilisateur courant, ou `null` si la session est absente / expirée. */
export function getCurrentUser(event: H3Event): UserRow | null {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const row = useDb().prepare(`
    SELECT u.* FROM users u
    JOIN sessions s ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as UserRow | undefined

  return row ?? null
}

/** Variante levant une 401 — pour les routes protégées. */
export function requireUser(event: H3Event): UserRow {
  const user = getCurrentUser(event)
  // `statusMessage` doit rester ASCII : h3 assainit ce champ.
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Non authentifié',
      data: { message: 'Non authentifié' }
    })
  }
  return user
}

/* --------------------------------------------------------- Sérialisation */

export interface PublicUser {
  id: number
  username: string
  email: string
  role: string
  avatar: string | null
  theme: string
  colorMode: string
  twoFactor: boolean
  /** Modules épinglés dans la barre latérale. */
  pinnedApps: string[]
  createdAt: string
}

function parsePinnedApps(raw: string | null): string[] {
  try {
    return normalizePinnedApps(JSON.parse(raw ?? '[]'))
  } catch {
    return []
  }
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    avatar: row.avatar_url,
    theme: row.theme,
    colorMode: row.color_mode,
    twoFactor: row.two_factor === 1,
    pinnedApps: parsePinnedApps(row.pinned_apps),
    createdAt: row.created_at
  }
}
