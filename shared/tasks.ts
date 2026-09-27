/** Domaine partagé de TanchiTaskTeam (Kanban d'équipe). */

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'review' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TeamRole = 'owner' | 'admin' | 'member'

export interface TaskColumn {
  id: TaskStatus
  label: string
  hint: string
}

export const TASK_COLUMNS: TaskColumn[] = [
  { id: 'backlog', label: 'Backlog', hint: 'Idées et demandes non planifiées' },
  { id: 'todo', label: 'À faire', hint: 'Planifié pour le cycle en cours' },
  { id: 'doing', label: 'En cours', hint: 'Quelqu\'un travaille dessus' },
  { id: 'review', label: 'Revue', hint: 'En attente de relecture ou de validation' },
  { id: 'done', label: 'Terminé', hint: 'Livré et vérifié' }
]

export const TASK_STATUSES = TASK_COLUMNS.map(column => column.id)

export interface PriorityDefinition {
  id: TaskPriority
  label: string
  color: 'neutral' | 'info' | 'warning' | 'error'
}

export const TASK_PRIORITIES: PriorityDefinition[] = [
  { id: 'low', label: 'Basse', color: 'neutral' },
  { id: 'normal', label: 'Normale', color: 'info' },
  { id: 'high', label: 'Haute', color: 'warning' },
  { id: 'urgent', label: 'Urgente', color: 'error' }
]

export const TEAM_ROLES: { id: TeamRole, label: string, hint: string }[] = [
  { id: 'owner', label: 'Propriétaire', hint: 'Contrôle total, ne peut pas être retiré' },
  { id: 'admin', label: 'Administrateur', hint: 'Gère les membres et les projets' },
  { id: 'member', label: 'Membre', hint: 'Crée et déplace les tâches' }
]

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as string[]).includes(value)
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && TASK_PRIORITIES.some(item => item.id === value)
}

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === 'string' && TEAM_ROLES.some(item => item.id === value)
}

export function priorityOf(id: string): PriorityDefinition {
  return TASK_PRIORITIES.find(item => item.id === id) ?? TASK_PRIORITIES[1]!
}

export function columnOf(id: string): TaskColumn {
  return TASK_COLUMNS.find(item => item.id === id) ?? TASK_COLUMNS[0]!
}

/* ------------------------------------------------------------------ Types */

export interface TeamMember {
  userId: number
  username: string
  email: string
  avatar: string | null
  role: TeamRole
  joinedAt: string
}

export interface Project {
  id: number
  teamId: number
  name: string
  description: string
  createdAt: string
  taskCount?: number
  doneCount?: number
}

export interface Team {
  id: number
  name: string
  description: string
  ownerId: number
  role: TeamRole
  memberCount: number
  projectCount: number
  createdAt: string
}

export interface TeamDetail extends Team {
  members: TeamMember[]
  projects: Project[]
}

export interface Task {
  id: number
  projectId: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId: number | null
  assigneeName: string | null
  position: number
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

/** Position médiane entre deux cartes, pour un réordonnancement sans réécriture. */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 1000
  if (before === undefined) return after! - 1000
  if (after === undefined) return before + 1000
  return (before + after) / 2
}
