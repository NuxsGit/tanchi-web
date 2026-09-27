/**
 * Bibliothèque d'icônes de TanchiDraw.
 *
 * Le vocabulaire visuel d'un administrateur système : ce qu'il montre à un
 * client tient dans une centaine de symboles — un serveur, un pare-feu, un
 * nuage, un poste, un bâtiment. Chaque entrée porte des mots-clés en français
 * *et* en anglais : on cherche aussi bien « pare-feu » que « firewall ».
 */

export type DrawCategoryId =
  | 'reseau' | 'serveurs' | 'cloud' | 'stockage' | 'securite'
  | 'postes' | 'sites' | 'services' | 'peripheriques' | 'symboles'

export interface DrawCategory {
  id: DrawCategoryId
  label: string
  icon: string
  hint: string
}

export interface DrawIcon {
  id: string
  label: string
  /** Nom Iconify, résolu côté serveur en tracé SVG. */
  icon: string
  category: DrawCategoryId
  tags: string[]
}

/** Ordre du dock : du plus structurant au plus décoratif. */
export const DRAW_CATEGORIES: DrawCategory[] = [
  { id: 'reseau', label: 'Réseau', icon: 'i-lucide-network', hint: 'Commutation, routage, liaisons' },
  { id: 'serveurs', label: 'Serveurs & calcul', icon: 'i-lucide-server', hint: 'Machines physiques et virtuelles' },
  { id: 'cloud', label: 'Cloud & conteneurs', icon: 'i-lucide-cloud', hint: 'Nuage public, privé, orchestration' },
  { id: 'stockage', label: 'Stockage & données', icon: 'i-lucide-database', hint: 'Bases, NAS, sauvegardes' },
  { id: 'securite', label: 'Sécurité', icon: 'i-lucide-shield', hint: 'Pare-feu, accès, chiffrement' },
  { id: 'postes', label: 'Postes & utilisateurs', icon: 'i-lucide-monitor', hint: 'Clients, équipes, terminaux' },
  { id: 'sites', label: 'Sites & entreprise', icon: 'i-lucide-building-2', hint: 'Bâtiments, agences, télétravail' },
  { id: 'services', label: 'Services & applications', icon: 'i-lucide-app-window', hint: 'Messagerie, web, supervision' },
  { id: 'peripheriques', label: 'Périphériques & énergie', icon: 'i-lucide-plug', hint: 'Impression, vidéo, courant' },
  { id: 'symboles', label: 'Symboles & annotations', icon: 'i-lucide-sparkles', hint: 'Validations, alertes, repères' }
]

export const DRAW_ICONS: DrawIcon[] = [
  /* ------------------------------------------------------------- Réseau */
  { id: 'net-router', label: 'Routeur', icon: 'i-lucide-router', category: 'reseau', tags: ['router', 'passerelle', 'gateway'] },
  { id: 'net-switch', label: 'Commutateur', icon: 'i-lucide-network', category: 'reseau', tags: ['switch', 'commutation', 'lan'] },
  { id: 'net-switch-core', label: 'Cœur de réseau', icon: 'i-lucide-grid-3x3', category: 'reseau', tags: ['core', 'chassis', 'backbone'] },
  { id: 'net-firewall', label: 'Pare-feu', icon: 'i-lucide-brick-wall', category: 'reseau', tags: ['firewall', 'filtrage', 'utm'] },
  { id: 'net-lb', label: 'Répartiteur de charge', icon: 'i-lucide-split', category: 'reseau', tags: ['load balancer', 'haproxy', 'répartition'] },
  { id: 'net-internet', label: 'Internet', icon: 'i-lucide-globe', category: 'reseau', tags: ['internet', 'web', 'wan', 'public'] },
  { id: 'net-wan', label: 'WAN / opérateur', icon: 'i-lucide-earth', category: 'reseau', tags: ['wan', 'mpls', 'opérateur', 'fai'] },
  { id: 'net-box', label: 'Box opérateur', icon: 'i-lucide-radio', category: 'reseau', tags: ['modem', 'box', 'fai', 'adsl', 'fibre'] },
  { id: 'net-wifi', label: 'Wi-Fi', icon: 'i-lucide-wifi', category: 'reseau', tags: ['wifi', 'sans-fil', 'wlan'] },
  { id: 'net-ap', label: 'Point d\'accès', icon: 'i-lucide-radio-tower', category: 'reseau', tags: ['ap', 'borne', 'wifi'] },
  { id: 'net-antenna', label: 'Antenne', icon: 'i-lucide-antenna', category: 'reseau', tags: ['antenne', 'relais', 'faisceau'] },
  { id: 'net-satellite', label: 'Liaison satellite', icon: 'i-lucide-satellite-dish', category: 'reseau', tags: ['satellite', 'vsat'] },
  { id: 'net-vpn', label: 'Tunnel VPN', icon: 'i-lucide-globe-lock', category: 'reseau', tags: ['vpn', 'ipsec', 'tunnel', 'chiffré'] },
  { id: 'net-vlan', label: 'VLAN', icon: 'i-lucide-layers', category: 'reseau', tags: ['vlan', 'segmentation', 'trunk'] },
  { id: 'net-route', label: 'Routage', icon: 'i-lucide-route', category: 'reseau', tags: ['route', 'bgp', 'ospf'] },
  { id: 'net-proxy', label: 'Proxy', icon: 'i-lucide-arrow-left-right', category: 'reseau', tags: ['proxy', 'relais', 'reverse'] },
  { id: 'net-gateway', label: 'Passerelle', icon: 'i-lucide-door-open', category: 'reseau', tags: ['gateway', 'sortie', 'nat'] },
  { id: 'net-cable', label: 'Câblage', icon: 'i-lucide-cable', category: 'reseau', tags: ['câble', 'rj45', 'cuivre'] },
  { id: 'net-fiber', label: 'Fibre optique', icon: 'i-lucide-waypoints', category: 'reseau', tags: ['fibre', 'optique', 'lc', 'sfp'] },
  { id: 'net-port', label: 'Port Ethernet', icon: 'i-lucide-ethernet-port', category: 'reseau', tags: ['port', 'rj45', 'interface'] },
  { id: 'net-patch', label: 'Baie de brassage', icon: 'i-lucide-rows-3', category: 'reseau', tags: ['patch panel', 'brassage', 'baie'] },
  { id: 'net-signal', label: 'Qualité de lien', icon: 'i-lucide-signal', category: 'reseau', tags: ['signal', 'débit', 'qos'] },
  { id: 'net-bandwidth', label: 'Bande passante', icon: 'i-lucide-gauge', category: 'reseau', tags: ['débit', 'bande passante', 'qos'] },
  { id: 'net-ip', label: 'Adressage IP', icon: 'i-lucide-map-pin', category: 'reseau', tags: ['ip', 'subnet', 'cidr'] },

  /* -------------------------------------------------- Serveurs & calcul */
  { id: 'srv-server', label: 'Serveur', icon: 'i-lucide-server', category: 'serveurs', tags: ['serveur', 'rack', 'machine'] },
  { id: 'srv-server-cog', label: 'Serveur applicatif', icon: 'i-lucide-server-cog', category: 'serveurs', tags: ['serveur', 'application', 'backend'] },
  { id: 'srv-cluster', label: 'Grappe de serveurs', icon: 'i-lucide-boxes', category: 'serveurs', tags: ['cluster', 'grappe', 'ferme'] },
  { id: 'srv-blade', label: 'Châssis lames', icon: 'i-lucide-layers-3', category: 'serveurs', tags: ['blade', 'châssis', 'densité'] },
  { id: 'srv-tower', label: 'Serveur tour', icon: 'i-lucide-pc-case', category: 'serveurs', tags: ['tour', 'bureau', 'tpe'] },
  { id: 'srv-cpu', label: 'Processeur', icon: 'i-lucide-cpu', category: 'serveurs', tags: ['cpu', 'calcul', 'vcpu'] },
  { id: 'srv-ram', label: 'Mémoire vive', icon: 'i-lucide-memory-stick', category: 'serveurs', tags: ['ram', 'mémoire'] },
  { id: 'srv-gpu', label: 'Nœud GPU', icon: 'i-lucide-microchip', category: 'serveurs', tags: ['gpu', 'ia', 'calcul'] },
  { id: 'srv-vm', label: 'Machine virtuelle', icon: 'i-lucide-square-stack', category: 'serveurs', tags: ['vm', 'virtuelle', 'kvm'] },
  { id: 'srv-hypervisor', label: 'Hyperviseur', icon: 'i-lucide-layers-2', category: 'serveurs', tags: ['esxi', 'proxmox', 'hyperviseur'] },
  { id: 'srv-terminal', label: 'Console / shell', icon: 'i-lucide-square-terminal', category: 'serveurs', tags: ['terminal', 'ssh', 'shell'] },
  { id: 'srv-bastion', label: 'Bastion', icon: 'i-lucide-key-round', category: 'serveurs', tags: ['bastion', 'jump', 'rebond'] },
  { id: 'srv-down', label: 'Serveur en panne', icon: 'i-lucide-server-crash', category: 'serveurs', tags: ['panne', 'incident', 'down'] },
  { id: 'srv-off', label: 'Serveur arrêté', icon: 'i-lucide-server-off', category: 'serveurs', tags: ['arrêt', 'maintenance', 'off'] },

  /* ------------------------------------------------- Cloud & conteneurs */
  { id: 'cloud-cloud', label: 'Cloud', icon: 'i-lucide-cloud', category: 'cloud', tags: ['cloud', 'nuage', 'public'] },
  { id: 'cloud-private', label: 'Cloud privé', icon: 'i-lucide-cloud-cog', category: 'cloud', tags: ['cloud privé', 'hébergé', 'iaas'] },
  { id: 'cloud-upload', label: 'Envoi vers le cloud', icon: 'i-lucide-cloud-upload', category: 'cloud', tags: ['upload', 'synchronisation', 'export'] },
  { id: 'cloud-download', label: 'Restauration cloud', icon: 'i-lucide-cloud-download', category: 'cloud', tags: ['download', 'restauration', 'import'] },
  { id: 'cloud-off', label: 'Hors ligne', icon: 'i-lucide-cloud-off', category: 'cloud', tags: ['hors ligne', 'coupure', 'panne'] },
  { id: 'cloud-container', label: 'Conteneur', icon: 'i-lucide-container', category: 'cloud', tags: ['docker', 'conteneur', 'oci'] },
  { id: 'cloud-image', label: 'Image / paquet', icon: 'i-lucide-package', category: 'cloud', tags: ['image', 'registry', 'paquet'] },
  { id: 'cloud-k8s', label: 'Kubernetes', icon: 'i-lucide-hexagon', category: 'cloud', tags: ['kubernetes', 'k8s', 'orchestration'] },
  { id: 'cloud-serverless', label: 'Fonction serverless', icon: 'i-lucide-zap', category: 'cloud', tags: ['serverless', 'lambda', 'fonction'] },
  { id: 'cloud-app', label: 'Application hébergée', icon: 'i-lucide-app-window', category: 'cloud', tags: ['saas', 'application', 'web'] },
  { id: 'cloud-git', label: 'Dépôt Git', icon: 'i-lucide-git-branch', category: 'cloud', tags: ['git', 'dépôt', 'code'] },
  { id: 'cloud-ci', label: 'Chaîne CI/CD', icon: 'i-lucide-infinity', category: 'cloud', tags: ['ci', 'cd', 'devops', 'pipeline'] },
  { id: 'cloud-deploy', label: 'Déploiement', icon: 'i-lucide-rocket', category: 'cloud', tags: ['déploiement', 'mise en production'] },
  { id: 'cloud-region', label: 'Région / zone', icon: 'i-lucide-orbit', category: 'cloud', tags: ['région', 'zone', 'disponibilité'] },

  /* ------------------------------------------------ Stockage & données */
  { id: 'sto-db', label: 'Base de données', icon: 'i-lucide-database', category: 'stockage', tags: ['bdd', 'sql', 'base'] },
  { id: 'sto-db-backup', label: 'Sauvegarde de base', icon: 'i-lucide-database-backup', category: 'stockage', tags: ['dump', 'sauvegarde', 'bdd'] },
  { id: 'sto-cache', label: 'Cache', icon: 'i-lucide-database-zap', category: 'stockage', tags: ['redis', 'cache', 'mémoire'] },
  { id: 'sto-nas', label: 'NAS', icon: 'i-lucide-hard-drive', category: 'stockage', tags: ['nas', 'partage', 'smb', 'nfs'] },
  { id: 'sto-san', label: 'Baie SAN', icon: 'i-lucide-hard-drive-download', category: 'stockage', tags: ['san', 'baie', 'iscsi'] },
  { id: 'sto-backup', label: 'Sauvegarde', icon: 'i-lucide-archive', category: 'stockage', tags: ['backup', 'sauvegarde', 'archive'] },
  { id: 'sto-tape', label: 'Bande / archivage', icon: 'i-lucide-disc', category: 'stockage', tags: ['lto', 'bande', 'archivage'] },
  { id: 'sto-snapshot', label: 'Instantané', icon: 'i-lucide-history', category: 'stockage', tags: ['snapshot', 'instantané', 'versions'] },
  { id: 'sto-folder', label: 'Partage de fichiers', icon: 'i-lucide-folder', category: 'stockage', tags: ['dossier', 'partage', 'fichiers'] },
  { id: 'sto-files', label: 'Documents', icon: 'i-lucide-files', category: 'stockage', tags: ['documents', 'fichiers', 'ged'] },
  { id: 'sto-vault', label: 'Coffre-fort', icon: 'i-lucide-vault', category: 'stockage', tags: ['coffre', 'secrets', 'vault'] },
  { id: 'sto-raid', label: 'Volume RAID', icon: 'i-lucide-layers', category: 'stockage', tags: ['raid', 'volume', 'grappe'] },

  /* -------------------------------------------------------- Sécurité */
  { id: 'sec-shield', label: 'Protection', icon: 'i-lucide-shield', category: 'securite', tags: ['sécurité', 'protection', 'bouclier'] },
  { id: 'sec-shield-ok', label: 'Conformité', icon: 'i-lucide-shield-check', category: 'securite', tags: ['conforme', 'validé', 'audit'] },
  { id: 'sec-shield-alert', label: 'Menace', icon: 'i-lucide-shield-alert', category: 'securite', tags: ['menace', 'alerte', 'risque'] },
  { id: 'sec-lock', label: 'Chiffrement', icon: 'i-lucide-lock', category: 'securite', tags: ['chiffrement', 'tls', 'verrou'] },
  { id: 'sec-key', label: 'Clé d\'accès', icon: 'i-lucide-key', category: 'securite', tags: ['clé', 'ssh', 'api'] },
  { id: 'sec-cert', label: 'Certificat', icon: 'i-lucide-file-badge', category: 'securite', tags: ['certificat', 'ssl', 'pki'] },
  { id: 'sec-mfa', label: 'Double facteur', icon: 'i-lucide-fingerprint', category: 'securite', tags: ['mfa', '2fa', 'biométrie'] },
  { id: 'sec-ids', label: 'Détection d\'intrusion', icon: 'i-lucide-radar', category: 'securite', tags: ['ids', 'ips', 'détection'] },
  { id: 'sec-malware', label: 'Logiciel malveillant', icon: 'i-lucide-bug', category: 'securite', tags: ['virus', 'malware', 'rançongiciel'] },
  { id: 'sec-alarm', label: 'Alerte sécurité', icon: 'i-lucide-siren', category: 'securite', tags: ['alerte', 'incident', 'soc'] },
  { id: 'sec-audit', label: 'Journalisation', icon: 'i-lucide-scroll-text', category: 'securite', tags: ['logs', 'journaux', 'audit', 'siem'] },
  { id: 'sec-access', label: 'Contrôle d\'accès', icon: 'i-lucide-lock-keyhole', category: 'securite', tags: ['accès', 'rbac', 'permission'] },

  /* --------------------------------------------- Postes & utilisateurs */
  { id: 'usr-user', label: 'Utilisateur', icon: 'i-lucide-user', category: 'postes', tags: ['utilisateur', 'client', 'personne'] },
  { id: 'usr-users', label: 'Équipe', icon: 'i-lucide-users', category: 'postes', tags: ['équipe', 'groupe', 'collaborateurs'] },
  { id: 'usr-admin', label: 'Administrateur', icon: 'i-lucide-user-cog', category: 'postes', tags: ['admin', 'sysadmin', 'exploitant'] },
  { id: 'usr-client', label: 'Client', icon: 'i-lucide-user-round', category: 'postes', tags: ['client', 'visiteur', 'externe'] },
  { id: 'usr-pc', label: 'Poste fixe', icon: 'i-lucide-monitor', category: 'postes', tags: ['pc', 'poste', 'bureau'] },
  { id: 'usr-laptop', label: 'Ordinateur portable', icon: 'i-lucide-laptop', category: 'postes', tags: ['portable', 'laptop', 'nomade'] },
  { id: 'usr-mobile', label: 'Smartphone', icon: 'i-lucide-smartphone', category: 'postes', tags: ['mobile', 'téléphone', 'byod'] },
  { id: 'usr-tablet', label: 'Tablette', icon: 'i-lucide-tablet', category: 'postes', tags: ['tablette', 'ipad'] },
  { id: 'usr-support', label: 'Support / helpdesk', icon: 'i-lucide-headset', category: 'postes', tags: ['support', 'assistance', 'helpdesk'] },
  { id: 'usr-remote', label: 'Poste distant', icon: 'i-lucide-monitor-smartphone', category: 'postes', tags: ['télétravail', 'distant', 'rdp'] },
  { id: 'usr-directory', label: 'Annuaire', icon: 'i-lucide-book-user', category: 'postes', tags: ['ldap', 'active directory', 'annuaire'] },
  { id: 'usr-badge', label: 'Identité', icon: 'i-lucide-badge-check', category: 'postes', tags: ['identité', 'sso', 'compte'] },

  /* ------------------------------------------------- Sites & entreprise */
  { id: 'site-office', label: 'Bureau', icon: 'i-lucide-building', category: 'sites', tags: ['bureau', 'locaux', 'site'] },
  { id: 'site-company', label: 'Entreprise', icon: 'i-lucide-building-2', category: 'sites', tags: ['entreprise', 'siège', 'société'] },
  { id: 'site-factory', label: 'Usine', icon: 'i-lucide-factory', category: 'sites', tags: ['usine', 'industrie', 'production'] },
  { id: 'site-warehouse', label: 'Entrepôt', icon: 'i-lucide-warehouse', category: 'sites', tags: ['entrepôt', 'logistique', 'stock'] },
  { id: 'site-shop', label: 'Boutique', icon: 'i-lucide-store', category: 'sites', tags: ['magasin', 'boutique', 'point de vente'] },
  { id: 'site-home', label: 'Télétravail', icon: 'i-lucide-house', category: 'sites', tags: ['domicile', 'télétravail', 'maison'] },
  { id: 'site-datacenter', label: 'Datacenter', icon: 'i-lucide-columns-3', category: 'sites', tags: ['datacenter', 'salle serveur', 'baies'] },
  { id: 'site-school', label: 'École', icon: 'i-lucide-school', category: 'sites', tags: ['école', 'campus', 'formation'] },
  { id: 'site-hospital', label: 'Hôpital', icon: 'i-lucide-hospital', category: 'sites', tags: ['hôpital', 'santé', 'clinique'] },
  { id: 'site-gov', label: 'Administration', icon: 'i-lucide-landmark', category: 'sites', tags: ['mairie', 'public', 'administration'] },
  { id: 'site-map', label: 'Site géographique', icon: 'i-lucide-map', category: 'sites', tags: ['carte', 'site', 'agence'] },
  { id: 'site-pin', label: 'Emplacement', icon: 'i-lucide-map-pin', category: 'sites', tags: ['lieu', 'adresse', 'localisation'] },

  /* -------------------------------------------- Services & applications */
  { id: 'svc-mail', label: 'Messagerie', icon: 'i-lucide-mail', category: 'services', tags: ['mail', 'smtp', 'exchange'] },
  { id: 'svc-web', label: 'Site web', icon: 'i-lucide-globe-check', category: 'services', tags: ['web', 'http', 'site'] },
  { id: 'svc-api', label: 'API', icon: 'i-lucide-webhook', category: 'services', tags: ['api', 'rest', 'webhook'] },
  { id: 'svc-dns', label: 'DNS', icon: 'i-lucide-book-marked', category: 'services', tags: ['dns', 'résolution', 'zone'] },
  { id: 'svc-dhcp', label: 'DHCP', icon: 'i-lucide-list-ordered', category: 'services', tags: ['dhcp', 'bail', 'adressage'] },
  { id: 'svc-print', label: 'Serveur d\'impression', icon: 'i-lucide-printer', category: 'services', tags: ['impression', 'imprimante', 'spool'] },
  { id: 'svc-calendar', label: 'Agenda', icon: 'i-lucide-calendar', category: 'services', tags: ['agenda', 'calendrier', 'planning'] },
  { id: 'svc-chat', label: 'Messagerie instantanée', icon: 'i-lucide-message-square', category: 'services', tags: ['chat', 'teams', 'slack'] },
  { id: 'svc-voip', label: 'Téléphonie', icon: 'i-lucide-phone', category: 'services', tags: ['voip', 'sip', 'téléphonie'] },
  { id: 'svc-video', label: 'Visioconférence', icon: 'i-lucide-video', category: 'services', tags: ['visio', 'réunion', 'conférence'] },
  { id: 'svc-monitoring', label: 'Supervision', icon: 'i-lucide-activity', category: 'services', tags: ['supervision', 'monitoring', 'zabbix'] },
  { id: 'svc-metrics', label: 'Métriques', icon: 'i-lucide-chart-line', category: 'services', tags: ['métriques', 'grafana', 'graphes'] },
  { id: 'svc-alerting', label: 'Alerting', icon: 'i-lucide-bell', category: 'services', tags: ['alerte', 'notification', 'astreinte'] },
  { id: 'svc-erp', label: 'ERP / métier', icon: 'i-lucide-briefcase', category: 'services', tags: ['erp', 'métier', 'gestion'] },
  { id: 'svc-shop', label: 'Boutique en ligne', icon: 'i-lucide-shopping-cart', category: 'services', tags: ['e-commerce', 'boutique', 'panier'] },
  { id: 'svc-pay', label: 'Paiement', icon: 'i-lucide-credit-card', category: 'services', tags: ['paiement', 'facturation', 'banque'] },
  { id: 'svc-search', label: 'Moteur de recherche', icon: 'i-lucide-search', category: 'services', tags: ['recherche', 'index', 'elastic'] },
  { id: 'svc-workflow', label: 'Automatisation', icon: 'i-lucide-workflow', category: 'services', tags: ['automatisation', 'ansible', 'orchestration'] },

  /* ---------------------------------------- Périphériques & énergie */
  { id: 'per-printer', label: 'Imprimante', icon: 'i-lucide-printer', category: 'peripheriques', tags: ['imprimante', 'copieur'] },
  { id: 'per-scanner', label: 'Scanner', icon: 'i-lucide-scan-line', category: 'peripheriques', tags: ['scanner', 'numérisation'] },
  { id: 'per-camera', label: 'Caméra de surveillance', icon: 'i-lucide-cctv', category: 'peripheriques', tags: ['caméra', 'vidéosurveillance', 'ip'] },
  { id: 'per-screen', label: 'Écran d\'affichage', icon: 'i-lucide-tv', category: 'peripheriques', tags: ['écran', 'affichage', 'tv'] },
  { id: 'per-door', label: 'Contrôle d\'accès', icon: 'i-lucide-door-closed', category: 'peripheriques', tags: ['badge', 'porte', 'accès'] },
  { id: 'per-sensor', label: 'Capteur', icon: 'i-lucide-thermometer', category: 'peripheriques', tags: ['capteur', 'température', 'iot'] },
  { id: 'per-light', label: 'Éclairage connecté', icon: 'i-lucide-lightbulb', category: 'peripheriques', tags: ['éclairage', 'domotique', 'iot'] },
  { id: 'per-usb', label: 'Périphérique USB', icon: 'i-lucide-usb', category: 'peripheriques', tags: ['usb', 'clé', 'périphérique'] },
  { id: 'per-power', label: 'Alimentation', icon: 'i-lucide-plug', category: 'peripheriques', tags: ['prise', 'secteur', 'alimentation'] },
  { id: 'per-pdu', label: 'PDU', icon: 'i-lucide-plug-zap', category: 'peripheriques', tags: ['pdu', 'bandeau', 'baie'] },
  { id: 'per-ups', label: 'Onduleur', icon: 'i-lucide-battery-charging', category: 'peripheriques', tags: ['onduleur', 'ups', 'secours'] },
  { id: 'per-generator', label: 'Groupe électrogène', icon: 'i-lucide-fuel', category: 'peripheriques', tags: ['groupe', 'électrogène', 'secours'] },
  { id: 'per-cooling', label: 'Climatisation', icon: 'i-lucide-fan', category: 'peripheriques', tags: ['clim', 'refroidissement', 'ventilation'] },
  { id: 'per-rack', label: 'Baie informatique', icon: 'i-lucide-server', category: 'peripheriques', tags: ['baie', 'rack', 'armoire'] },

  /* --------------------------------------------- Symboles & annotations */
  { id: 'sym-check', label: 'Validé', icon: 'i-lucide-circle-check', category: 'symboles', tags: ['ok', 'validé', 'terminé'] },
  { id: 'sym-cross', label: 'Refusé', icon: 'i-lucide-circle-x', category: 'symboles', tags: ['ko', 'refusé', 'bloqué'] },
  { id: 'sym-warning', label: 'Avertissement', icon: 'i-lucide-triangle-alert', category: 'symboles', tags: ['attention', 'risque', 'alerte'] },
  { id: 'sym-info', label: 'Information', icon: 'i-lucide-info', category: 'symboles', tags: ['info', 'remarque', 'note'] },
  { id: 'sym-question', label: 'Question', icon: 'i-lucide-circle-help', category: 'symboles', tags: ['question', 'à décider', 'doute'] },
  { id: 'sym-star', label: 'Point clé', icon: 'i-lucide-star', category: 'symboles', tags: ['important', 'clé', 'favori'] },
  { id: 'sym-flag', label: 'Jalon', icon: 'i-lucide-flag', category: 'symboles', tags: ['jalon', 'étape', 'milestone'] },
  { id: 'sym-target', label: 'Objectif', icon: 'i-lucide-target', category: 'symboles', tags: ['objectif', 'cible', 'but'] },
  { id: 'sym-idea', label: 'Idée', icon: 'i-lucide-lightbulb', category: 'symboles', tags: ['idée', 'proposition'] },
  { id: 'sym-time', label: 'Délai', icon: 'i-lucide-clock', category: 'symboles', tags: ['délai', 'durée', 'planning'] },
  { id: 'sym-cost', label: 'Coût', icon: 'i-lucide-euro', category: 'symboles', tags: ['prix', 'budget', 'coût'] },
  { id: 'sym-growth', label: 'Évolution', icon: 'i-lucide-trending-up', category: 'symboles', tags: ['croissance', 'évolution', 'scalabilité'] },
  { id: 'sym-sync', label: 'Synchronisation', icon: 'i-lucide-refresh-cw', category: 'symboles', tags: ['synchro', 'réplication', 'boucle'] },
  { id: 'sym-lock-step', label: 'Étape bloquée', icon: 'i-lucide-ban', category: 'symboles', tags: ['bloqué', 'interdit', 'stop'] },
  { id: 'sym-new', label: 'Nouveau', icon: 'i-lucide-sparkles', category: 'symboles', tags: ['nouveau', 'nouveauté', 'proposé'] },
  { id: 'sym-hourglass', label: 'En attente', icon: 'i-lucide-hourglass', category: 'symboles', tags: ['attente', 'en cours', 'patience'] }
]

export function findDrawIcon(id: string): DrawIcon | undefined {
  return DRAW_ICONS.find(item => item.id === id)
}

export function iconsOfCategory(id: DrawCategoryId): DrawIcon[] {
  return DRAW_ICONS.filter(item => item.category === id)
}

/**
 * Noms Iconify distincts de la bibliothèque.
 *
 * Le rendu du plan est du SVG pur — pour l'export comme pour l'écran — donc
 * l'application a besoin des tracés eux-mêmes, pas d'une police d'icônes.
 * Cette liste est ce que le serveur résout en une seule requête.
 */
export const DRAW_ICON_NAMES: string[] = [...new Set(DRAW_ICONS.map(item => item.icon))]
