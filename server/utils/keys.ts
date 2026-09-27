import { randomBytes } from 'node:crypto'
import type { ApiKeyRow } from './db'

export interface PublicApiKey {
  id: number
  name: string
  masked: string
  createdAt: string
  lastUsed: string | null
}

export function generateSecret(prefix = 'tnc_live'): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`
}

export function maskSecret(secret: string): string {
  const [prefix, scope, body = ''] = secret.split('_')
  return `${prefix}_${scope}_••••${body.slice(-4)}`
}

export function toPublicKey(row: ApiKeyRow): PublicApiKey {
  return {
    id: row.id,
    name: row.name,
    masked: row.masked,
    createdAt: row.created_at,
    lastUsed: row.last_used
  }
}
