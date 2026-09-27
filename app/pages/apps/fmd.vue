<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

useHead({ title: 'FlowMatrix Designer — Tanchi Web' })

const fmd = useFmd()
const {
  matrices, activeMatrixId, loaded, activeMatrix, load, save, undo,
  scope, teamId, switchScope, conflict, savedLabel, acceptRemote, overwriteRemote
} = fmd

const { teams, ensure } = useTeams()
onMounted(ensure)

const scopeItems = computed(() => [
  { label: 'Brouillon personnel', value: 'user' },
  ...teams.value.map(team => ({ label: `Équipe · ${team.name}`, value: `team:${team.id}` }))
])

const scopeModel = computed({
  get: () => (scope.value === 'team' && teamId.value ? `team:${teamId.value}` : 'user'),
  set: (value: string) => {
    if (value === 'user') return void switchScope('user')
    void switchScope('team', Number(value.split(':')[1]))
  }
})

await useAsyncData('fmd-workspace', () => load().then(() => true), { server: false })

/**
 * Autosauvegarde différée : chaque mutation de matrice réarme un minuteur,
 * une seule requête part une fois la saisie terminée.
 */
let saveTimer: ReturnType<typeof setTimeout> | undefined

watch(
  [matrices, activeMatrixId],
  () => {
    if (!loaded.value) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => save(), 900)
  },
  { deep: true }
)

onBeforeUnmount(() => clearTimeout(saveTimer))

// Ctrl+Z pour annuler, Ctrl+S pour forcer la sauvegarde.
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const inField = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement

  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey && !inField) {
    event.preventDefault()
    undo()
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    save(false)
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="space-y-5">
    <header class="overflow-hidden rounded-xl border border-line bg-surface">
      <div class="flex items-center justify-between border-b border-line px-4 py-2">
        <div class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
          <NuxtLink to="/apps" class="transition hover:text-ink">applications</NuxtLink>
          <span>/</span>
          <span class="text-accent">fmd</span>
        </div>
        <span class="font-mono text-[11px] text-ink-dim">{{ savedLabel }}</span>
      </div>

      <div class="flex flex-wrap items-start justify-between gap-6 p-5">
        <div class="max-w-2xl">
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
              <UIcon name="i-lucide-git-fork" class="size-4.5 text-accent" />
            </span>
            <h1 class="text-xl font-semibold tracking-tight text-ink">
              Tanchi FlowMatrix Designer
            </h1>
          </div>
          <p class="mt-3 text-sm leading-relaxed text-ink-muted">
            Modélisez, visualisez et auditez vos matrices de flux réseau : règles, zones,
            NAT, détection de conflits et génération de configuration Juniper SRX.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <USelect
            v-model="scopeModel"
            :items="scopeItems"
            icon="i-lucide-users"
            size="sm"
            class="w-56"
          />
          <UBadge
            :label="scope === 'team' ? 'Partagé' : 'Personnel'"
            :color="scope === 'team' ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
          />
        </div>

        <dl class="flex gap-6">
          <div>
            <dt class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Matrices</dt>
            <dd class="mt-0.5 text-xl font-semibold text-ink">{{ matrices.length }}</dd>
          </div>
          <div>
            <dt class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Active</dt>
            <dd class="mt-0.5 max-w-[10rem] truncate text-sm text-ink-muted">{{ activeMatrix?.name }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <!-- Conflit d'édition : deux personnes ont enregistré la même matrice -->
    <UAlert
      v-if="conflict"
      color="warning"
      variant="subtle"
      icon="i-lucide-git-merge"
      title="Modifié par un coéquipier"
      :description="`${conflict.updatedBy ?? 'Quelqu\'un'} a enregistré cette matrice pendant votre édition. Choisissez la version à conserver.`"
    >
      <template #actions>
        <UButton size="xs" color="warning" label="Reprendre leur version" @click="acceptRemote()" />
        <UButton size="xs" color="neutral" variant="outline" label="Imposer la mienne" @click="overwriteRemote()" />
      </template>
    </UAlert>

    <FmdMatrixTabs />
    <FmdStats />

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <!-- Panneau outils : figé sous le header applicatif -->
      <div class="xl:sticky xl:top-20 xl:h-[calc(100vh-6.5rem)]">
        <FmdToolbox />
      </div>

      <div class="min-w-0 space-y-5">
        <FmdFlowTable />
        <FmdDiagram />
      </div>
    </div>
  </div>
</template>
