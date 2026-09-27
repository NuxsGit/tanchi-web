export type ServiceStatus = 'running' | 'stopped' | 'restarting' | 'unhealthy'

export interface Container {
  id: string
  name: string
  image: string
  status: ServiceStatus
  uptime: string
  cpu: number
  memory: string
}

export interface Metric {
  key: string
  label: string
  value: string
  raw: number
  icon: string
  badge: string
  badgeColor: 'success' | 'warning' | 'error' | 'info'
  hint: string
}

export interface AuthUser {
  username: string
  email: string
  role: string
}

export interface ApiKey {
  id: string
  name: string
  masked: string
  secret: string
  createdAt: string
  lastUsed: string
}

// Le catalogue des applications vit dans `shared/apps.ts` (source unique
// partagée avec la navigation et le serveur).
export type { AppStatus, TanchiApp } from '~~/shared/apps'
