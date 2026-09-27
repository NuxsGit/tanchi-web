<script setup lang="ts">
import { getApplicationProtocol, normalize, normalizeProtocol } from '~~/shared/fmd'

const {
  form, editingFlowId, sections, canSubmit, protocolIsValid,
  addressOptions, serviceOptions, objects,
  submitFlow, resetForm, swapSourceDestination, addSection
} = useFmd()

const emit = defineEmits<{ openObjects: [] }>()

/**
 * Renseigne le protocole automatiquement à la saisie d'une application connue,
 * sans jamais écraser une valeur saisie à la main.
 */
watch(() => form.value.application, (application) => {
  if (normalize(form.value.protocol)) return

  const builtIn = getApplicationProtocol(application)
  const service = objects.value.services.find(
    item => item.name.toLowerCase() === normalize(application).toLowerCase()
  )
  const fromObject = service?.protocol
    ? normalizeProtocol(service.protocol)
    : service?.port && service?.protocol
      ? normalizeProtocol(`${service.port}/${service.protocol}`)
      : ''

  const protocol = builtIn || fromObject
  if (protocol) form.value = { ...form.value, protocol }
})

const actionItems = [
  { label: 'ALLOW', value: 'ALLOW' },
  { label: 'DENY', value: 'DENY' }
]

/** Reka UI refuse un SelectItem de valeur vide : sentinelle explicite. */
const NO_SECTION = '__none__'

const sectionItems = computed(() => [
  { label: '— aucune —', value: NO_SECTION },
  ...sections.value.map(section => ({ label: section.name, value: section.id }))
])

const sectionModel = computed({
  get: () => form.value.sectionId || NO_SECTION,
  set: (value: string) => { form.value.sectionId = value === NO_SECTION ? '' : value }
})

const sectionModalOpen = ref(false)
const newSectionName = ref('')

function createSectionFromModal() {
  if (!normalize(newSectionName.value)) return
  addSection(newSectionName.value)
  newSectionName.value = ''
  sectionModalOpen.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-ink">
        {{ editingFlowId ? 'Modifier le flux' : 'Nouveau flux' }}
      </h3>
      <div class="flex gap-1">
        <UButton
          icon="i-lucide-box"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Objets réseau"
          title="Objets réseau"
          @click="emit('openObjects')"
        />
        <UButton
          icon="i-lucide-arrow-left-right"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Inverser source et destination"
          title="Inverser Src ↔ Dst"
          @click="swapSourceDestination()"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Rule Name" class="col-span-2">
        <UInput v-model="form.ruleName" placeholder="ALLOW-LDAP-USERS" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Source" required>
        <UInput
          v-model="form.source"
          placeholder="USERS"
          size="sm"
          class="w-full"
          list="fmd-address-list"
        />
      </UFormField>

      <UFormField label="Nom src">
        <UInput v-model="form.nomSource" placeholder="optionnel" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Destination" required>
        <UInput
          v-model="form.destination"
          placeholder="AD01"
          size="sm"
          class="w-full"
          list="fmd-address-list"
        />
      </UFormField>

      <UFormField label="Nom dst">
        <UInput v-model="form.nomDestination" placeholder="optionnel" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Application">
        <UInput
          v-model="form.application"
          placeholder="HTTPS, LDAP…"
          size="sm"
          class="w-full"
          list="fmd-application-list"
        />
      </UFormField>

      <UFormField
        label="Protocole"
        required
        :error="protocolIsValid ? undefined : 'Format attendu : 443/TCP, 1000-2000/UDP ou any'"
      >
        <UInput v-model="form.protocol" placeholder="443/TCP" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Action">
        <USelect v-model="form.action" :items="actionItems" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Section">
        <div class="flex gap-1">
          <USelect v-model="sectionModel" :items="sectionItems" size="sm" class="min-w-0 flex-1" />
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Nouvelle section"
            @click="sectionModalOpen = true"
          />
        </div>
      </UFormField>

      <UFormField label="Zone src">
        <UInput v-model="form.fromZone" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Zone dst">
        <UInput v-model="form.toZone" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="NAT src">
        <UInput v-model="form.natSrc" placeholder="203.0.113.1" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="NAT dst">
        <UInput v-model="form.natDst" placeholder="10.0.0.5:8080" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Commentaire" class="col-span-2">
        <UTextarea v-model="form.comment" :rows="2" size="sm" class="w-full" />
      </UFormField>
    </div>

    <div class="flex gap-2">
      <UButton
        color="primary"
        size="sm"
        block
        :disabled="!canSubmit"
        :label="editingFlowId ? 'Mettre à jour' : 'Ajouter'"
        @click="submitFlow()"
      />
      <UButton
        v-if="editingFlowId"
        color="neutral"
        variant="outline"
        size="sm"
        label="Annuler"
        @click="resetForm()"
      />
    </div>

    <!-- Autocomplétion native, alimentée par les objets réseau de la matrice -->
    <datalist id="fmd-address-list">
      <option v-for="item in addressOptions" :key="item" :value="item" />
    </datalist>
    <datalist id="fmd-application-list">
      <option v-for="item in serviceOptions" :key="item" :value="item" />
    </datalist>

    <UModal v-model:open="sectionModalOpen" title="Nouvelle section">
      <template #body>
        <UFormField label="Nom de la section" required>
          <UInput
            v-model="newSectionName"
            placeholder="Zone DMZ"
            size="lg"
            class="w-full"
            autofocus
            @keydown.enter="createSectionFromModal"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="sectionModalOpen = false" />
          <UButton color="primary" label="Créer" @click="createSectionFromModal" />
        </div>
      </template>
    </UModal>
  </div>
</template>
