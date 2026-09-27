import type { PublicUser } from '~~/server/utils/auth'

/** Empreinte de session exposée au client (le vrai jeton reste httpOnly). */
export interface AuthUser {
  username: string
  email: string
  avatar: string | null
  role: string
  /** Palette enregistrée sur le compte, appliquée par `app.vue`. */
  theme: string
  /** Modules épinglés dans la barre latérale. */
  pinnedApps: string[]
}

interface SessionResponse { user: PublicUser | null }

const COOKIE_OPTIONS = {
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7
}

/**
 * Session adossée à la base SQLite locale.
 *
 * Le cookie de session réel est httpOnly. `tanchi_token` en est un miroir
 * lisible, qui permet au middleware de trancher sans aller-retour réseau.
 *
 * Le profil lui-même n'est **pas** mis en cookie : sérialiser un objet dans un
 * cookie pendant le rendu serveur bloque l'émission de la réponse, et cela
 * dupliquerait inutilement l'email de l'utilisateur dans un cookie lisible en
 * JavaScript. Il vit dans `useState`, hydraté par `plugins/session.ts`.
 */
export const useAuth = () => {
  const token = useCookie<string | null>('tanchi_token', COOKIE_OPTIONS)
  const user = useState<AuthUser | null>('tanchi-auth-user', () => null)
  const ready = useState<boolean>('tanchi-auth-ready', () => false)
  const isLoggedIn = computed(() => user.value !== null)

  const applyUser = (value: PublicUser | null) => {
    if (!value) {
      user.value = null
      token.value = null
      return
    }

    const profile: AuthUser = {
      username: value.username,
      email: value.email,
      avatar: value.avatar,
      role: value.role,
      theme: value.theme,
      pinnedApps: value.pinnedApps ?? []
    }

    user.value = profile
    token.value = `session-${value.id}`
  }

  /** Hydrate la session depuis le serveur (une fois par cycle de vie). */
  const fetchSession = async () => {
    // `useRequestFetch` réémet les cookies entrants et court-circuite la
    // requête HTTP côté serveur, au lieu de rappeler l'application sur elle-même.
    const request = useRequestFetch()
    try {
      const { user: current } = await request<SessionResponse>('/api/auth/session')
      applyUser(current)
    } catch {
      applyUser(null)
    } finally {
      ready.value = true
    }
  }

  const login = async (email: string, password: string) => {
    const { user: current } = await $fetch<SessionResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    applyUser(current)
    return navigateTo('/dashboard')
  }

  const register = async (username: string, email: string, password: string) => {
    const { user: current } = await $fetch<SessionResponse>('/api/auth/register', {
      method: 'POST',
      body: { username, email, password }
    })
    applyUser(current)
    return navigateTo('/dashboard')
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    applyUser(null)
    return navigateTo('/login')
  }

  return { user, token, ready, isLoggedIn, fetchSession, applyUser, login, register, logout }
}
