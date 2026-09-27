<script setup lang="ts">
const { stats } = useFmd()

const cards = computed(() => [
  { key: 'total', label: 'Flux', value: stats.value.total, icon: 'i-lucide-git-branch', tone: 'neutral' },
  { key: 'allow', label: 'Allow', value: stats.value.allow, icon: 'i-lucide-shield-check', tone: 'success' },
  { key: 'deny', label: 'Deny', value: stats.value.deny, icon: 'i-lucide-shield-x', tone: 'error' },
  { key: 'conflicts', label: 'Conflits', value: stats.value.conflicts, icon: 'i-lucide-triangle-alert', tone: 'warning' }
] as const)

const borderClass: Record<string, string> = {
  neutral: 'border-t-line-strong',
  success: 'border-t-success-500',
  error: 'border-t-error-500',
  warning: 'border-t-warning-500'
}

const toneClass: Record<string, string> = {
  neutral: 'text-ink',
  success: 'text-success-500',
  error: 'text-error-500',
  warning: 'text-warning-500'
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <UCard
      v-for="card in cards"
      :key="card.key"
      class="overflow-hidden border-t-2 bg-surface ring-1 ring-line"
      :class="borderClass[card.tone]"
      :ui="{ body: 'p-4 sm:p-4' }"
    >
      <div class="flex items-center justify-between text-sm text-ink-muted">
        <span class="font-mono text-[11px] uppercase tracking-wider">{{ card.label }}</span>
        <UIcon :name="card.icon" class="size-4" :class="toneClass[card.tone]" />
      </div>
      <p class="mt-2 text-3xl font-semibold tracking-tight" :class="toneClass[card.tone]">
        {{ card.value }}
      </p>
    </UCard>
  </div>
</template>
