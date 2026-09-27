/** Catalogue de la suite Tanchi — source unique pour le hub et la navigation. */

export type AppStatus = 'active' | 'unavailable'

export interface TanchiApp {
  id: string
  name: string
  /** Libellé compact, utilisé dans la barre latérale. */
  short: string
  tagline: string
  description: string
  icon: string
  status: AppStatus
  /** Route interne du module. Absente pour un module non encore livré. */
  to?: string
}

export const TANCHI_APPS: TanchiApp[] = [
  {
    id: 'fmd',
    name: 'Tanchi FlowMatrix Designer',
    short: 'FlowMatrix',
    tagline: 'Matrices de flux & politiques réseau',
    description: 'Modélisez vos règles pare-feu, détectez les conflits et générez la configuration Juniper SRX. Partageable avec votre équipe.',
    icon: 'i-lucide-git-fork',
    status: 'active',
    to: '/apps/fmd'
  },
  {
    id: 'topology',
    name: 'Tanchi TopologyBoard',
    short: 'Topology',
    tagline: 'Schémas d\'infrastructure & câblage',
    description: 'Dessinez baies, serveurs, commutateurs et liaisons, puis laissez le contrôleur repérer les ports inutiles et les câbles mal choisis.',
    icon: 'i-lucide-network',
    status: 'active',
    to: '/apps/topology'
  },
  {
    id: 'draw',
    name: 'TanchiDraw',
    short: 'Draw',
    tagline: 'Schémas et présentations client',
    description: 'Composez un plan avec les symboles du métier — serveurs, nuage, pare-feu, postes —, reliez-les par des flèches légendées, puis présentez planche par planche en plein écran.',
    icon: 'i-lucide-pen-tool',
    status: 'active',
    to: '/apps/draw'
  },
  {
    id: 'subnet',
    name: 'Tanchi SubNet',
    short: 'SubNet',
    tagline: 'Calcul et dimensionnement CIDR',
    description: 'Masques, plages, adresses disponibles et découpage VLSM d\'un bloc, sans mémo ni ligne de commande.',
    icon: 'i-lucide-calculator',
    status: 'active',
    to: '/apps/subnet'
  },
  {
    id: 'configlab',
    name: 'Tanchi ConfigLab',
    short: 'ConfigLab',
    tagline: 'Bac à sable de configuration',
    description: 'Saisissez une règle cron, une expression régulière ou une configuration Nginx : la syntaxe est validée à la frappe et expliquée en clair. Conversion Nginx ↔ Apache incluse.',
    icon: 'i-lucide-flask-conical',
    status: 'active',
    to: '/apps/configlab'
  },
  {
    id: 'shell',
    name: 'Tanchi ShellTraductor',
    short: 'ShellTrad',
    tagline: 'De la phrase à la commande',
    description: 'Décrivez ce que vous voulez faire et choisissez la machine : le traducteur rend la commande, la vérification et le retour en arrière, avec le sens de chaque option.',
    icon: 'i-lucide-languages',
    status: 'active',
    to: '/apps/shell'
  },
  {
    id: 'macchecker',
    name: 'Tanchi MacChecker',
    short: 'MacChecker',
    tagline: 'Analyse d\'adresses MAC',
    description: 'Collez des adresses en vrac : constructeur d\'après le registre IEEE, nature de l\'adresse, correspondances multicast et reformatage en un clic.',
    icon: 'i-lucide-scan-search',
    status: 'active',
    to: '/apps/macchecker'
  },
  {
    id: 'learn',
    name: 'TanchiLearn',
    short: 'Learn',
    tagline: 'Cours et tutoriels de la suite',
    description: 'Une pile de dossiers que l\'on fait défiler à la molette : chaque dossier ouvre les fiches d\'une application, avec quiz et progression.',
    icon: 'i-lucide-graduation-cap',
    status: 'active',
    to: '/apps/learn'
  },
  {
    id: 'tasks',
    name: 'TanchiTaskTeam',
    short: 'TaskTeam',
    tagline: 'Kanban d\'équipe par projet',
    description: 'Assignez les tâches à vos coéquipiers, suivez leur avancement et gardez le backlog sous contrôle.',
    icon: 'i-lucide-square-kanban',
    status: 'active',
    to: '/apps/tasks'
  },
  {
    id: 'nas',
    name: 'TanchiNasManager',
    short: 'NasManager',
    tagline: 'Gestion des NAS & volumes',
    description: 'Inventaire des baies, état des disques, partages SMB/NFS et suivi des tâches de synchronisation.',
    icon: 'i-lucide-hard-drive',
    status: 'unavailable'
  }
]

export function findApp(id: string): TanchiApp | undefined {
  return TANCHI_APPS.find(app => app.id === id)
}

/** Seuls les modules livrés et dotés d'une route interne sont épinglables. */
export function isPinnable(app: TanchiApp): boolean {
  return Boolean(app.to) && app.status === 'active'
}

export const PINNABLE_APPS = TANCHI_APPS.filter(isPinnable)

/** Nettoie une liste d'identifiants venant du client ou de la base. */
export function normalizePinnedApps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  for (const value of raw) {
    const id = String(value)
    const app = findApp(id)
    if (app && isPinnable(app)) seen.add(id)
  }

  // On borne : la barre latérale doit rester lisible.
  return [...seen].slice(0, 8)
}
