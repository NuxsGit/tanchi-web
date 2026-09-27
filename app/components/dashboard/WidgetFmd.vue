<script setup lang="ts">
const { data } = useDashboard()
const fmd = computed(() => data.value?.fmd ?? { matrices: 0, flows: 0, allow: 0, deny: 0, conflicts: 0 })

const cells = computed(() => [
  { label: 'Flux', value: fmd.value.flows, tone: 'text-ink' },
  { label: 'Allow', value: fmd.value.allow, tone: 'text-success-500' },
  { label: 'Deny', value: fmd.value.deny, tone: 'text-error-500' },
  { label: 'Conflits', value: fmd.value.conflicts, tone: 'text-warning-500' }
])
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="grid flex-1 grid-cols-2 content-start gap-2">
      <div
        v-for="cell in cells"
        :key="cell.label"
        class="rounded-md border border-line bg-canvas px-2.5 py-2"
      >
        <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">{{ cell.label }}</p>
        <p class="mt-0.5 text-xl font-semibold" :class="cell.tone">{{ cell.value }}</p>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-between">
      <span class="font-mono text-[10px] text-ink-dim">
        {{ fmd.matrices }} matrice{{ fmd.matrices > 1 ? 's' : '' }}
      </span>
      <UButton
        to="/apps/fmd"
        icon="i-lucide-arrow-right"
        color="neutral"
        variant="ghost"
        size="xs"
        label="Ouvrir"
      />
    </div>
  </div>
</template>
