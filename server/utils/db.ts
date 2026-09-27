import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { DEFAULT_THEME, THEME_IDS } from '../../shared/themes'

export interface UserRow {
  id: number
  username: string
  email: string
  password_hash: string
  role: string
  avatar_url: string | null
  theme: string
  color_mode: string
  two_factor: number
  pinned_apps: string
  created_at: string
}

export interface SessionRow {
  token: string
  user_id: number
  created_at: string
  expires_at: string
}

export interface TeamRow {
  id: number
  name: string
  description: string
  owner_id: number
  created_at: string
}

export interface TeamMemberRow {
  team_id: number
  user_id: number
  role: string
  joined_at: string
}

export interface ProjectRow {
  id: number
  team_id: number
  name: string
  description: string
  created_at: string
}

export interface TaskRow {
  id: number
  project_id: number
  title: string
  description: string
  status: string
  priority: string
  assignee_id: number | null
  position: number
  due_date: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: number
  app: string
  scope: string
  scope_id: number
  data: string
  revision: number
  updated_at: string
  updated_by: number | null
}

export interface FmdWorkspaceRow {
  user_id: number
  data: string
  updated_at: string
}

export interface ApiKeyRow {
  id: number
  user_id: number
  name: string
  secret: string
  masked: string
  created_at: string
  last_used: string | null
}

let db: Database.Database | undefined
let dbFile: string | undefined

/** Chemin absolu du fichier SQLite servant de base locale. */
export function getDbFile(): string {
  return dbFile ?? resolveDbFile()
}

function resolveDbFile(): string {
  return process.env.TANCHI_DB ?? resolve(process.cwd(), 'data/tanchi.db')
}

/** Base SQLite locale, créée à la volée dans `./data/tanchi.db`. */
export function useDb(): Database.Database {
  if (db) return db

  const file = resolveDbFile()
  dbFile = file
  mkdirSync(dirname(file), { recursive: true })
  console.log(`[tanchi] base locale : ${file}`)

  db = new Database(file)
  db.pragma('journal_mode = WAL')
  // `better-sqlite3` est synchrone : sans délai d'attente, un verrou tenu par
  // un autre processus fige la boucle d'événements. Ici SQLite réessaie
  // pendant 5 s puis renvoie une erreur, au lieu de bloquer indéfiniment.
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'Administrateur',
      avatar_url    TEXT,
      theme         TEXT    NOT NULL DEFAULT 'vert-noir',
      color_mode    TEXT    NOT NULL DEFAULT 'dark',
      two_factor    INTEGER NOT NULL DEFAULT 0,
      pinned_apps   TEXT    NOT NULL DEFAULT '[]',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      secret     TEXT NOT NULL UNIQUE,
      masked     TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used  TEXT
    );

    -- Espace de travail FlowMatrix Designer : un document JSON par compte.
    CREATE TABLE IF NOT EXISTS fmd_workspaces (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ------------------------------------------------ Équipes & projets
    CREATE TABLE IF NOT EXISTS teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id   INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role      TEXT    NOT NULL DEFAULT 'member',
      joined_at TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- --------------------------------------------- TanchiTaskTeam (Kanban)
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      status      TEXT    NOT NULL DEFAULT 'backlog',
      priority    TEXT    NOT NULL DEFAULT 'normal',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      position    REAL    NOT NULL DEFAULT 0,
      due_date    TEXT,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Grille de widgets du tableau de bord : un document JSON par compte.
    CREATE TABLE IF NOT EXISTS dashboard_layouts (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Documents applicatifs (FlowMatrix, TopologyBoard) : portee personnelle
    -- ou partagee a l'echelle d'une equipe. La colonne revision sert au
    -- controle de concurrence entre coequipiers.
    CREATE TABLE IF NOT EXISTS documents (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      app        TEXT    NOT NULL,
      scope      TEXT    NOT NULL,
      scope_id   INTEGER NOT NULL,
      data       TEXT    NOT NULL,
      revision   INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (app, scope, scope_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_team ON projects(team_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status, position);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
  `)

  // Purge des sessions expirées au démarrage.
  db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run()

  // Migration : colonne ajoutée après coup, `CREATE TABLE IF NOT EXISTS` ne
  // touche pas une table déjà créée.
  const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
  if (!userColumns.some(column => column.name === 'pinned_apps')) {
    db.exec(`ALTER TABLE users ADD COLUMN pinned_apps TEXT NOT NULL DEFAULT '[]'`)
  }

  // Reprise des espaces FlowMatrix créés avant le magasin de documents.
  const legacy = db.prepare('SELECT user_id, data, updated_at FROM fmd_workspaces').all() as
    { user_id: number, data: string, updated_at: string }[]

  if (legacy.length) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO documents (app, scope, scope_id, data, revision, updated_at, updated_by)
      VALUES ('fmd', 'user', ?, ?, 1, ?, ?)
    `)
    const migrate = db.transaction(() => {
      for (const row of legacy) insert.run(row.user_id, row.data, row.updated_at, row.user_id)
    })
    migrate()
  }

  // Ramène les comptes dont le thème enregistré n'existe plus vers le défaut.
  const placeholders = THEME_IDS.map(() => '?').join(', ')
  db.prepare(`UPDATE users SET theme = ? WHERE theme NOT IN (${placeholders})`)
    .run(DEFAULT_THEME, ...THEME_IDS)

  return db
}
