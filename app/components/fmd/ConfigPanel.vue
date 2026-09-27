<script setup lang="ts">
const { juniperConfig } = useFmd()
const toast = useToast()

async function copyConfig() {
  try {
    await navigator.clipboard.writeText(juniperConfig.value)
    toast.add({ title: 'Configuration copiée', color: 'success' })
  } catch {
    toast.add({ title: 'Copie impossible', color: 'error' })
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-ink">Config Juniper SRX</h3>
      <UButton
        icon="i-lucide-copy"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Copier la configuration"
        @click="copyConfig"
      />
    </div>

    <pre class="min-h-0 flex-1 overflow-auto rounded-md border border-line bg-raised p-3 font-mono text-[11px] leading-relaxed text-ink-muted">{{ juniperConfig }}</pre>
  </div>
</template>
