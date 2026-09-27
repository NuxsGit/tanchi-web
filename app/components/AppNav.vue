<script setup lang="ts">
import { buildNavigation, isLinkActive, type NavLink } from '~~/shared/navigation'

withDefaults(defineProps<{
  /** Rail d'icônes : libellés masqués, infobulles à la place. */
  collapsed?: boolean
}>(), { collapsed: false })

const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const { user } = useAuth()

const sections = computed(() => buildNavigation(user.value?.pinnedApps ?? []))
const active = (link: NavLink) => isLinkActive(link, route.path)
</script>

<template>
  <nav class="space-y-6" aria-label="Navigation principale">
    <div v-for="section in sections" :key="section.id">
      <p
        v-if="!collapsed"
        class="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-dim"
      >
        {{ section.label }}
      </p>
      <div v-else class="mx-3 mb-2 border-t border-line" :aria-label="section.label" />

      <ul class="space-y-0.5">
        <li v-for="link in section.links" :key="link.to + link.short">
          <NuxtLink
            :to="link.to"
            class="group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition"
            :class="[
              active(link)
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:bg-raised hover:text-ink',
              collapsed ? 'justify-center px-0' : ''
            ]"
            :title="collapsed ? link.label : undefined"
            :aria-current="active(link) ? 'page' : undefined"
            @click="emit('navigate')"
          >
            <!-- Repère d'état actif, lisible même en mode rail -->
            <span
              class="absolute left-0 h-5 w-0.5 rounded-r bg-accent transition-opacity"
              :class="active(link) ? 'opacity-100' : 'opacity-0'"
              aria-hidden="true"
            />
            <UIcon :name="link.icon" class="size-4 shrink-0" />
            <span v-if="!collapsed" class="flex-1 truncate text-left">{{ link.short }}</span>
            <UBadge
              v-if="!collapsed && link.badge"
              :label="link.badge"
              size="sm"
              variant="subtle"
              color="neutral"
            />
          </NuxtLink>
        </li>
      </ul>

      <!-- Section Applications réduite au hub : on indique où épingler -->
      <p
        v-if="!collapsed && section.empty && section.links.length === 1"
        class="px-3 pt-2 text-[11px] leading-snug text-ink-dim"
      >
        {{ section.empty }}
      </p>
    </div>
  </nav>
</template>
