<script setup lang="ts">
import { buildNavigation, isLinkActive } from '~~/shared/navigation'

withDefaults(defineProps<{
  placeholder?: string
  status?: string
}>(), {
  placeholder: 'Rechercher un service, une application, un log…',
  status: 'Système opérationnel'
})

const search = useSearch()
const { mobileOpen } = useSidebar()
const { user } = useAuth()
const route = useRoute()

/** Section et page courantes, pour situer l'utilisateur en un coup d'œil. */
const breadcrumb = computed(() => {
  for (const section of buildNavigation(user.value?.pinnedApps ?? [])) {
    const link = section.links.find(item => isLinkActive(item, route.path))
    if (link) return { section: section.label, page: link.label }
  }
  return null
})
</script>

<template>
  <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur sm:px-6">
    <UButton
      icon="i-lucide-menu"
      color="neutral"
      variant="ghost"
      class="lg:hidden"
      aria-label="Ouvrir la navigation"
      @click="mobileOpen = true"
    />

    <div v-if="breadcrumb" class="hidden min-w-0 items-center gap-2 md:flex">
      <span class="font-mono text-[11px] uppercase tracking-wider text-ink-dim">
        {{ breadcrumb.section }}
      </span>
      <span class="text-ink-dim">/</span>
      <span class="truncate text-sm font-medium text-ink">{{ breadcrumb.page }}</span>
    </div>

    <UInput
      v-model="search"
      icon="i-lucide-search"
      :placeholder="placeholder"
      class="ml-auto w-full max-w-xs"
      size="md"
    />

    <div class="flex shrink-0 items-center gap-2">
      <UBadge color="success" variant="subtle" size="lg" class="hidden xl:inline-flex">
        <span class="relative mr-2 flex size-2">
          <span class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span class="relative inline-flex size-2 rounded-full bg-current" />
        </span>
        {{ status }}
      </UBadge>

      <UButton icon="i-lucide-bell" color="neutral" variant="ghost" aria-label="Notifications" />
    </div>
  </header>
</template>
