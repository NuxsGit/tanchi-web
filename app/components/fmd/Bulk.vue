<script setup lang="ts">
const {
  selectedFlowIds, bulkField, bulkValue, sections,
  applyBulkEdit, bulkSwapSrcDst
} = useFmd()

/** Même sentinelle que le composeur : pas de SelectItem à valeur vide. */
const NO_SECTION = '__none__'

const fieldItems = [
  { label: 'Action', value: 'action' },
  { label: 'Statut', value: 'status' },
  { label: 'Section', value: 'sectionId' },
  { label: 'Zone source', value: 'fromZone' },
  { label: 'Zone destination', value: 'toZone' }
]

const valueItems = computed(() => {
  if (bulkField.value === 'action') {
    return [{ label: 'ALLOW', value: 'ALLOW' }, { label: 'DENY', value: 'DENY' }]
  }
  if (bulkField.value === 'status') {
    return [
      { label: 'PENDING', value: 'PENDING' },
      { label: 'APPROUVÉ', value: 'APPROVED' },
      { label: 'REFUSÉ', value: 'REJECTED' }
    ]
  }
  if (bulkField.value === 'sectionId') {
    return [
      { label: '— Sans section —', value: NO_SECTION },
      ...sections.value.map(section => ({ label: section.name, value: section.id }))
    ]
  }
  return null
})

const bulkModel = computed({
  get: () => bulkValue.value || NO_SECTION,
  set: (value: string) => { bulkValue.value = value === NO_SECTION ? '' : value }
})

// Une valeur cohérente avec le champ choisi, sinon le select reste vide.
watch(bulkField, () => {
  bulkValue.value = valueItems.value?.[0]?.value ?? ''
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-ink">Édition groupée</h3>
      <UBadge
        v-if="selectedFlowIds.length"
        :label="`${selectedFlowIds.length} règle(s)`"
        color="primary"
        variant="subtle"
        size="sm"
      />
    </div>

    <div v-if="!selectedFlowIds.length" class="rounded-lg border border-dashed border-line p-6 text-center">
      <UIcon name="i-lucide-list-checks" class="mx-auto size-6 text-ink-dim" />
      <p class="mt-3 text-sm text-ink-muted">
        Cochez des lignes dans le tableau pour activer l'édition groupée.
      </p>
    </div>

    <template v-else>
      <UFormField label="Champ à modifier">
        <USelect v-model="bulkField" :items="fieldItems" size="sm" class="w-full" />
      </UFormField>

      <UFormField label="Nouvelle valeur">
        <USelect v-if="valueItems" v-model="bulkModel" :items="valueItems" size="sm" class="w-full" />
        <UInput v-else v-model="bulkValue" placeholder="Ex : TRUST" size="sm" class="w-full" />
      </UFormField>

      <UButton
        color="primary"
        size="sm"
        block
        :label="`Appliquer aux ${selectedFlowIds.length} règle(s)`"
        @click="applyBulkEdit()"
      />

      <USeparator />

      <UButton
        icon="i-lucide-arrow-left-right"
        color="neutral"
        variant="outline"
        size="sm"
        block
        label="Inverser Src ↔ Dst"
        @click="bulkSwapSrcDst()"
      />

      <UButton
        icon="i-lucide-x"
        color="error"
        variant="ghost"
        size="sm"
        block
        label="Désélectionner tout"
        @click="selectedFlowIds = []"
      />
    </template>
  </div>
</template>
