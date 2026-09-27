<script setup lang="ts">
const { user, logout } = useAuth()
const { collapsed, mobileOpen, toggle } = useSidebar()
</script>

<template>
  <!-- Barre fixe : le logo en haut et le profil en bas restent toujours visibles,
       seule la navigation défile si elle déborde. -->
  <aside
    class="sticky top-0 hidden h-screen shrink-0 self-start flex-col overflow-hidden border-r border-line bg-surface transition-[width] duration-200 lg:flex"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <div class="flex h-16 shrink-0 items-center gap-2 border-b border-line" :class="collapsed ? 'justify-center px-0' : 'px-5'">
      <NuxtLink to="/" class="flex items-center gap-2" :title="collapsed ? 'Tanchi Web' : undefined">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft ring-1 ring-accent/40">
          <UIcon name="i-lucide-server-cog" class="size-4 text-accent" />
        </span>
        <span v-if="!collapsed" class="font-semibold tracking-tight">Tanchi Web</span>
      </NuxtLink>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto py-4" :class="collapsed ? 'px-2' : 'px-3'">
      <AppNav :collapsed="collapsed" />
    </div>

    <!-- Profil et déconnexion -->
    <div class="shrink-0 border-t border-line" :class="collapsed ? 'p-2' : 'p-3'">
      <template v-if="collapsed">
        <div class="flex flex-col items-center gap-2">
          <UAvatar :src="user?.avatar || undefined" :alt="user?.username" size="sm" :title="user?.username" />
          <UButton
            icon="i-lucide-log-out"
            color="error"
            variant="ghost"
            size="xs"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            @click="logout()"
          />
        </div>
      </template>

      <div v-else class="rounded-lg border border-line bg-raised p-3">
        <NuxtLink to="/settings" class="flex items-center gap-3">
          <UAvatar :src="user?.avatar || undefined" :alt="user?.username" size="md" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink">{{ user?.username ?? '—' }}</p>
            <p class="truncate text-xs text-ink-dim">{{ user?.email ?? '' }}</p>
          </div>
        </NuxtLink>

        <UButton
          icon="i-lucide-log-out"
          color="error"
          variant="soft"
          size="sm"
          block
          class="mt-3"
          label="Se déconnecter"
          @click="logout()"
        />
      </div>

      <UButton
        :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        color="neutral"
        variant="ghost"
        size="xs"
        :block="!collapsed"
        class="mt-2"
        :label="collapsed ? undefined : 'Replier'"
        :aria-label="collapsed ? 'Déplier la navigation' : 'Replier la navigation'"
        @click="toggle()"
      />
    </div>
  </aside>

  <!-- Tiroir mobile : même navigation, ouverte depuis l'en-tête -->
  <USlideover v-model:open="mobileOpen" side="left" title="Navigation" :ui="{ content: 'max-w-72' }">
    <template #body>
      <AppNav @navigate="mobileOpen = false" />
    </template>

    <template #footer>
      <div class="w-full">
        <NuxtLink to="/settings" class="flex items-center gap-3" @click="mobileOpen = false">
          <UAvatar :src="user?.avatar || undefined" :alt="user?.username" size="md" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink">{{ user?.username ?? '—' }}</p>
            <p class="truncate text-xs text-ink-dim">{{ user?.email ?? '' }}</p>
          </div>
        </NuxtLink>
        <UButton
          icon="i-lucide-log-out"
          color="error"
          variant="soft"
          size="sm"
          block
          class="mt-3"
          label="Se déconnecter"
          @click="logout()"
        />
      </div>
    </template>
  </USlideover>
</template>
