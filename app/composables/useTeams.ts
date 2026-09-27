import type { Project, Team, TeamDetail, TeamRole } from '~~/shared/tasks'

/** Équipes de l'utilisateur courant, mises en cache pour la session. */
export const useTeams = () => {
  const teams = useState<Team[]>('tanchi-teams', () => [])
  const loaded = useState<boolean>('tanchi-teams-loaded', () => false)
  const pending = ref(false)

  const refresh = async () => {
    pending.value = true
    try {
      const { teams: rows } = await $fetch<{ teams: Team[] }>('/api/teams')
      teams.value = rows
      loaded.value = true
    } finally {
      pending.value = false
    }
  }

  const ensure = async () => {
    if (!loaded.value) await refresh()
  }

  const create = async (name: string, description: string) => {
    const { team } = await $fetch<{ team: Team }>('/api/teams', {
      method: 'POST',
      body: { name, description }
    })
    teams.value = [...teams.value, team].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    return team
  }

  return { teams, loaded, pending, refresh, ensure, create }
}

/** Détail d'une équipe : membres et projets. */
export const useTeam = (teamId: MaybeRefOrGetter<number>) => {
  const team = ref<TeamDetail | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  const refresh = async () => {
    pending.value = true
    error.value = null
    try {
      const { team: detail } = await $fetch<{ team: TeamDetail }>(`/api/teams/${toValue(teamId)}`)
      team.value = detail
    } catch (cause) {
      error.value = apiError(cause, 'Équipe inaccessible.')
    } finally {
      pending.value = false
    }
  }

  const addMember = async (email: string, role: TeamRole) => {
    await $fetch(`/api/teams/${toValue(teamId)}/members`, {
      method: 'POST',
      body: { email, role }
    })
    await refresh()
  }

  const removeMember = async (userId: number) => {
    await $fetch(`/api/teams/${toValue(teamId)}/members/${userId}`, { method: 'DELETE' })
    await refresh()
  }

  const addProject = async (name: string, description: string) => {
    const { project } = await $fetch<{ project: Project }>(`/api/teams/${toValue(teamId)}/projects`, {
      method: 'POST',
      body: { name, description }
    })
    if (team.value) team.value.projects = [project, ...team.value.projects]
    return project
  }

  return { team, pending, error, refresh, addMember, removeMember, addProject }
}
