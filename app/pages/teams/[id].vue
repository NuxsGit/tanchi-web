<script setup lang="ts">
import { TEAM_ROLES, type TeamRole } from '~~/shared/tasks'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const teamId = computed(() => Number(route.params.id))
const { team, pending, error, refresh, addMember, removeMember, addProject } = useTeam(teamId)
const toast = useToast()

onMounted(refresh)

useHead({ title: () => `${team.value?.name ?? 'Équipe'} — Tanchi Web` })

const canManage = computed(() => team.value?.role === 'owner' || team.value?.role === 'admin')

/* ------------------------------------------------------------- Membres */

const memberModal = ref(false)
const memberDraft = reactive({ email: '', role: 'member' as TeamRole })
const memberPending = ref(false)

const roleItems = TEAM_ROLES.filter(role => role.id !== 'owner')
  .map(role => ({ label: role.label, value: role.id }))

async function submitMember() {
  memberPending.value = true
  try {
    await addMember(memberDraft.email.trim(), memberDraft.role)
    memberModal.value = false
    memberDraft.email = ''
    toast.add({ title: 'Membre ajouté', color: 'success' })
  } catch (cause) {
    toast.add({ title: 'Ajout impossible', description: apiError(cause, ''), color: 'error' })
  } finally {
    memberPending.value = false
  }
}

async function dropMember(userId: number, username: string) {
  try {
    await removeMember(userId)
    toast.add({ title: `${username} retiré de l'équipe`, color: 'success' })
  } catch (cause) {
    toast.add({ title: 'Retrait impossible', description: apiError(cause, ''), color: 'error' })
  }
}

/* ------------------------------------------------------------- Projets */

const projectModal = ref(false)
const projectDraft = reactive({ name: '', description: '' })
const projectPending = ref(false)

async function submitProject() {
  projectPending.value = true
  try {
    const project = await addProject(projectDraft.name.trim(), projectDraft.description.trim())
    projectModal.value = false
    projectDraft.name = ''
    projectDraft.description = ''
    toast.add({ title: `Projet « ${project.name} » créé`, color: 'success' })
  } catch (cause) {
    toast.add({ title: 'Création impossible', description: apiError(cause, ''), color: 'error' })
  } finally {
    projectPending.value = false
  }
}

const roleLabel: Record<string, string> = {
  owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre'
}

const progress = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0)
</script>

<template>
  <div class="space-y-6">
    <div v-if="pending && !team" class="h-32 animate-pulse rounded-xl border border-line bg-surface" />

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Équipe inaccessible"
      :description="error"
    />

    <template v-else-if="team">
      <!-- En-tête -->
      <header class="overflow-hidden rounded-xl border border-line bg-surface">
        <div class="flex items-center justify-between border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
          <div class="flex items-center gap-2">
            <NuxtLink to="/teams" class="transition hover:text-ink">équipes</NuxtLink>
            <span>/</span>
            <span class="text-accent">{{ team.name }}</span>
          </div>
          <UBadge :label="roleLabel[team.role]" size="sm" variant="subtle" color="neutral" />
        </div>

        <div class="flex flex-wrap items-start justify-between gap-6 p-5">
          <div class="max-w-2xl">
            <h1 class="text-xl font-semibold tracking-tight text-ink">{{ team.name }}</h1>
            <p v-if="team.description" class="mt-2 text-sm leading-relaxed text-ink-muted">
              {{ team.description }}
            </p>
          </div>

          <dl class="flex gap-6">
            <div>
              <dt class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Membres</dt>
              <dd class="mt-0.5 text-xl font-semibold text-ink">{{ team.members.length }}</dd>
            </div>
            <div>
              <dt class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Projets</dt>
              <dd class="mt-0.5 text-xl font-semibold text-ink">{{ team.projects.length }}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <!-- Projets -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-medium text-ink">Projets</h2>
            <UButton icon="i-lucide-plus" size="sm" color="primary" label="Nouveau projet" @click="projectModal = true" />
          </div>

          <div v-if="team.projects.length" class="grid gap-3 sm:grid-cols-2">
            <NuxtLink
              v-for="project in team.projects"
              :key="project.id"
              :to="`/apps/tasks?project=${project.id}`"
              class="group rounded-xl border border-line bg-surface p-4 transition hover:border-accent/50"
            >
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-medium text-ink transition group-hover:text-accent">{{ project.name }}</h3>
                <UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-ink-dim" />
              </div>
              <p v-if="project.description" class="mt-1 line-clamp-2 text-sm text-ink-muted">
                {{ project.description }}
              </p>

              <div class="mt-4 space-y-1.5">
                <div class="flex items-center justify-between font-mono text-[10px] text-ink-dim">
                  <span>{{ project.doneCount }}/{{ project.taskCount }} tâches</span>
                  <span>{{ progress(project.doneCount ?? 0, project.taskCount ?? 0) }} %</span>
                </div>
                <div class="h-1 overflow-hidden rounded-full bg-raised">
                  <div
                    class="h-full rounded-full bg-accent-fill transition-all"
                    :style="{ width: `${progress(project.doneCount ?? 0, project.taskCount ?? 0)}%` }"
                  />
                </div>
              </div>
            </NuxtLink>
          </div>

          <div v-else class="rounded-xl border border-dashed border-line p-10 text-center">
            <UIcon name="i-lucide-folder-kanban" class="mx-auto size-7 text-ink-dim" />
            <p class="mt-3 text-sm text-ink-muted">
              Aucun projet. Créez-en un pour ouvrir un tableau TanchiTaskTeam.
            </p>
          </div>
        </section>

        <!-- Membres -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-medium text-ink">Membres</h2>
            <UButton
              v-if="canManage"
              icon="i-lucide-user-plus"
              size="sm"
              color="neutral"
              variant="outline"
              label="Ajouter"
              @click="memberModal = true"
            />
          </div>

          <div class="space-y-2">
            <div
              v-for="member in team.members"
              :key="member.userId"
              class="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"
            >
              <UAvatar :src="member.avatar || undefined" :alt="member.username" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ink">{{ member.username }}</p>
                <p class="truncate text-xs text-ink-dim">{{ member.email }}</p>
              </div>
              <UBadge
                :label="roleLabel[member.role]"
                size="sm"
                variant="subtle"
                :color="member.role === 'owner' ? 'primary' : 'neutral'"
              />
              <UButton
                v-if="canManage && member.role !== 'owner'"
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="`Retirer ${member.username}`"
                @click="dropMember(member.userId, member.username)"
              />
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- Modales -->
    <UModal v-model:open="memberModal" title="Ajouter un membre">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-ink-muted">
            La personne doit déjà avoir un compte sur cette instance.
          </p>
          <UFormField label="Email du compte" required>
            <UInput v-model="memberDraft.email" type="email" placeholder="collegue@tanchi.io" size="lg" class="w-full" autofocus @keydown.enter="submitMember" />
          </UFormField>
          <UFormField label="Rôle">
            <USelect v-model="memberDraft.role" :items="roleItems" size="lg" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="memberModal = false" />
          <UButton color="primary" :loading="memberPending" label="Ajouter" @click="submitMember" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="projectModal" title="Nouveau projet">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Nom" required>
            <UInput v-model="projectDraft.name" placeholder="Migration datacenter" size="lg" class="w-full" autofocus @keydown.enter="submitProject" />
          </UFormField>
          <UFormField label="Description" hint="optionnel">
            <UTextarea v-model="projectDraft.description" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="projectModal = false" />
          <UButton color="primary" :loading="projectPending" label="Créer le projet" @click="submitProject" />
        </div>
      </template>
    </UModal>
  </div>
</template>
