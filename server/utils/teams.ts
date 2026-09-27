import type { H3Event } from 'h3'
import type { ProjectRow, TaskRow, TeamRow } from './db'
import { useDb } from './db'
import type { Project, Task, TaskPriority, TaskStatus, Team, TeamMember, TeamRole } from '~~/shared/tasks'

/** Appartenance de l'utilisateur courant à une équipe, ou 401/403. */
export function requireMembership(event: H3Event, teamId: number): { userId: number, role: TeamRole } {
  const user = requireUser(event)

  const row = useDb()
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .get(teamId, user.id) as { role: TeamRole } | undefined

  assert(row, 'Équipe introuvable.', 404)
  return { userId: user.id, role: row!.role }
}

/** Idem, en exigeant un rôle de gestion. */
export function requireManager(event: H3Event, teamId: number) {
  const membership = requireMembership(event, teamId)
  assert(
    membership.role === 'owner' || membership.role === 'admin',
    'Action réservée aux administrateurs de l\'équipe.',
    403
  )
  return membership
}

/** Équipe propriétaire d'un projet, avec vérification d'accès. */
export function requireProjectAccess(event: H3Event, projectId: number) {
  const project = useDb()
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(projectId) as ProjectRow | undefined

  assert(project, 'Projet introuvable.', 404)
  const membership = requireMembership(event, project!.team_id)
  return { project: project!, membership }
}

/* ---------------------------------------------------------- Sérialisation */

export function toTeam(row: TeamRow & { role: TeamRole, member_count: number, project_count: number }): Team {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    role: row.role,
    memberCount: row.member_count,
    projectCount: row.project_count,
    createdAt: row.created_at
  }
}

export function toProject(row: ProjectRow & { task_count?: number, done_count?: number }): Project {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    taskCount: row.task_count ?? 0,
    doneCount: row.done_count ?? 0
  }
}

export function toMember(row: {
  user_id: number
  username: string
  email: string
  avatar_url: string | null
  role: TeamRole
  joined_at: string
}): TeamMember {
  return {
    userId: row.user_id,
    username: row.username,
    email: row.email,
    avatar: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at
  }
}

export function toTask(row: TaskRow & { assignee_name?: string | null }): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name ?? null,
    position: row.position,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
