<script setup lang="ts">
const { exportJson, exportCsv, importJson, generateBulkAd, resetWorkspace, exportFeedback } = useFmd()

const confirmReset = ref(false)

const fileInput = ref<HTMLInputElement>()

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await importJson(file)
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-medium text-ink">Import / Export</h3>

    <div class="space-y-2">
      <UButton
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        size="sm"
        block
        label="Importer JSON"
        @click="fileInput?.click()"
      />
      <UButton
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        size="sm"
        block
        label="Exporter JSON"
        @click="exportJson()"
      />
      <UButton
        icon="i-lucide-table"
        color="neutral"
        variant="outline"
        size="sm"
        block
        label="Exporter CSV"
        @click="exportCsv()"
      />
      <UButton
        icon="i-lucide-zap"
        color="primary"
        variant="soft"
        size="sm"
        block
        label="Générer le pack Bulk AD"
        @click="generateBulkAd()"
      />
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onFileChange"
    >

    <USeparator />

    <UButton
      icon="i-lucide-rotate-ccw"
      color="error"
      variant="ghost"
      size="sm"
      block
      label="Réinitialiser l'espace de travail"
      @click="confirmReset = true"
    />

    <UModal v-model:open="confirmReset" title="Réinitialiser l'espace de travail ?">
      <template #body>
        <p class="text-sm text-ink-muted">
          Toutes vos matrices, sections et objets réseau seront supprimés de votre
          compte. Cette action est irréversible.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="confirmReset = false" />
          <UButton
            color="error"
            icon="i-lucide-rotate-ccw"
            label="Réinitialiser"
            @click="resetWorkspace(); confirmReset = false"
          />
        </div>
      </template>
    </UModal>

    <p v-if="exportFeedback" class="rounded-md border border-line bg-raised p-2 text-xs text-ink-muted">
      {{ exportFeedback }}
    </p>
  </div>
</template>
