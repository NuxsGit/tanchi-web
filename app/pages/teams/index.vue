<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Équipes — Tanchi Web' })

const { teams, loaded, ensure, create } = useTeams()
const toast = useToast()

onMounted(ensure)

const modalOpen = ref(false)
const draft = reactive({ name: '', description: '' })
const creating = ref(false)

async function submit() {
  if (draft.name.trim().length < 2) {
    toast.add({ title: 'Nom trop court', description: '2 caractères minimum.', color: 'warning' })
    return
  }

  creating.value = true
  try {
    const team = await create(draft.name.trim(), draft.description.trim())
    modalOpen.value = false
    draft.name = ''
    draft.description = ''
    toast.add({ title: `Équipe « ${team.name} » créée`, color: 'success' })
    await navigateTo(`/teams/${team.id}`)
  } catch (error) {
    toast.add({
      title: 'Création impossible',
      description: apiError(error),
      color: 'error'
    })
  } finally {
    creating.value = false
  }
}

const roleLabel: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-ink">Équipes</h1>
        <p class="mt-1 max-w-2xl text-sm text-ink-muted">
          Regroupez des comptes autour de projets communs. Les projets d'une équipe
          alimentent les modules de la suite, à commencer par TanchiTaskTeam.
        </p>
      </div>

      <UButton icon="i-lucide-plus" color="primary" label="Nouvelle équipe" @click="modalOpen = true" />
    </div>

    <!-- Squelettes pendant le chargement, pour éviter le saut de mise en page -->
    <div v-if="!loaded" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="n in 3" :key="n" class="h-36 animate-pulse rounded-xl border border-line bg-surface" />
    </div>

    <div v-else-if="teams.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="team in teams"
        :key="team.id"
        :to="`/teams/${team.id}`"
        class="group rounded-xl border border-line bg-surface p-5 transition hover:border-accent/50"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="flex size-10 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
            <UIcon name="i-lucide-users" class="size-5 text-accent" />
          </span>
          <UBadge :label="roleLabel[team.role]" size="sm" variant="subtle" color="neutral" />
        </div>

        <h2 class="mt-4 font-medium text-ink transition group-hover:text-accent">{{ team.name }}</h2>
        <p v-if="team.description" class="mt-1 line-clamp-2 text-sm text-ink-muted">
          {{ team.description }}
        </p>

        <div class="mt-4 flex items-center gap-4 font-mono text-[11px] text-ink-dim">
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-user" class="size-3.5" />
            {{ team.memberCount }} membre{{ team.memberCount > 1 ? 's' : '' }}
          </span>
          <span class="flex items-center gap-1.5">
            <UIcon name="i-lucide-folder-kanban" class="size-3.5" />
            {{ team.projectCount }} projet{{ team.projectCount > 1 ? 's' : '' }}
          </span>
        </div>
      </NuxtLink>
    </div>

    <div v-else class="rounded-xl border border-dashed border-line p-12 text-center">
      <UIcon name="i-lucide-users" class="mx-auto size-8 text-ink-dim" />
      <h2 class="mt-4 font-medium text-ink">Aucune équipe pour l'instant</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        Créez une première équipe pour organiser vos projets et partager vos tableaux
        de tâches avec d'autres comptes de cette instance.
      </p>
      <UButton class="mt-6" icon="i-lucide-plus" color="primary" label="Créer une équipe" @click="modalOpen = true" />
    </div>

    <UModal v-model:open="modalOpen" title="Nouvelle équipe">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Nom" required>
            <UInput v-model="draft.name" placeholder="Infrastructure" size="lg" class="w-full" autofocus @keydown.enter="submit" />
          </UFormField>
          <UFormField label="Description" hint="optionnel">
            <UTextarea v-model="draft.description" :rows="3" placeholder="Ce que fait cette équipe." class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="modalOpen = false" />
          <UButton color="primary" :loading="creating" label="Créer l'équipe" @click="submit" />
        </div>
      </template>
    </UModal>
  </div>
</template>
