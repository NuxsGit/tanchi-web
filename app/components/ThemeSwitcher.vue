<script setup lang="ts">
const { family, families, mode, setFamily } = useTheme()

const modes = [
  { value: 'dark', icon: 'i-lucide-moon', label: 'Sombre' },
  { value: 'light', icon: 'i-lucide-sun', label: 'Clair' },
  { value: 'system', icon: 'i-lucide-monitor', label: 'Système' }
] as const
</script>

<template>
  <div class="flex items-center gap-1">
    <div class="flex rounded-md border border-line p-0.5">
      <button
        v-for="option in modes"
        :key="option.value"
        type="button"
        class="rounded p-1.5 transition"
        :class="mode === option.value ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:text-ink'"
        :aria-label="option.label"
        :title="option.label"
        @click="mode = option.value"
      >
        <UIcon :name="option.icon" class="size-3.5 block" />
      </button>
    </div>

    <button
      v-for="option in families"
      :key="option.id"
      type="button"
      class="rounded-md border px-2 py-1 text-[11px] font-medium uppercase tracking-wider transition"
      :class="family === option.id
        ? 'border-accent bg-accent-soft text-accent'
        : 'border-line text-ink-dim hover:text-ink'"
      :title="option.description"
      @click="setFamily(option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
