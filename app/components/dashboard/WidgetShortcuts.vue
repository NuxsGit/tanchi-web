<script setup lang="ts">
const links = [
  { to: '/apps/tasks', label: 'TaskTeam', icon: 'i-lucide-square-kanban' },
  { to: '/apps/fmd', label: 'FlowMatrix', icon: 'i-lucide-git-fork' },
  { to: '/teams', label: 'Équipes', icon: 'i-lucide-users' },
  { to: '/apps', label: 'Applications', icon: 'i-lucide-layout-grid' },
  { to: '/settings', label: 'Paramètres', icon: 'i-lucide-settings' }
]
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-2 transition hover:border-accent/50"
    >
      <UIcon :name="link.icon" class="size-3.5 shrink-0 text-accent" />
      <span class="truncate text-xs text-ink">{{ link.label }}</span>
    </NuxtLink>
  </div>
</template>
