/**
 * Socle du traducteur « phrase française vers commande ».
 *
 * Aucun modèle de langue : le moteur repose sur un catalogue d'intentions
 * pondérées et sur l'extraction de paramètres. C'est un choix assumé — une
 * commande d'administration inventée est pire qu'une absence de réponse, donc
 * l'outil ne rend que ce qu'il connaît, et le dit quand il ne sait pas.
 */

export type PlatformId =
  | 'debian' | 'rhel' | 'windows' | 'macos'
  | 'cisco' | 'mikrotik' | 'junos' | 'docker'

export interface Platform {
  id: PlatformId
  label: string
  short: string
  icon: string
  /** Interpréteur ou console visée. */
  shell: string
  hint: string
}

export const PLATFORMS: Platform[] = [
  {
    id: 'debian',
    label: 'Linux — Debian / Ubuntu',
    short: 'Debian',
    icon: 'i-lucide-terminal',
    shell: 'bash',
    hint: 'apt, ufw, systemd'
  },
  {
    id: 'rhel',
    label: 'Linux — RHEL / Rocky / Fedora',
    short: 'RHEL',
    icon: 'i-lucide-square-terminal',
    shell: 'bash',
    hint: 'dnf, firewalld, systemd'
  },
  {
    id: 'windows',
    label: 'Windows Server / 11',
    short: 'Windows',
    icon: 'i-lucide-app-window',
    shell: 'PowerShell',
    hint: 'cmdlets PowerShell 5.1+'
  },
  {
    id: 'macos',
    label: 'macOS',
    short: 'macOS',
    icon: 'i-lucide-command',
    shell: 'zsh',
    hint: 'launchd, pf, homebrew'
  },
  {
    id: 'cisco',
    label: 'Cisco IOS / IOS-XE',
    short: 'Cisco',
    icon: 'i-lucide-router',
    shell: 'CLI IOS',
    hint: 'mode de configuration'
  },
  {
    id: 'mikrotik',
    label: 'MikroTik RouterOS',
    short: 'MikroTik',
    icon: 'i-lucide-radio-tower',
    shell: 'RouterOS CLI',
    hint: 'arborescence /ip, /interface'
  },
  {
    id: 'junos',
    label: 'Juniper JunOS',
    short: 'JunOS',
    icon: 'i-lucide-git-fork',
    shell: 'CLI JunOS',
    hint: 'mode configure, commit'
  },
  {
    id: 'docker',
    label: 'Docker',
    short: 'Docker',
    icon: 'i-lucide-container',
    shell: 'docker CLI',
    hint: 'conteneurs et images'
  }
]

export function findPlatform(id: string): Platform | undefined {
  return PLATFORMS.find(platform => platform.id === id)
}

/* ------------------------------------------------------------ Paramètres */

export interface SlotDefinition {
  id: string
  label: string
  placeholder: string
  /** Valeur retenue quand la phrase n'en fournit pas. */
  fallback?: string
  hint?: string
}

export interface Recipe {
  /** Commandes à exécuter, dans l'ordre. */
  commands: string[]
  /** Commande de contrôle, pour vérifier que l'effet est bien là. */
  verify?: string
  /** Commande inverse, pour revenir en arrière. */
  undo?: string
  note?: string
  /** Mise en garde : opération destructrice ou coupure de service. */
  danger?: string
}

export interface Intent {
  id: string
  label: string
  category: string
  /** Termes déclencheurs et leur poids. Trois et plus font office d'ancre. */
  keywords: [string, number][]
  /** Termes qui disqualifient l'intention. */
  exclude?: string[]
  slots: SlotDefinition[]
  platforms: Partial<Record<PlatformId, Recipe>>
  examples: string[]
}

/* ------------------------------------------------------------- Glossaire */

/**
 * Sens des mots-clés rencontrés dans les commandes rendues.
 *
 * L'explication est assemblée depuis ce dictionnaire plutôt que rédigée pour
 * chaque recette : un même drapeau garde ainsi la même définition partout.
 */
export const GLOSSARY: Record<string, string> = {
  /* Généralités */
  sudo: 'exécute la commande avec les droits de l\'administrateur',
  '&&': 'enchaîne : la suite ne s\'exécute que si ce qui précède a réussi',
  '|': 'passe la sortie de la commande précédente à la suivante',
  tee: 'écrit dans un fichier tout en affichant le résultat',

  /* Pare-feu Linux */
  ufw: 'interface simplifiée du pare-feu netfilter, sur Debian et Ubuntu',
  allow: 'autorise le trafic décrit',
  deny: 'rejette le trafic sans réponse',
  reject: 'refuse le trafic en renvoyant une erreur',
  'firewall-cmd': 'client en ligne de commande de firewalld, sur RHEL et dérivés',
  '--permanent': 'écrit la règle dans la configuration, pour qu\'elle survive au redémarrage',
  '--reload': 'recharge la configuration permanente dans le pare-feu actif',
  '--add-port': 'ouvre un port',
  '--remove-port': 'referme un port',
  '--list-all': 'affiche la zone active et toutes ses règles',
  iptables: 'manipulation directe des règles netfilter',
  nft: 'successeur d\'iptables, syntaxe nftables',

  /* Services */
  systemctl: 'pilote les services gérés par systemd',
  start: 'démarre maintenant',
  stop: 'arrête maintenant',
  restart: 'arrête puis redémarre',
  reload: 'recharge la configuration sans couper le service',
  enable: 'active le démarrage automatique au boot',
  disable: 'retire le démarrage automatique',
  status: 'affiche l\'état courant',
  journalctl: 'consulte le journal de systemd',
  '-u': 'restreint au service nommé',
  '-f': 'suit le flux en continu, comme tail -f',
  '-b': 'limite au démarrage courant',
  '-p': 'filtre par priorité de message',

  /* Réseau */
  ip: 'outil réseau moderne de Linux, remplaçant d\'ifconfig',
  addr: 'sous-commande des adresses',
  link: 'sous-commande des interfaces',
  route: 'sous-commande des routes',
  neigh: 'table des voisins, équivalent ARP',
  ss: 'affiche les sockets, remplaçant de netstat',
  '-tulpn': 'TCP et UDP, en écoute, avec le processus, sans résolution de noms',
  dig: 'interrogation DNS détaillée',
  '+short': 'ne garde que la réponse, sans l\'en-tête',
  ping: 'teste la joignabilité par ICMP',
  '-c': 'nombre d\'essais avant de s\'arrêter',
  traceroute: 'affiche les routeurs traversés',
  mtr: 'traceroute continu avec statistiques de perte',
  tcpdump: 'capture les trames qui passent sur une interface',
  '-i': 'interface à écouter',
  '-w': 'écrit la capture dans un fichier',
  '-nn': 'n\'essaie de résoudre ni les noms ni les ports',
  curl: 'client HTTP en ligne de commande',
  nc: 'ouvre ou teste une connexion brute',

  /* Paquets */
  apt: 'gestionnaire de paquets de Debian et Ubuntu',
  dnf: 'gestionnaire de paquets de RHEL, Rocky et Fedora',
  brew: 'gestionnaire de paquets Homebrew, sur macOS',
  install: 'installe le paquet',
  remove: 'désinstalle le paquet',
  update: 'met à jour la liste des paquets disponibles',
  upgrade: 'installe les mises à jour disponibles',
  '-y': 'répond oui à toutes les questions',

  /* Fichiers et disques */
  df: 'espace occupé par système de fichiers',
  du: 'espace occupé par un dossier',
  '-h': 'unités lisibles : Ko, Mo, Go',
  '-sh': 'total du dossier, en unités lisibles',
  lsblk: 'liste les disques et leurs partitions',
  mount: 'rattache un système de fichiers à un dossier',
  umount: 'détache un système de fichiers',
  find: 'parcourt une arborescence selon des critères',
  '-size': 'filtre sur la taille',
  '-name': 'filtre sur le nom',
  '-type': 'filtre sur le type d\'entrée',
  chmod: 'change les droits d\'accès',
  chown: 'change le propriétaire',
  '-R': 'applique récursivement à tout le contenu',
  tar: 'archive ou extrait une arborescence',
  '-czf': 'crée une archive compressée en gzip',
  '-xzf': 'extrait une archive compressée en gzip',
  rsync: 'copie différentielle, locale ou distante',
  '-avz': 'mode archive, verbeux, compressé pendant le transfert',
  scp: 'copie un fichier par SSH',

  /* Comptes */
  useradd: 'crée un compte',
  usermod: 'modifie un compte existant',
  userdel: 'supprime un compte',
  passwd: 'change un mot de passe',
  '-aG': 'ajoute à un groupe secondaire sans retirer les autres',
  '-m': 'crée le dossier personnel',

  /* Processus */
  ps: 'liste les processus',
  aux: 'tous les processus, de tous les utilisateurs, avec le détail',
  top: 'vue temps réel de la charge',
  htop: 'vue temps réel interactive',
  kill: 'envoie un signal à un processus',
  pkill: 'envoie un signal aux processus dont le nom correspond',
  '-9': 'signal KILL, non interceptable : dernier recours',
  '-15': 'signal TERM, demande une fermeture propre',

  /* SSH et certificats */
  'ssh-keygen': 'génère une paire de clés',
  'ssh-copy-id': 'installe la clé publique chez l\'hôte distant',
  '-t': 'type de clé à produire',
  openssl: 'boîte à outils cryptographique',
  x509: 'manipulation de certificats au format X.509',
  '-noout': 'n\'affiche pas le certificat encodé, seulement ce qui est demandé',
  '-dates': 'dates de début et de fin de validité',

  /* Docker */
  docker: 'client du moteur de conteneurs',
  logs: 'affiche la sortie du conteneur',
  exec: 'exécute une commande dans un conteneur en marche',
  '-it': 'mode interactif avec un terminal attaché',

  /* PowerShell */
  'Get-NetFirewallRule': 'liste les règles du pare-feu Windows',
  'New-NetFirewallRule': 'crée une règle de pare-feu',
  'Remove-NetFirewallRule': 'supprime une règle de pare-feu',
  '-Direction': 'sens du trafic : entrant ou sortant',
  '-LocalPort': 'port local concerné',
  '-Action': 'décision appliquée : autoriser ou bloquer',
  'Get-Service': 'état d\'un service Windows',
  'Restart-Service': 'redémarre un service',
  'Set-Service': 'modifie la configuration d\'un service',
  'Get-Process': 'liste les processus',
  'Stop-Process': 'termine un processus',
  'Test-NetConnection': 'teste la joignabilité d\'un hôte et d\'un port',
  'Get-NetIPAddress': 'adresses IP configurées',
  'Get-NetTCPConnection': 'connexions TCP en cours',
  'Resolve-DnsName': 'résolution DNS',
  'Get-WinEvent': 'lecture des journaux d\'événements',
  'Get-Volume': 'volumes et espace libre',
  winget: 'gestionnaire de paquets de Windows',

  /* Équipements réseau */
  configure: 'entre en mode configuration',
  commit: 'applique la configuration en attente',
  'write memory': 'enregistre la configuration courante en mémoire de démarrage',
  'show running-config': 'affiche la configuration active',
  'access-list': 'liste de contrôle d\'accès',
  permit: 'autorise le trafic décrit',
  '/ip': 'branche des réglages IP de RouterOS',
  '/interface': 'branche des interfaces de RouterOS',
  print: 'affiche le contenu de la branche courante'
}

/** Ports usuels, pour comprendre « ouvrir le port ssh ». */
export const WELL_KNOWN_PORTS: Record<string, { port: number, proto: 'tcp' | 'udp' }> = {
  ftp: { port: 21, proto: 'tcp' },
  ssh: { port: 22, proto: 'tcp' },
  sftp: { port: 22, proto: 'tcp' },
  telnet: { port: 23, proto: 'tcp' },
  smtp: { port: 25, proto: 'tcp' },
  dns: { port: 53, proto: 'udp' },
  tftp: { port: 69, proto: 'udp' },
  http: { port: 80, proto: 'tcp' },
  pop3: { port: 110, proto: 'tcp' },
  ntp: { port: 123, proto: 'udp' },
  imap: { port: 143, proto: 'tcp' },
  snmp: { port: 161, proto: 'udp' },
  ldap: { port: 389, proto: 'tcp' },
  https: { port: 443, proto: 'tcp' },
  smb: { port: 445, proto: 'tcp' },
  syslog: { port: 514, proto: 'udp' },
  ldaps: { port: 636, proto: 'tcp' },
  imaps: { port: 993, proto: 'tcp' },
  rsync: { port: 873, proto: 'tcp' },
  mysql: { port: 3306, proto: 'tcp' },
  rdp: { port: 3389, proto: 'tcp' },
  postgres: { port: 5432, proto: 'tcp' },
  postgresql: { port: 5432, proto: 'tcp' },
  vnc: { port: 5900, proto: 'tcp' },
  redis: { port: 6379, proto: 'tcp' },
  kubernetes: { port: 6443, proto: 'tcp' },
  elasticsearch: { port: 9200, proto: 'tcp' },
  prometheus: { port: 9090, proto: 'tcp' },
  mongodb: { port: 27017, proto: 'tcp' }
}
