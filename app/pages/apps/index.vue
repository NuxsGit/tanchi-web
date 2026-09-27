<script setup lang="ts">
import { TANCHI_APPS, isPinnable, type AppStatus, type TanchiApp } from '~~/shared/apps'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Applications — Tanchi Web' })

const search = useSearch()
const toast = useToast()
const { pinned, isPinned, isFull, toggle, limit } = usePinnedApps()

// Les statuts sont modifiables localement pour les services externes ; le
// catalogue partagé reste la référence.
const apps = ref<TanchiApp[]>(TANCHI_APPS.map(app => ({ ...app })))

const filteredApps = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return apps.value
  return apps.value.filter(app =>
    app.name.toLowerCase().includes(q)
    || app.tagline.toLowerCase().includes(q)
    || String(app.port).includes(q)
  )
})

const activeCount = computed(() => apps.value.filter(a => a.status === 'active').length)

const statusMeta: Record<AppStatus, { label: string, color: 'success' | 'error' | 'neutral' }> = {
  active: { label: 'Actif', color: 'success' },
  inactive: { label: 'Inactif', color: 'error' },
  unavailable: { label: 'Bientôt', color: 'neutral' }
}

function launch(app: TanchiApp) {
  if (app.status === 'unavailable') {
    toast.add({
      title: `${app.name} arrive bientôt`,
      description: 'Module en préparation, non disponible pour l\'instant.',
      color: 'info'
    })
    return
  }

  if (app.to) return navigateTo(app.to)

  toast.add({
    title: app.status === 'active' ? `Ouverture de ${app.name}` : `${app.name} est inactif`,
    description: app.status === 'active'
      ? `Connexion au port ${app.port}…`
      : 'Démarrez le service avant de l\'ouvrir.',
    color: app.status === 'active' ? 'success' : 'warning'
  })
}

function toggleService(app: TanchiApp) {
  app.status = app.status === 'active' ? 'inactive' : 'active'
  toast.add({
    title: app.status === 'active' ? `${app.name} démarré` : `${app.name} arrêté`,
    color: app.status === 'active' ? 'success' : 'neutral'
  })
}

function configure(app: TanchiApp) {
  toast.add({ title: `Configuration de ${app.name}`, description: `Port d'écoute : ${app.port}`, color: 'info' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-ink">Écosystème Tanchi</h1>
        <p class="mt-1 max-w-2xl text-sm text-ink-muted">
          Une suite de modules indépendants qui partagent le même annuaire, le même
          réseau et la même console. Épinglez ceux que vous utilisez pour les retrouver
          dans la navigation.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UBadge
          :label="`${pinned.length}/${limit} épinglés`"
          :color="isFull ? 'warning' : 'neutral'"
          variant="subtle"
          size="lg"
        />
        <UBadge
          :label="`${activeCount} / ${apps.length} actifs`"
          color="success"
          variant="subtle"
          size="lg"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <UCard
        v-for="app in filteredApps"
        :key="app.id"
        class="flex h-full flex-col bg-surface ring-1 ring-line transition"
        :class="[
          app.status === 'unavailable' ? 'opacity-60' : 'hover:ring-accent/40',
          isPinned(app.id) ? 'ring-accent/40' : ''
        ]"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="flex size-11 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
            <UIcon :name="app.icon" class="size-5 text-accent" />
          </span>

          <div class="flex items-center gap-1">
            <UBadge
              :label="statusMeta[app.status].label"
              :color="statusMeta[app.status].color"
              variant="subtle"
              size="sm"
            />

            <!-- Épinglage dans la barre latérale -->
            <UButton
              v-if="isPinnable(app)"
              :icon="isPinned(app.id) ? 'i-lucide-pin-off' : 'i-lucide-pin'"
              :color="isPinned(app.id) ? 'primary' : 'neutral'"
              variant="ghost"
              size="xs"
              :aria-label="isPinned(app.id)
                ? `Retirer ${app.short} de la navigation`
                : `Épingler ${app.short} dans la navigation`"
              :title="isPinned(app.id)
                ? 'Retirer de la navigation'
                : 'Épingler dans la navigation'"
              @click="toggle(app.id)"
            />
          </div>
        </div>

        <h2 class="mt-4 font-medium text-ink">{{ app.name }}</h2>
        <p class="text-sm text-accent">{{ app.tagline }}</p>
        <p class="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{{ app.description }}</p>

        <div class="mt-4 flex items-center gap-3 text-xs text-ink-dim">
          <span class="flex items-center gap-1.5">
            <UIcon :name="app.to ? 'i-lucide-package-check' : 'i-lucide-plug'" class="size-3.5" />
            <span class="font-mono">
              {{ app.status === 'unavailable' ? 'Non disponible' : app.to ? 'Module intégré' : `Port ${app.port}` }}
            </span>
          </span>
          <span v-if="isPinned(app.id)" class="flex items-center gap-1.5 text-accent">
            <UIcon name="i-lucide-pin" class="size-3.5" />
            <span class="font-mono">épinglé</span>
          </span>
        </div>

        <template #footer>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              :icon="app.to ? 'i-lucide-arrow-right' : 'i-lucide-external-link'"
              color="primary"
              size="sm"
              :label="app.status === 'unavailable' ? 'Bientôt' : 'Lancer'"
              :disabled="app.status !== 'active'"
              @click="launch(app)"
            />
            <UButton
              icon="i-lucide-sliders-horizontal"
              color="neutral"
              variant="outline"
              size="sm"
              label="Configurer"
              :disabled="app.status === 'unavailable'"
              @click="configure(app)"
            />
            <UButton
              v-if="!app.to && app.status !== 'unavailable'"
              :icon="app.status === 'active' ? 'i-lucide-square' : 'i-lucide-play'"
              :aria-label="app.status === 'active' ? 'Arrêter le service' : 'Démarrer le service'"
              color="neutral"
              variant="ghost"
              size="sm"
              class="ml-auto"
              @click="toggleService(app)"
            />
          </div>
        </template>
      </UCard>
    </div>

    <UCard v-if="!filteredApps.length" class="bg-surface ring-1 ring-line">
      <p class="py-6 text-center text-sm text-ink-dim">
        Aucune application ne correspond à « {{ search }} ».
      </p>
    </UCard>
  </div>
</template>
