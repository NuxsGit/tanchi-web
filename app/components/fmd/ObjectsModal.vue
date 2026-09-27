<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const open = defineModel<boolean>('open', { default: false })

const { objects, addAddressObject, removeAddressObject, addServiceObject, removeServiceObject } = useFmd()
const toast = useToast()

const tab = ref('addresses')

const tabs = computed<TabsItem[]>(() => [
  { value: 'addresses', slot: 'addresses', label: `Adresses (${objects.value.addresses.length})` },
  { value: 'services', slot: 'services', label: `Services (${objects.value.services.length})` }
])

const addressDraft = reactive({ name: '', value: '', comment: '' })
const serviceDraft = reactive({ name: '', protocol: '', port: '', comment: '' })

function submitAddress() {
  if (!addressDraft.name.trim() || !addressDraft.value.trim()) {
    toast.add({ title: 'Nom et valeur requis', color: 'warning' })
    return
  }
  if (!addAddressObject({ ...addressDraft })) {
    toast.add({ title: 'Cet objet existe déjà', color: 'warning' })
    return
  }
  Object.assign(addressDraft, { name: '', value: '', comment: '' })
}

function submitService() {
  if (!serviceDraft.name.trim() || (!serviceDraft.protocol.trim() && !serviceDraft.port.trim())) {
    toast.add({ title: 'Nom et protocole (ou port) requis', color: 'warning' })
    return
  }
  if (!addServiceObject({ ...serviceDraft })) {
    toast.add({ title: 'Ce service existe déjà', color: 'warning' })
    return
  }
  Object.assign(serviceDraft, { name: '', protocol: '', port: '', comment: '' })
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Objets réseau"
    description="Références réutilisables pour les sources, destinations et services."
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UTabs v-model="tab" :items="tabs" variant="link" :unmount-on-hide="false" class="w-full">
        <!-- Adresses -->
        <template #addresses>
          <div class="mt-4 space-y-4">
            <div v-if="objects.addresses.length" class="max-h-64 space-y-1 overflow-y-auto">
              <div
                v-for="address in objects.addresses"
                :key="address.id"
                class="flex items-start gap-3 rounded-md border border-line bg-raised px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-ink">{{ address.name }}</p>
                  <p class="truncate font-mono text-xs text-ink-muted">{{ address.value }}</p>
                  <p v-if="address.comment" class="truncate text-xs text-ink-dim">{{ address.comment }}</p>
                </div>
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Supprimer ${address.name}`"
                  @click="removeAddressObject(address.id)"
                />
              </div>
            </div>
            <p v-else class="text-sm text-ink-dim">Aucune adresse enregistrée.</p>

            <div class="grid grid-cols-2 gap-2">
              <UInput v-model="addressDraft.name" placeholder="Nom objet" size="sm" />
              <UInput v-model="addressDraft.value" placeholder="IP, CIDR ou hostname" size="sm" />
              <UInput
                v-model="addressDraft.comment"
                placeholder="Commentaire optionnel"
                size="sm"
                class="col-span-2"
                @keydown.enter="submitAddress"
              />
            </div>

            <UButton color="primary" size="sm" label="Ajouter l'adresse" @click="submitAddress" />
          </div>
        </template>

        <!-- Services -->
        <template #services>
          <div class="mt-4 space-y-4">
            <div v-if="objects.services.length" class="max-h-64 space-y-1 overflow-y-auto">
              <div
                v-for="service in objects.services"
                :key="service.id"
                class="flex items-start gap-3 rounded-md border border-line bg-raised px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-ink">{{ service.name }}</p>
                  <p class="truncate font-mono text-xs text-ink-muted">
                    {{ service.protocol || '—' }}{{ service.port ? ` · ${service.port}` : '' }}
                  </p>
                  <p v-if="service.comment" class="truncate text-xs text-ink-dim">{{ service.comment }}</p>
                </div>
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Supprimer ${service.name}`"
                  @click="removeServiceObject(service.id)"
                />
              </div>
            </div>
            <p v-else class="text-sm text-ink-dim">Aucun service enregistré.</p>

            <div class="grid grid-cols-2 gap-2">
              <UInput v-model="serviceDraft.name" placeholder="Nom service" size="sm" />
              <UInput v-model="serviceDraft.protocol" placeholder="443/TCP ou any" size="sm" />
              <UInput v-model="serviceDraft.port" placeholder="Port optionnel" size="sm" />
              <UInput
                v-model="serviceDraft.comment"
                placeholder="Commentaire optionnel"
                size="sm"
                @keydown.enter="submitService"
              />
            </div>

            <UButton color="primary" size="sm" label="Ajouter le service" @click="submitService" />
          </div>
        </template>
      </UTabs>
    </template>
  </UModal>
</template>
