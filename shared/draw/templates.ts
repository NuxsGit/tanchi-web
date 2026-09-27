import {
  PAGE_H,
  PAGE_W,
  createShape,
  defaultStyle,
  genId,
  styleForKind,
  type BackgroundId,
  type Connector,
  type Routing,
  type Shape,
  type ShapeKind,
  type Style
} from './model'

/**
 * Planches prêtes à présenter.
 *
 * Un administrateur ne part presque jamais d'une page blanche : il montre un
 * accès Internet, une sauvegarde, un télétravail. Chaque modèle pose une
 * architecture complète et légendée, calée sur la planche 1600 × 900 ; il ne
 * reste qu'à renommer les équipements avec ceux du client.
 */

export interface TemplateSpot {
  key: string
  kind: ShapeKind
  x: number
  y: number
  w?: number
  h?: number
  text?: string
  icon?: string
  style?: Partial<Style>
}

export interface TemplateWire {
  from: string
  to: string
  label?: string
  routing?: Routing
  color?: string
  dashed?: boolean
  both?: boolean
}

export interface DrawTemplate {
  id: string
  label: string
  description: string
  icon: string
  /** À qui la planche s'adresse : ce que l'on annonce en ouvrant la slide. */
  audience: string
  background: BackgroundId
  spots: TemplateSpot[]
  wires: TemplateWire[]
}

const ENCRE = '#0f172a'
const ARDOISE = '#475569'
const BLEU = '#2563eb'
const CYAN = '#0891b2'
const VERT = '#16a34a'
const AMBRE = '#f59e0b'
const ROUGE = '#dc2626'
const VIOLET = '#8b5cf6'

/* Raccourcis de description : les modèles restent lisibles en une page. */

const titre = (text: string, sub?: string): TemplateSpot[] => {
  const spots: TemplateSpot[] = [
    { key: '_t', kind: 'text', x: 80, y: 56, w: 1100, h: 48, text, style: { fontSize: 34, bold: true, align: 'left', color: ENCRE } }
  ]
  if (sub) {
    spots.push({ key: '_s', kind: 'text', x: 80, y: 106, w: 1100, h: 34, text: sub, style: { fontSize: 18, bold: false, align: 'left', color: ARDOISE } })
  }
  return spots
}

const glyphe = (key: string, x: number, y: number, icon: string, text: string, color = ARDOISE): TemplateSpot =>
  ({ key, kind: 'icon', x, y, w: 130, h: 140, icon, text, style: { color } })

const zone = (key: string, x: number, y: number, w: number, h: number, text: string, color = ARDOISE): TemplateSpot =>
  ({ key, kind: 'zone', x, y, w, h, text, style: { stroke: color, fill: `${color}14`, color } })

const boite = (key: string, x: number, y: number, w: number, h: number, text: string, color = ARDOISE): TemplateSpot =>
  ({ key, kind: 'rect', x, y, w, h, text, style: { stroke: color, fill: `${color}14`, color } })

const note = (key: string, x: number, y: number, text: string): TemplateSpot =>
  ({ key, kind: 'note', x, y, w: 240, h: 150, text, style: { fontSize: 15 } })

export const DRAW_TEMPLATES: DrawTemplate[] = [
  /* --------------------------------------------------------- Page de garde */
  {
    id: 'garde',
    label: 'Page de garde',
    description: 'Titre, sous-titre et signature : la première planche d\'une présentation client.',
    icon: 'i-lucide-presentation',
    audience: 'Ouverture de réunion',
    background: 'ardoise',
    spots: [
      { key: 'logo', kind: 'icon', x: 700, y: 200, w: 200, h: 200, icon: 'i-lucide-network', text: '', style: { color: '#38bdf8' } },
      { key: 'titre', kind: 'text', x: 300, y: 440, w: 1000, h: 70, text: 'Refonte de l\'infrastructure', style: { fontSize: 52, bold: true, align: 'center', color: '#f8fafc' } },
      { key: 'sous', kind: 'text', x: 300, y: 530, w: 1000, h: 40, text: 'Proposition technique et plan de migration', style: { fontSize: 24, align: 'center', color: '#94a3b8' } },
      { key: 'trait', kind: 'rect', x: 700, y: 600, w: 200, h: 4, text: '', style: { fill: '#38bdf8', stroke: 'none', strokeWidth: 0, radius: 2 } },
      { key: 'auteur', kind: 'text', x: 300, y: 650, w: 1000, h: 34, text: 'Service informatique · ' + 'votre nom', style: { fontSize: 18, align: 'center', color: '#64748b' } }
    ],
    wires: []
  },

  /* ---------------------------------------------------- Accès Internet PME */
  {
    id: 'acces-internet',
    label: 'Accès Internet d\'entreprise',
    description: 'Le poste de travail, le commutateur, le pare-feu et l\'arrivée opérateur : la vue que tout client comprend.',
    icon: 'i-lucide-globe',
    audience: 'Direction, utilisateurs',
    background: 'blanc',
    spots: [
      ...titre('Accès Internet — Site principal', 'Du poste de travail à l\'arrivée fibre'),
      zone('lan', 80, 180, 640, 620, 'Réseau local (LAN)', BLEU),
      glyphe('pc1', 140, 240, 'i-lucide-monitor', 'Postes bureau', BLEU),
      glyphe('pc2', 320, 240, 'i-lucide-laptop', 'Portables', BLEU),
      glyphe('pr', 500, 240, 'i-lucide-printer', 'Impression', BLEU),
      glyphe('ap', 140, 430, 'i-lucide-radio-tower', 'Borne Wi-Fi', CYAN),
      glyphe('nas', 500, 430, 'i-lucide-hard-drive', 'Serveur de fichiers', VERT),
      glyphe('sw', 320, 620, 'i-lucide-network', 'Commutateur 24 ports', ARDOISE),
      glyphe('fw', 830, 430, 'i-lucide-brick-wall', 'Pare-feu', ROUGE),
      glyphe('box', 1070, 430, 'i-lucide-radio', 'Box opérateur', ARDOISE),
      glyphe('net', 1310, 430, 'i-lucide-globe', 'Internet', BLEU),
      note('n1', 1240, 640, 'Fibre 1 Gb/s garantie\n4 h de rétablissement')
    ],
    wires: [
      { from: 'pc1', to: 'sw' },
      { from: 'pc2', to: 'sw' },
      { from: 'pr', to: 'sw' },
      { from: 'ap', to: 'sw' },
      { from: 'nas', to: 'sw' },
      { from: 'sw', to: 'fw', label: 'Lien 1 Gb/s', color: ARDOISE },
      { from: 'fw', to: 'box', label: 'Filtrage', color: ROUGE },
      { from: 'box', to: 'net', label: 'Fibre', color: BLEU }
    ]
  },

  /* ------------------------------------------------------ Hébergement HA */
  {
    id: 'haute-dispo',
    label: 'Hébergement haute disponibilité',
    description: 'Répartition de charge, serveurs web redondants, base répliquée et sauvegarde.',
    icon: 'i-lucide-split',
    audience: 'Client hébergement, DSI',
    background: 'blanc',
    spots: [
      ...titre('Hébergement web — Haute disponibilité', 'Aucun équipement n\'est un point de panne unique'),
      glyphe('users', 90, 400, 'i-lucide-users', 'Visiteurs', ARDOISE),
      glyphe('net', 280, 400, 'i-lucide-globe', 'Internet', BLEU),
      zone('prod', 470, 200, 800, 620, 'Production hébergée', VERT),
      glyphe('lb', 520, 400, 'i-lucide-split', 'Répartiteur de charge', VIOLET),
      glyphe('web1', 740, 250, 'i-lucide-server', 'Serveur web 1', VERT),
      glyphe('web2', 740, 570, 'i-lucide-server', 'Serveur web 2', VERT),
      glyphe('db1', 990, 250, 'i-lucide-database', 'Base primaire', CYAN),
      glyphe('db2', 990, 570, 'i-lucide-database', 'Base réplique', CYAN),
      glyphe('bkp', 1330, 400, 'i-lucide-archive', 'Sauvegarde quotidienne', AMBRE),
      note('n1', 1300, 620, 'Bascule automatique\nen moins de 30 s')
    ],
    wires: [
      { from: 'users', to: 'net' },
      { from: 'net', to: 'lb', label: 'HTTPS', color: BLEU },
      { from: 'lb', to: 'web1', color: VIOLET },
      { from: 'lb', to: 'web2', color: VIOLET },
      { from: 'web1', to: 'db1', color: CYAN },
      { from: 'web2', to: 'db1', color: CYAN },
      { from: 'db1', to: 'db2', label: 'Réplication', color: CYAN, dashed: true, routing: 'elbow' },
      { from: 'db1', to: 'bkp', label: 'Nuit', color: AMBRE, dashed: true }
    ]
  },

  /* --------------------------------------------------- Sauvegarde 3-2-1 */
  {
    id: 'sauvegarde-321',
    label: 'Stratégie de sauvegarde 3-2-1',
    description: 'Trois copies, deux supports, une hors site : la règle expliquée en une planche.',
    icon: 'i-lucide-archive',
    audience: 'Direction, assurance, audit',
    background: 'blanc',
    spots: [
      ...titre('Sauvegarde 3-2-1', '3 copies · 2 supports différents · 1 copie hors site'),
      zone('site', 80, 200, 780, 620, 'Site principal', BLEU),
      glyphe('srv', 140, 300, 'i-lucide-server', 'Serveurs de production', ARDOISE),
      glyphe('vm', 140, 550, 'i-lucide-square-stack', 'Machines virtuelles', ARDOISE),
      glyphe('nas', 480, 420, 'i-lucide-hard-drive', 'NAS — copie 1', VERT),
      glyphe('tape', 700, 260, 'i-lucide-disc', 'Bande LTO — copie 2', AMBRE),
      zone('hs', 1000, 200, 520, 620, 'Hors site', VIOLET),
      glyphe('cloud', 1120, 330, 'i-lucide-cloud-upload', 'Cloud — copie 3', VIOLET),
      glyphe('coffre', 1120, 590, 'i-lucide-vault', 'Coffre externe', VIOLET),
      note('n1', 560, 640, 'Restauration testée\nchaque trimestre')
    ],
    wires: [
      { from: 'srv', to: 'nas', label: 'Chaque nuit', color: VERT },
      { from: 'vm', to: 'nas', label: 'Instantanés', color: VERT },
      { from: 'nas', to: 'tape', label: 'Hebdomadaire', color: AMBRE },
      { from: 'nas', to: 'cloud', label: 'Chiffré', color: VIOLET },
      { from: 'tape', to: 'coffre', label: 'Mensuel', color: VIOLET, dashed: true }
    ]
  },

  /* ------------------------------------------------------ Télétravail */
  {
    id: 'teletravail',
    label: 'Télétravail sécurisé',
    description: 'Poste distant, tunnel VPN, double facteur puis accès aux ressources internes.',
    icon: 'i-lucide-house',
    audience: 'Utilisateurs, RSSI',
    background: 'blanc',
    spots: [
      ...titre('Télétravail sécurisé', 'Un tunnel chiffré, une authentification forte, des accès limités'),
      zone('dom', 80, 220, 420, 520, 'Domicile', ARDOISE),
      glyphe('lap', 130, 300, 'i-lucide-laptop', 'Portable de l\'entreprise', ARDOISE),
      glyphe('mob', 320, 300, 'i-lucide-smartphone', 'Second facteur', VIOLET),
      glyphe('box', 220, 540, 'i-lucide-router', 'Box personnelle', ARDOISE),
      glyphe('net', 600, 420, 'i-lucide-globe', 'Internet', BLEU),
      glyphe('fw', 830, 420, 'i-lucide-shield-check', 'Pare-feu VPN', ROUGE),
      zone('si', 1010, 220, 510, 520, 'Système d\'information', VERT),
      glyphe('bast', 1060, 300, 'i-lucide-key-round', 'Bastion', ROUGE),
      glyphe('app', 1290, 300, 'i-lucide-app-window', 'Applications métier', VERT),
      glyphe('files', 1060, 540, 'i-lucide-folder', 'Fichiers', VERT),
      glyphe('mail', 1290, 540, 'i-lucide-mail', 'Messagerie', VERT)
    ],
    wires: [
      { from: 'lap', to: 'box' },
      { from: 'mob', to: 'lap', label: 'Code à usage unique', color: VIOLET, dashed: true },
      { from: 'box', to: 'net' },
      { from: 'net', to: 'fw', label: 'Tunnel VPN chiffré', color: ROUGE },
      { from: 'fw', to: 'bast', color: ROUGE },
      { from: 'bast', to: 'app', color: VERT },
      { from: 'fw', to: 'files', color: VERT },
      { from: 'fw', to: 'mail', color: VERT }
    ]
  },

  /* ------------------------------------------------------ Cloud hybride */
  {
    id: 'cloud-hybride',
    label: 'Cloud hybride',
    description: 'Ce qui reste dans la salle serveur, ce qui part dans le nuage, et le lien entre les deux.',
    icon: 'i-lucide-cloud-cog',
    audience: 'DSI, comité de direction',
    background: 'blanc',
    spots: [
      ...titre('Architecture hybride', 'Le patrimoine reste interne, la charge variable part dans le nuage'),
      zone('dc', 80, 200, 620, 620, 'Salle serveur — interne', ARDOISE),
      glyphe('hv', 140, 290, 'i-lucide-layers-2', 'Hyperviseurs', ARDOISE),
      glyphe('san', 380, 290, 'i-lucide-database', 'Stockage SAN', CYAN),
      glyphe('ad', 140, 550, 'i-lucide-book-user', 'Annuaire', VIOLET),
      glyphe('erp', 380, 550, 'i-lucide-briefcase', 'ERP métier', VERT),
      glyphe('vpn', 790, 420, 'i-lucide-globe-lock', 'Lien chiffré dédié', ROUGE),
      zone('cl', 950, 200, 570, 620, 'Cloud public', BLEU),
      glyphe('k8s', 1010, 290, 'i-lucide-hexagon', 'Conteneurs', BLEU),
      glyphe('mdb', 1250, 290, 'i-lucide-database-zap', 'Base managée', CYAN),
      glyphe('obj', 1010, 550, 'i-lucide-cloud-upload', 'Stockage objet', BLEU),
      glyphe('mon', 1250, 550, 'i-lucide-activity', 'Supervision', AMBRE)
    ],
    wires: [
      { from: 'hv', to: 'san' },
      { from: 'dc', to: 'vpn', label: 'VPN site à site', color: ROUGE },
      { from: 'vpn', to: 'cl', color: ROUGE },
      { from: 'k8s', to: 'mdb', color: CYAN },
      { from: 'k8s', to: 'obj', color: BLEU },
      { from: 'mon', to: 'k8s', label: 'Sondes', color: AMBRE, dashed: true }
    ]
  },

  /* --------------------------------------------------- Interconnexion */
  {
    id: 'multisite',
    label: 'Interconnexion multi-sites',
    description: 'Un siège, deux agences, des nomades : qui parle à qui, et par quel lien.',
    icon: 'i-lucide-map',
    audience: 'Direction, réseaux',
    background: 'blanc',
    spots: [
      ...titre('Interconnexion des sites', 'Siège, agences et postes nomades sur un même réseau privé'),
      glyphe('siege', 720, 400, 'i-lucide-building-2', 'Siège — Paris', BLEU),
      glyphe('ag1', 250, 250, 'i-lucide-store', 'Agence — Lyon', VERT),
      glyphe('ag2', 250, 600, 'i-lucide-store', 'Agence — Nantes', VERT),
      glyphe('nom', 1200, 250, 'i-lucide-laptop', 'Nomades', VIOLET),
      glyphe('cloud', 1200, 600, 'i-lucide-cloud', 'Services cloud', CYAN),
      boite('sla', 80, 800, 620, 70, 'Liens opérateur : 1 Gb/s siège · 200 Mb/s agences · secours 4G', ARDOISE)
    ],
    wires: [
      { from: 'ag1', to: 'siege', label: 'VPN 200 Mb/s', color: VERT, both: true },
      { from: 'ag2', to: 'siege', label: 'VPN 200 Mb/s', color: VERT, both: true },
      { from: 'nom', to: 'siege', label: 'VPN nomade', color: VIOLET, dashed: true },
      { from: 'siege', to: 'cloud', label: 'Sortie mutualisée', color: CYAN, both: true }
    ]
  },

  /* ------------------------------------------------------- Supervision */
  {
    id: 'supervision',
    label: 'Supervision & alerting',
    description: 'De la sonde à l\'astreinte : ce qui est mesuré, où c\'est stocké, qui est prévenu.',
    icon: 'i-lucide-activity',
    audience: 'Exploitation, direction',
    background: 'blanc',
    spots: [
      ...titre('Chaîne de supervision', 'Mesurer, conserver, alerter — et prouver le niveau de service'),
      zone('parc', 80, 210, 400, 610, 'Parc supervisé', ARDOISE),
      glyphe('srv', 120, 290, 'i-lucide-server', 'Serveurs', ARDOISE),
      glyphe('net', 300, 290, 'i-lucide-network', 'Réseau', ARDOISE),
      glyphe('app', 120, 560, 'i-lucide-app-window', 'Applications', ARDOISE),
      glyphe('env', 300, 560, 'i-lucide-thermometer', 'Environnement', ARDOISE),
      glyphe('coll', 620, 420, 'i-lucide-workflow', 'Collecteur', VIOLET),
      glyphe('tsdb', 860, 260, 'i-lucide-chart-line', 'Métriques', CYAN),
      glyphe('logs', 860, 580, 'i-lucide-scroll-text', 'Journaux', CYAN),
      glyphe('dash', 1120, 420, 'i-lucide-gauge', 'Tableaux de bord', VERT),
      glyphe('alert', 1350, 260, 'i-lucide-bell', 'Alerting', AMBRE),
      glyphe('astr', 1350, 580, 'i-lucide-headset', 'Astreinte', ROUGE)
    ],
    wires: [
      { from: 'srv', to: 'coll' },
      { from: 'net', to: 'coll' },
      { from: 'app', to: 'coll' },
      { from: 'env', to: 'coll' },
      { from: 'coll', to: 'tsdb', color: CYAN },
      { from: 'coll', to: 'logs', color: CYAN },
      { from: 'tsdb', to: 'dash', color: VERT },
      { from: 'logs', to: 'dash', color: VERT },
      { from: 'dash', to: 'alert', label: 'Seuil franchi', color: AMBRE },
      { from: 'alert', to: 'astr', label: 'SMS · appel', color: ROUGE }
    ]
  }
]

export function findTemplate(id: string): DrawTemplate | undefined {
  return DRAW_TEMPLATES.find(template => template.id === id)
}

/**
 * Instancie un modèle.
 *
 * Les clés du modèle sont remplacées par des identifiants frais afin qu'une
 * même planche puisse être posée deux fois sans que les flèches de la seconde
 * se raccrochent aux formes de la première.
 */
export function instantiate(template: DrawTemplate, offsetX = 0, offsetY = 0): { shapes: Shape[], connectors: Connector[] } {
  const base = defaultStyle(template.background)
  const mapping = new Map<string, Shape>()

  const shapes = template.spots.map((spot) => {
    const shape = createShape(
      spot.kind,
      spot.x + offsetX,
      spot.y + offsetY,
      { text: spot.text, icon: spot.icon, w: spot.w, h: spot.h, style: spot.style },
      template.background
    )
    mapping.set(spot.key, shape)
    return shape
  })

  const connectors: Connector[] = []
  for (const wire of template.wires) {
    const from = mapping.get(wire.from)
    const to = mapping.get(wire.to)
    if (!from || !to) continue

    const stroke = wire.color ?? ARDOISE
    connectors.push({
      id: genId('c'),
      from: { shapeId: from.id, side: 'auto', x: 0, y: 0 },
      to: { shapeId: to.id, side: 'auto', x: 0, y: 0 },
      label: wire.label,
      routing: wire.routing ?? 'curved',
      startArrow: Boolean(wire.both),
      endArrow: true,
      style: {
        ...styleForKind('rect', base),
        fill: 'none',
        stroke,
        color: stroke,
        strokeWidth: 2,
        dash: wire.dashed ? 'dashed' : 'solid',
        fontSize: 14
      }
    })
  }

  return { shapes, connectors }
}

/** Recadrage indicatif : les modèles sont dessinés pour la planche entière. */
export const TEMPLATE_FRAME = { width: PAGE_W, height: PAGE_H }
