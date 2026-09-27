import type { PublicApiKey } from '~~/server/utils/keys'

export const useApiKeys = () => {
  const keys = useState<PublicApiKey[]>('tanchi-api-keys', () => [])
  const pending = ref(false)

  const refresh = async () => {
    pending.value = true
    try {
      const { keys: rows } = await $fetch<{ keys: PublicApiKey[] }>('/api/keys')
      keys.value = rows
    } finally {
      pending.value = false
    }
  }

  const create = async (name: string) => {
    const res = await $fetch<{ key: PublicApiKey, secret: string }>('/api/keys', {
      method: 'POST',
      body: { name }
    })
    keys.value = [res.key, ...keys.value]
    return res
  }

  const reveal = async (id: number) => {
    const { secret } = await $fetch<{ secret: string }>(`/api/keys/${id}/reveal`, { method: 'POST' })
    await refresh()
    return secret
  }

  const revoke = async (id: number) => {
    await $fetch(`/api/keys/${id}`, { method: 'DELETE' })
    keys.value = keys.value.filter(k => k.id !== id)
  }

  return { keys, pending, refresh, create, reveal, revoke }
}
