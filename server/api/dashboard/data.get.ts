import { useDb } from '~~/server/utils/db'
import { findConflictKeys, buildConflictKey, type Matrix } from '~~/shared/fmd'

/**
 * Une seule requête pour alimenter tous les widgets.
 *
 * Chaque widget pourrait interroger sa propre route, mais la grille en affiche
 * facilement une dizaine : on agrège côté serveur pour n'ouvrir qu'un aller-retour.
 */
export default defineEventHandler((event) => {
  const user = requireUser(event)
  const db = useDb()

  const teams = db.prepare(`
    SELECT t.id, t.name, tm.role,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS memberCount
    FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = ?
    ORDER BY t.name COLLATE NOCASE
  `).all(user.id) as { id: number, name: string, role: string, memberCount: number }[]

  const teamIds = teams.map(team => team.id)
  const placeholders = teamIds.map(() => '?').join(', ') || 'NULL'

  const projects = db.prepare(`
    SELECT p.id, p.team_id AS teamId, p.name, t.name AS teamName,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS total,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'backlog') AS backlog,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'todo')    AS todo,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'doing')   AS doing,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'review')  AS review,
           (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done')    AS done
    FROM projects p JOIN teams t ON t.id = p.team_id
    WHERE p.team_id IN (${placeholders})
    ORDER BY p.name COLLATE NOCASE
  `).all(...teamIds) as Record<string, unknown>[]

  const myTasks = db.prepare(`
    SELECT tk.id, tk.title, tk.status, tk.priority, tk.due_date AS dueDate,
           tk.project_id AS projectId, p.name AS projectName
    FROM tasks tk JOIN projects p ON p.id = tk.project_id
    WHERE tk.assignee_id = ? AND tk.status != 'done'
    ORDER BY
      CASE tk.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      tk.due_date IS NULL, tk.due_date
    LIMIT 30
  `).all(user.id) as Record<string, unknown>[]

  const members = db.prepare(`
    SELECT tm.team_id AS teamId, u.id AS userId, u.username, u.avatar_url AS avatar, tm.role,
           (SELECT COUNT(*) FROM tasks tk
              JOIN projects p ON p.id = tk.project_id
             WHERE tk.assignee_id = u.id AND p.team_id = tm.team_id AND tk.status != 'done') AS openTasks
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id IN (${placeholders})
    ORDER BY u.username COLLATE NOCASE
  `).all(...teamIds) as Record<string, unknown>[]

  // Statistiques FlowMatrix, calculées depuis le document de l'utilisateur.
  const fmd = { matrices: 0, flows: 0, allow: 0, deny: 0, conflicts: 0 }
  const workspace = db.prepare(
    `SELECT data FROM documents WHERE app = 'fmd' AND scope = 'user' AND scope_id = ?`
  ).get(user.id) as { data: string } | undefined

  if (workspace) {
    try {
      const matrices = (JSON.parse(workspace.data)?.matrices ?? []) as Matrix[]
      fmd.matrices = matrices.length
      for (const matrix of matrices) {
        const flows = Array.isArray(matrix.flows) ? matrix.flows : []
        const conflicts = findConflictKeys(flows)
        fmd.flows += flows.length
        fmd.allow += flows.filter(flow => flow.action === 'ALLOW').length
        fmd.deny += flows.filter(flow => flow.action === 'DENY').length
        fmd.conflicts += flows.filter(flow => conflicts.has(buildConflictKey(flow))).length
      }
    } catch {
      // Document illisible : on laisse les compteurs à zéro.
    }
  }

  return { teams, projects, myTasks, members, fmd }
})
