/**
 * Catalogue matériel de TanchiTopologyBoard.
 *
 * Chaque entrée décrit ce qu'un équipement apporte au schéma : ses connecteurs,
 * les services qu'il expose par défaut et ses besoins d'alimentation. Le
 * contrôleur de cohérence (`diagnostics.ts`) s'appuie entièrement sur ces
 * métadonnées, d'où leur précision.
 */

export type NodeKind = 'device' | 'endpoint' | 'service' | 'passive' | 'external'

/** Connectique physique, base du contrôle de câblage. */
export type Connector =
  | 'rj45' | 'sfp' | 'sfp+' | 'sfp28' | 'qsfp+' | 'qsfp28' | 'qsfp-dd'
  | 'lc' | 'sc' | 'mpo' | 'coax' | 'wireless' | 'power' | 'serial'

export interface PortGroup {
  connector: Connector
  count: number
  speedGbps: number
}

export interface ServiceSpec {
  name: string
  port: number
  protocol: 'tcp' | 'udp'
}

export interface CatalogItem {
  id: string
  label: string
  category: CategoryId
  icon: string
  kind: NodeKind
  /** Connectique disponible. Un équipement sans port ne se câble pas. */
  ports: PortGroup[]
  /** Services écoutés par défaut, base du contrôle « port ouvert pour rien ». */
  services?: ServiceSpec[]
  /** Doit être relié à une source d'énergie (PDU, onduleur). */
  needsPower?: boolean
  /** Équipement de couche 2 : concerné par le contrôle de boucle. */
  switching?: boolean
  /** Alimente ses terminaux par le câble de données (PoE). */
  poe?: boolean
  hint?: string
  tags: string[]
}

export type CategoryId =
  | 'compute' | 'virtualisation' | 'switching' | 'routing' | 'security'
  | 'storage' | 'cabling' | 'optics' | 'power' | 'wireless'
  | 'services' | 'wan' | 'endpoints' | 'monitoring'

export interface Category {
  id: CategoryId
  label: string
  icon: string
  /** Ordre d'usage : du plus structurant au plus périphérique. */
  hint: string
}

export const CATEGORIES: Category[] = [
  { id: 'compute', label: 'Serveurs & calcul', icon: 'i-lucide-server', hint: 'Machines physiques et nœuds de calcul' },
  { id: 'virtualisation', label: 'Virtualisation & conteneurs', icon: 'i-lucide-container', hint: 'Hyperviseurs, VM, Docker, Kubernetes' },
  { id: 'switching', label: 'Commutation', icon: 'i-lucide-network', hint: 'Commutateurs d\'accès, distribution et cœur' },
  { id: 'routing', label: 'Routage', icon: 'i-lucide-route', hint: 'Routeurs, passerelles et interconnexions' },
  { id: 'security', label: 'Sécurité', icon: 'i-lucide-shield', hint: 'Pare-feu, IDS, VPN, accès distant' },
  { id: 'storage', label: 'Stockage', icon: 'i-lucide-database', hint: 'SAN, NAS, objet et sauvegarde' },
  { id: 'cabling', label: 'Câblage cuivre', icon: 'i-lucide-cable', hint: 'Liaisons cuivre et brassage' },
  { id: 'optics', label: 'Fibre & optique', icon: 'i-lucide-radio', hint: 'Fibres, transceivers et jarretières' },
  { id: 'power', label: 'Énergie & baie', icon: 'i-lucide-zap', hint: 'Alimentation, onduleurs, environnement' },
  { id: 'wireless', label: 'Sans-fil', icon: 'i-lucide-wifi', hint: 'Points d\'accès et contrôleurs' },
  { id: 'services', label: 'Services réseau', icon: 'i-lucide-settings-2', hint: 'DNS, DHCP, annuaire, répartition de charge' },
  { id: 'wan', label: 'WAN & opérateur', icon: 'i-lucide-globe', hint: 'Internet, MPLS, tunnels, cloud' },
  { id: 'endpoints', label: 'Postes & périphériques', icon: 'i-lucide-monitor', hint: 'Utilisateurs finaux et objets connectés' },
  { id: 'monitoring', label: 'Supervision', icon: 'i-lucide-activity', hint: 'Métrologie, journaux, sondes' }
]

const rj45 = (count: number, speedGbps = 1): PortGroup => ({ connector: 'rj45', count, speedGbps })
const sfpPlus = (count: number, speedGbps = 10): PortGroup => ({ connector: 'sfp+', count, speedGbps })
const qsfp28 = (count: number, speedGbps = 100): PortGroup => ({ connector: 'qsfp28', count, speedGbps })

export const CATALOG: CatalogItem[] = [
  /* ------------------------------------------------ Serveurs & calcul */
  { id: 'srv-1u', label: 'Serveur rack 1U', category: 'compute', icon: 'i-lucide-server', kind: 'device', ports: [rj45(2), sfpPlus(2)], needsPower: true, services: [{ name: 'SSH', port: 22, protocol: 'tcp' }], tags: ['rack', 'physique'] },
  { id: 'srv-2u', label: 'Serveur rack 2U', category: 'compute', icon: 'i-lucide-server-cog', kind: 'device', ports: [rj45(4), sfpPlus(2)], needsPower: true, services: [{ name: 'SSH', port: 22, protocol: 'tcp' }], tags: ['rack', 'physique'] },
  { id: 'srv-4u', label: 'Serveur rack 4U', category: 'compute', icon: 'i-lucide-rows-4', kind: 'device', ports: [rj45(4), sfpPlus(4)], needsPower: true, tags: ['rack'] },
  { id: 'srv-blade', label: 'Châssis lames', category: 'compute', icon: 'i-lucide-layers', kind: 'device', ports: [sfpPlus(8), qsfp28(2), rj45(1)], needsPower: true, tags: ['blade', 'densité'] },
  { id: 'srv-tower', label: 'Serveur tour', category: 'compute', icon: 'i-lucide-pc-case', kind: 'device', ports: [rj45(2)], needsPower: true, tags: ['bureau'] },
  { id: 'srv-gpu', label: 'Nœud GPU', category: 'compute', icon: 'i-lucide-cpu', kind: 'device', ports: [sfpPlus(2), qsfp28(2)], needsPower: true, tags: ['ia', 'calcul'] },
  { id: 'srv-hci', label: 'Nœud hyperconvergé', category: 'compute', icon: 'i-lucide-boxes', kind: 'device', ports: [sfpPlus(4)], needsPower: true, tags: ['hci'] },
  { id: 'srv-edge', label: 'Serveur edge', category: 'compute', icon: 'i-lucide-radio-tower', kind: 'device', ports: [rj45(2)], needsPower: true, tags: ['edge', 'distant'] },
  { id: 'srv-bastion', label: 'Bastion d\'administration', category: 'compute', icon: 'i-lucide-key-round', kind: 'device', ports: [rj45(1)], needsPower: true, services: [{ name: 'SSH', port: 22, protocol: 'tcp' }], tags: ['admin', 'jump'] },
  { id: 'srv-build', label: 'Runner CI/CD', category: 'compute', icon: 'i-lucide-hammer', kind: 'device', ports: [rj45(1)], needsPower: true, tags: ['ci'] },

  /* --------------------------------------- Virtualisation & conteneurs */
  { id: 'hv-esxi', label: 'Hyperviseur VMware ESXi', category: 'virtualisation', icon: 'i-lucide-layers-3', kind: 'device', ports: [rj45(4), sfpPlus(2)], needsPower: true, services: [{ name: 'HTTPS', port: 443, protocol: 'tcp' }], tags: ['vmware'] },
  { id: 'hv-proxmox', label: 'Hyperviseur Proxmox VE', category: 'virtualisation', icon: 'i-lucide-layers-2', kind: 'device', ports: [rj45(2), sfpPlus(2)], needsPower: true, services: [{ name: 'Web UI', port: 8006, protocol: 'tcp' }], tags: ['proxmox', 'kvm'] },
  { id: 'hv-hyperv', label: 'Hyperviseur Hyper-V', category: 'virtualisation', icon: 'i-lucide-app-window', kind: 'device', ports: [rj45(4)], needsPower: true, tags: ['microsoft'] },
  { id: 'hv-xcp', label: 'Hyperviseur XCP-ng', category: 'virtualisation', icon: 'i-lucide-square-stack', kind: 'device', ports: [rj45(2)], needsPower: true, tags: ['xen'] },
  { id: 'vm-linux', label: 'Machine virtuelle Linux', category: 'virtualisation', icon: 'i-lucide-square-terminal', kind: 'service', ports: [rj45(1)], services: [{ name: 'SSH', port: 22, protocol: 'tcp' }], tags: ['vm'] },
  { id: 'vm-windows', label: 'Machine virtuelle Windows', category: 'virtualisation', icon: 'i-lucide-app-window-mac', kind: 'service', ports: [rj45(1)], services: [{ name: 'RDP', port: 3389, protocol: 'tcp' }], tags: ['vm'] },
  { id: 'docker-host', label: 'Hôte Docker', category: 'virtualisation', icon: 'i-lucide-container', kind: 'device', ports: [rj45(2)], needsPower: true, services: [{ name: 'Docker API', port: 2375, protocol: 'tcp' }], tags: ['docker'] },
  { id: 'docker-container', label: 'Conteneur Docker', category: 'virtualisation', icon: 'i-lucide-package', kind: 'service', ports: [rj45(1)], tags: ['docker'] },
  { id: 'podman-host', label: 'Hôte Podman', category: 'virtualisation', icon: 'i-lucide-package-open', kind: 'device', ports: [rj45(2)], needsPower: true, tags: ['podman', 'rootless'] },
  { id: 'k8s-control', label: 'Nœud maître Kubernetes', category: 'virtualisation', icon: 'i-lucide-hexagon', kind: 'device', ports: [rj45(2), sfpPlus(2)], needsPower: true, services: [{ name: 'kube-apiserver', port: 6443, protocol: 'tcp' }], tags: ['k8s'] },
  { id: 'k8s-worker', label: 'Nœud worker Kubernetes', category: 'virtualisation', icon: 'i-lucide-box', kind: 'device', ports: [rj45(2), sfpPlus(2)], needsPower: true, services: [{ name: 'kubelet', port: 10250, protocol: 'tcp' }], tags: ['k8s'] },
  { id: 'k8s-ingress', label: 'Ingress controller', category: 'virtualisation', icon: 'i-lucide-door-open', kind: 'service', ports: [rj45(1)], services: [{ name: 'HTTPS', port: 443, protocol: 'tcp' }], tags: ['k8s', 'entrée'] },
  { id: 'lxc', label: 'Conteneur LXC', category: 'virtualisation', icon: 'i-lucide-package-2', kind: 'service', ports: [rj45(1)], tags: ['lxc'] },
  { id: 'registry', label: 'Registre d\'images', category: 'virtualisation', icon: 'i-lucide-archive', kind: 'service', ports: [rj45(1), sfpPlus(1)], services: [{ name: 'Registry', port: 5000, protocol: 'tcp' }], tags: ['images'] },

  /* ------------------------------------------------------ Commutation */
  { id: 'sw-access-24', label: 'Commutateur accès 24 ports', category: 'switching', icon: 'i-lucide-network', kind: 'device', ports: [rj45(24), sfpPlus(4)], needsPower: true, switching: true, tags: ['accès'] },
  { id: 'sw-access-48', label: 'Commutateur accès 48 ports', category: 'switching', icon: 'i-lucide-grid-3x3', kind: 'device', ports: [rj45(48), sfpPlus(4)], needsPower: true, switching: true, tags: ['accès'] },
  { id: 'sw-poe-24', label: 'Commutateur PoE+ 24 ports', category: 'switching', icon: 'i-lucide-plug-zap', kind: 'device', ports: [rj45(24), sfpPlus(2)], needsPower: true, switching: true, poe: true, tags: ['poe'] },
  { id: 'sw-cisco-cat', label: 'Cisco Catalyst 9300', category: 'switching', icon: 'i-lucide-square-chevron-right', kind: 'device', ports: [rj45(48), qsfp28(4)], needsPower: true, switching: true, poe: true, tags: ['cisco', 'entreprise'] },
  { id: 'sw-cisco-nexus', label: 'Cisco Nexus 9000', category: 'switching', icon: 'i-lucide-square-chevron-up', kind: 'device', ports: [sfpPlus(48), qsfp28(6), rj45(1)], needsPower: true, switching: true, tags: ['cisco', 'datacenter'] },
  { id: 'sw-juniper-ex', label: 'Juniper EX4400', category: 'switching', icon: 'i-lucide-square-chevron-down', kind: 'device', ports: [rj45(48), qsfp28(4)], needsPower: true, switching: true, tags: ['juniper'] },
  { id: 'sw-juniper-qfx', label: 'Juniper QFX5120', category: 'switching', icon: 'i-lucide-square-chevron-left', kind: 'device', ports: [sfpPlus(48), qsfp28(8), rj45(1)], needsPower: true, switching: true, tags: ['juniper', 'spine'] },
  { id: 'sw-arista', label: 'Arista 7050X', category: 'switching', icon: 'i-lucide-square-equal', kind: 'device', ports: [sfpPlus(48), qsfp28(4), rj45(1)], needsPower: true, switching: true, tags: ['arista'] },
  { id: 'sw-mikrotik', label: 'MikroTik CRS', category: 'switching', icon: 'i-lucide-square-asterisk', kind: 'device', ports: [rj45(24), sfpPlus(2)], needsPower: true, switching: true, tags: ['mikrotik'] },
  { id: 'sw-ubiquiti', label: 'UniFi Switch', category: 'switching', icon: 'i-lucide-square-dot', kind: 'device', ports: [rj45(24), sfpPlus(2)], needsPower: true, switching: true, poe: true, tags: ['ubiquiti'] },
  { id: 'sw-tor', label: 'Commutateur Top-of-Rack', category: 'switching', icon: 'i-lucide-panel-top-dashed', kind: 'device', ports: [sfpPlus(48), qsfp28(6), rj45(1)], needsPower: true, switching: true, tags: ['tor', 'datacenter'] },
  { id: 'sw-core', label: 'Commutateur cœur', category: 'switching', icon: 'i-lucide-circuit-board', kind: 'device', ports: [qsfp28(32), rj45(1)], needsPower: true, switching: true, tags: ['cœur'] },
  { id: 'sw-industrial', label: 'Commutateur industriel DIN', category: 'switching', icon: 'i-lucide-factory', kind: 'device', ports: [rj45(8)], needsPower: true, switching: true, tags: ['industriel'] },
  { id: 'sw-stack', label: 'Pile de commutateurs', category: 'switching', icon: 'i-lucide-align-justify', kind: 'device', ports: [rj45(96), qsfp28(8)], needsPower: true, switching: true, tags: ['stack'] },

  /* ---------------------------------------------------------- Routage */
  { id: 'rt-edge', label: 'Routeur de périphérie', category: 'routing', icon: 'i-lucide-route', kind: 'device', ports: [rj45(4), sfpPlus(2)], needsPower: true, tags: ['edge'] },
  { id: 'rt-cisco-isr', label: 'Cisco ISR 4000', category: 'routing', icon: 'i-lucide-signpost', kind: 'device', ports: [rj45(4), sfpPlus(2)], needsPower: true, tags: ['cisco'] },
  { id: 'rt-cisco-asr', label: 'Cisco ASR 1000', category: 'routing', icon: 'i-lucide-signpost-big', kind: 'device', ports: [sfpPlus(8)], needsPower: true, tags: ['cisco', 'opérateur'] },
  { id: 'rt-juniper-mx', label: 'Juniper MX204', category: 'routing', icon: 'i-lucide-milestone', kind: 'device', ports: [sfpPlus(8), qsfp28(4)], needsPower: true, tags: ['juniper', 'opérateur'] },
  { id: 'rt-mikrotik', label: 'MikroTik CCR', category: 'routing', icon: 'i-lucide-waypoints', kind: 'device', ports: [rj45(8), sfpPlus(2)], needsPower: true, tags: ['mikrotik'] },
  { id: 'rt-vyos', label: 'Routeur VyOS', category: 'routing', icon: 'i-lucide-code', kind: 'device', ports: [rj45(4)], needsPower: true, tags: ['logiciel'] },
  { id: 'rt-bgp', label: 'Routeur BGP', category: 'routing', icon: 'i-lucide-git-branch', kind: 'device', ports: [sfpPlus(4)], needsPower: true, services: [{ name: 'BGP', port: 179, protocol: 'tcp' }], tags: ['bgp', 'peering'] },
  { id: 'rt-l3-switch', label: 'Commutateur niveau 3', category: 'routing', icon: 'i-lucide-git-fork', kind: 'device', ports: [rj45(24), sfpPlus(4)], needsPower: true, switching: true, tags: ['l3'] },
  { id: 'rt-gateway', label: 'Passerelle par défaut', category: 'routing', icon: 'i-lucide-door-closed', kind: 'device', ports: [rj45(2)], needsPower: true, tags: ['passerelle'] },

  /* --------------------------------------------------------- Sécurité */
  { id: 'fw-generic', label: 'Pare-feu', category: 'security', icon: 'i-lucide-shield', kind: 'device', ports: [rj45(6), sfpPlus(2)], needsPower: true, tags: ['pare-feu'] },
  { id: 'fw-cisco-asa', label: 'Cisco ASA / FTD', category: 'security', icon: 'i-lucide-shield-check', kind: 'device', ports: [rj45(8), sfpPlus(2)], needsPower: true, tags: ['cisco'] },
  { id: 'fw-juniper-srx', label: 'Juniper SRX', category: 'security', icon: 'i-lucide-shield-half', kind: 'device', ports: [rj45(8), sfpPlus(4)], needsPower: true, tags: ['juniper'] },
  { id: 'fw-palo', label: 'Palo Alto PA-Series', category: 'security', icon: 'i-lucide-shield-alert', kind: 'device', ports: [rj45(8), sfpPlus(4)], needsPower: true, tags: ['palo alto'] },
  { id: 'fw-fortigate', label: 'FortiGate', category: 'security', icon: 'i-lucide-shield-ban', kind: 'device', ports: [rj45(10), sfpPlus(2)], needsPower: true, tags: ['fortinet'] },
  { id: 'fw-pfsense', label: 'pfSense / OPNsense', category: 'security', icon: 'i-lucide-brick-wall', kind: 'device', ports: [rj45(4)], needsPower: true, tags: ['open source'] },
  { id: 'sec-ids', label: 'Sonde IDS/IPS', category: 'security', icon: 'i-lucide-scan-eye', kind: 'device', ports: [rj45(2), sfpPlus(2)], needsPower: true, tags: ['détection'] },
  { id: 'sec-waf', label: 'Pare-feu applicatif (WAF)', category: 'security', icon: 'i-lucide-globe-lock', kind: 'service', ports: [rj45(2)], services: [{ name: 'HTTPS', port: 443, protocol: 'tcp' }], tags: ['web'] },
  { id: 'sec-vpn', label: 'Concentrateur VPN', category: 'security', icon: 'i-lucide-lock', kind: 'device', ports: [rj45(2)], needsPower: true, services: [{ name: 'IPsec', port: 500, protocol: 'udp' }], tags: ['vpn'] },
  { id: 'sec-wireguard', label: 'Passerelle WireGuard', category: 'security', icon: 'i-lucide-lock-keyhole', kind: 'service', ports: [rj45(1), { connector: 'wireless', count: 1, speedGbps: 2 }], services: [{ name: 'WireGuard', port: 51820, protocol: 'udp' }], tags: ['vpn'] },
  { id: 'sec-radius', label: 'Serveur RADIUS', category: 'security', icon: 'i-lucide-badge-check', kind: 'service', ports: [rj45(1)], services: [{ name: 'RADIUS', port: 1812, protocol: 'udp' }], tags: ['802.1x'] },
  { id: 'sec-pki', label: 'Autorité de certification', category: 'security', icon: 'i-lucide-file-badge', kind: 'service', ports: [rj45(1)], tags: ['pki'] },
  { id: 'sec-siem', label: 'SIEM', category: 'security', icon: 'i-lucide-search-check', kind: 'service', ports: [rj45(1)], services: [{ name: 'Syslog', port: 514, protocol: 'udp' }], tags: ['journaux'] },
  { id: 'sec-honeypot', label: 'Pot de miel', category: 'security', icon: 'i-lucide-bug', kind: 'service', ports: [rj45(1)], tags: ['leurre'] },

  /* --------------------------------------------------------- Stockage */
  { id: 'st-nas', label: 'NAS', category: 'storage', icon: 'i-lucide-hard-drive', kind: 'device', ports: [rj45(2), sfpPlus(2)], needsPower: true, services: [{ name: 'SMB', port: 445, protocol: 'tcp' }, { name: 'NFS', port: 2049, protocol: 'tcp' }], tags: ['fichiers'] },
  { id: 'st-san', label: 'Baie SAN', category: 'storage', icon: 'i-lucide-database', kind: 'device', ports: [sfpPlus(8)], needsPower: true, services: [{ name: 'iSCSI', port: 3260, protocol: 'tcp' }], tags: ['bloc'] },
  { id: 'st-jbod', label: 'Tiroir JBOD', category: 'storage', icon: 'i-lucide-rows-3', kind: 'passive', ports: [], needsPower: true, tags: ['extension'] },
  { id: 'st-ceph', label: 'Nœud Ceph', category: 'storage', icon: 'i-lucide-database-zap', kind: 'device', ports: [sfpPlus(2)], needsPower: true, tags: ['distribué'] },
  { id: 'st-minio', label: 'Stockage objet S3', category: 'storage', icon: 'i-lucide-cloud', kind: 'service', ports: [rj45(1)], services: [{ name: 'S3', port: 9000, protocol: 'tcp' }], tags: ['objet'] },
  { id: 'st-backup', label: 'Serveur de sauvegarde', category: 'storage', icon: 'i-lucide-save', kind: 'device', ports: [rj45(2)], needsPower: true, tags: ['sauvegarde'] },
  { id: 'st-tape', label: 'Librairie de bandes', category: 'storage', icon: 'i-lucide-disc', kind: 'device', ports: [sfpPlus(2)], needsPower: true, tags: ['archivage'] },
  { id: 'st-nvmeof', label: 'Cible NVMe-oF', category: 'storage', icon: 'i-lucide-memory-stick', kind: 'device', ports: [qsfp28(2)], needsPower: true, tags: ['nvme', 'latence'] },

  /* ---------------------------------------------------- Câblage cuivre */
  { id: 'cbl-cat5e', label: 'Cordon Cat 5e', category: 'cabling', icon: 'i-lucide-cable', kind: 'passive', ports: [], hint: '1 Gb/s · 100 m maximum', tags: ['cuivre'] },
  { id: 'cbl-cat6', label: 'Cordon Cat 6', category: 'cabling', icon: 'i-lucide-unplug', kind: 'passive', ports: [], hint: '10 Gb/s jusqu\'à 55 m', tags: ['cuivre'] },
  { id: 'cbl-cat6a', label: 'Cordon Cat 6a', category: 'cabling', icon: 'i-lucide-plug', kind: 'passive', ports: [], hint: '10 Gb/s · 100 m', tags: ['cuivre'] },
  { id: 'cbl-cat7', label: 'Cordon Cat 7', category: 'cabling', icon: 'i-lucide-plug-2', kind: 'passive', ports: [], hint: '10 Gb/s blindé', tags: ['cuivre', 'blindé'] },
  { id: 'cbl-cat8', label: 'Cordon Cat 8', category: 'cabling', icon: 'i-lucide-spline', kind: 'passive', ports: [], hint: '25/40 Gb/s · 30 m', tags: ['cuivre', 'datacenter'] },
  { id: 'cbl-dac', label: 'Câble DAC', category: 'cabling', icon: 'i-lucide-minus', kind: 'passive', ports: [], hint: 'Cuivre direct · 7 m', tags: ['dac', 'rack'] },
  { id: 'patch-panel', label: 'Panneau de brassage', category: 'cabling', icon: 'i-lucide-grid-2x2', kind: 'passive', ports: [rj45(24)], tags: ['brassage'] },
  { id: 'keystone', label: 'Prise murale RJ45', category: 'cabling', icon: 'i-lucide-square', kind: 'passive', ports: [rj45(1)], tags: ['prise'] },
  { id: 'cable-tray', label: 'Chemin de câbles', category: 'cabling', icon: 'i-lucide-equal', kind: 'passive', ports: [], tags: ['infrastructure'] },
  { id: 'media-converter', label: 'Convertisseur cuivre/fibre', category: 'cabling', icon: 'i-lucide-repeat', kind: 'device', ports: [rj45(1), sfpPlus(1)], needsPower: true, tags: ['conversion'] },

  /* ------------------------------------------------------ Fibre & optique */
  { id: 'fib-om3', label: 'Fibre multimode OM3', category: 'optics', icon: 'i-lucide-radio', kind: 'passive', ports: [], hint: '10 Gb/s · 300 m', tags: ['multimode'] },
  { id: 'fib-om4', label: 'Fibre multimode OM4', category: 'optics', icon: 'i-lucide-radio-receiver', kind: 'passive', ports: [], hint: '10 Gb/s · 400 m', tags: ['multimode'] },
  { id: 'fib-om5', label: 'Fibre multimode OM5', category: 'optics', icon: 'i-lucide-audio-waveform', kind: 'passive', ports: [], hint: '40/100 Gb/s courte distance', tags: ['multimode'] },
  { id: 'fib-os2', label: 'Fibre monomode OS2', category: 'optics', icon: 'i-lucide-waves', kind: 'passive', ports: [], hint: 'Jusqu\'à 10 km et au-delà', tags: ['monomode', 'longue distance'] },
  { id: 'fib-aoc', label: 'Câble optique actif (AOC)', category: 'optics', icon: 'i-lucide-flashlight', kind: 'passive', ports: [], hint: 'Optique préconnectorisé · 30 m', tags: ['aoc'] },
  { id: 'opt-sfp', label: 'Transceiver SFP 1G', category: 'optics', icon: 'i-lucide-square-power', kind: 'passive', ports: [{ connector: 'sfp', count: 1, speedGbps: 1 }], tags: ['transceiver'] },
  { id: 'opt-sfpp', label: 'Transceiver SFP+ 10G', category: 'optics', icon: 'i-lucide-squares-unite', kind: 'passive', ports: [sfpPlus(1)], tags: ['transceiver'] },
  { id: 'opt-sfp28', label: 'Transceiver SFP28 25G', category: 'optics', icon: 'i-lucide-square-plus', kind: 'passive', ports: [{ connector: 'sfp28', count: 1, speedGbps: 25 }], tags: ['transceiver'] },
  { id: 'opt-qsfp28', label: 'Transceiver QSFP28 100G', category: 'optics', icon: 'i-lucide-square-code', kind: 'passive', ports: [qsfp28(1)], tags: ['transceiver'] },
  { id: 'opt-qsfpdd', label: 'Transceiver QSFP-DD 400G', category: 'optics', icon: 'i-lucide-square-m', kind: 'passive', ports: [{ connector: 'qsfp-dd', count: 1, speedGbps: 400 }], tags: ['transceiver'] },
  { id: 'opt-odf', label: 'Tiroir optique (ODF)', category: 'optics', icon: 'i-lucide-inbox', kind: 'passive', ports: [{ connector: 'lc', count: 24, speedGbps: 100 }], tags: ['brassage'] },
  { id: 'opt-splitter', label: 'Coupleur optique', category: 'optics', icon: 'i-lucide-split', kind: 'passive', ports: [], tags: ['pon'] },
  { id: 'opt-mpo', label: 'Cassette MPO/MTP', category: 'optics', icon: 'i-lucide-grid-2x2-plus', kind: 'passive', ports: [{ connector: 'mpo', count: 12, speedGbps: 100 }], tags: ['haute densité'] },

  /* ---------------------------------------------------- Énergie & baie */
  { id: 'pwr-pdu', label: 'PDU rack', category: 'power', icon: 'i-lucide-zap', kind: 'device', ports: [{ connector: 'power', count: 24, speedGbps: 0 }], tags: ['alimentation'] },
  { id: 'pwr-ups', label: 'Onduleur (UPS)', category: 'power', icon: 'i-lucide-battery-charging', kind: 'device', ports: [{ connector: 'power', count: 8, speedGbps: 0 }], tags: ['secours'] },
  { id: 'pwr-genset', label: 'Groupe électrogène', category: 'power', icon: 'i-lucide-fuel', kind: 'device', ports: [{ connector: 'power', count: 4, speedGbps: 0 }], tags: ['secours'] },
  { id: 'pwr-ats', label: 'Inverseur de source (ATS)', category: 'power', icon: 'i-lucide-toggle-right', kind: 'device', ports: [{ connector: 'power', count: 2, speedGbps: 0 }], tags: ['redondance'] },
  { id: 'rack-42u', label: 'Baie 42U', category: 'power', icon: 'i-lucide-columns-3', kind: 'passive', ports: [], tags: ['baie'] },
  { id: 'rack-wall', label: 'Coffret mural', category: 'power', icon: 'i-lucide-package-search', kind: 'passive', ports: [], tags: ['baie'] },
  { id: 'env-crac', label: 'Climatisation de salle', category: 'power', icon: 'i-lucide-snowflake', kind: 'device', ports: [rj45(1)], tags: ['refroidissement'] },
  { id: 'env-sensor', label: 'Sonde température/humidité', category: 'power', icon: 'i-lucide-thermometer', kind: 'device', ports: [rj45(1)], tags: ['environnement'] },

  /* --------------------------------------------------------- Sans-fil */
  { id: 'wifi-ap', label: 'Point d\'accès Wi-Fi', category: 'wireless', icon: 'i-lucide-wifi', kind: 'device', ports: [rj45(1, 2.5)], needsPower: true, tags: ['wifi'] },
  { id: 'wifi-ap6', label: 'Point d\'accès Wi-Fi 6E', category: 'wireless', icon: 'i-lucide-wifi-high', kind: 'device', ports: [rj45(1, 2.5)], needsPower: true, tags: ['wifi 6e'] },
  { id: 'wifi-wlc', label: 'Contrôleur WLAN', category: 'wireless', icon: 'i-lucide-tower-control', kind: 'device', ports: [rj45(4)], needsPower: true, tags: ['contrôleur'] },
  { id: 'wifi-mesh', label: 'Nœud maillé', category: 'wireless', icon: 'i-lucide-orbit', kind: 'device', ports: [rj45(1)], needsPower: true, tags: ['mesh'] },
  { id: 'wifi-bridge', label: 'Pont radio point à point', category: 'wireless', icon: 'i-lucide-antenna', kind: 'device', ports: [rj45(1)], needsPower: true, tags: ['faisceau'] },

  /* -------------------------------------------------- Services réseau */
  { id: 'svc-dns', label: 'Serveur DNS', category: 'services', icon: 'i-lucide-globe', kind: 'service', ports: [rj45(1)], services: [{ name: 'DNS', port: 53, protocol: 'udp' }], tags: ['résolution'] },
  { id: 'svc-dhcp', label: 'Serveur DHCP', category: 'services', icon: 'i-lucide-list-ordered', kind: 'service', ports: [rj45(1)], services: [{ name: 'DHCP', port: 67, protocol: 'udp' }], tags: ['adressage'] },
  { id: 'svc-ad', label: 'Active Directory', category: 'services', icon: 'i-lucide-users', kind: 'service', ports: [rj45(1)], services: [{ name: 'LDAP', port: 389, protocol: 'tcp' }, { name: 'Kerberos', port: 88, protocol: 'tcp' }], tags: ['annuaire'] },
  { id: 'svc-ldap', label: 'Annuaire LDAP', category: 'services', icon: 'i-lucide-book-user', kind: 'service', ports: [rj45(1)], services: [{ name: 'LDAPS', port: 636, protocol: 'tcp' }], tags: ['annuaire'] },
  { id: 'svc-ntp', label: 'Serveur NTP', category: 'services', icon: 'i-lucide-clock', kind: 'service', ports: [rj45(1)], services: [{ name: 'NTP', port: 123, protocol: 'udp' }], tags: ['temps'] },
  { id: 'svc-lb', label: 'Répartiteur de charge', category: 'services', icon: 'i-lucide-scale', kind: 'device', ports: [rj45(2), sfpPlus(2)], needsPower: true, services: [{ name: 'HTTPS', port: 443, protocol: 'tcp' }], tags: ['load balancer'] },
  { id: 'svc-proxy', label: 'Proxy inverse', category: 'services', icon: 'i-lucide-arrow-left-right', kind: 'service', ports: [rj45(1)], services: [{ name: 'HTTPS', port: 443, protocol: 'tcp' }], tags: ['reverse proxy'] },
  { id: 'svc-mail', label: 'Serveur de messagerie', category: 'services', icon: 'i-lucide-mail', kind: 'service', ports: [rj45(1)], services: [{ name: 'SMTP', port: 25, protocol: 'tcp' }, { name: 'IMAPS', port: 993, protocol: 'tcp' }], tags: ['mail'] },
  { id: 'svc-web', label: 'Serveur web', category: 'services', icon: 'i-lucide-panel-top', kind: 'service', ports: [rj45(1)], services: [{ name: 'HTTPS', port: 443, protocol: 'tcp' }], tags: ['web'] },
  { id: 'svc-db', label: 'Base de données', category: 'services', icon: 'i-lucide-table', kind: 'service', ports: [rj45(1)], services: [{ name: 'PostgreSQL', port: 5432, protocol: 'tcp' }], tags: ['données'] },
  { id: 'svc-cache', label: 'Cache Redis', category: 'services', icon: 'i-lucide-rabbit', kind: 'service', ports: [rj45(1)], services: [{ name: 'Redis', port: 6379, protocol: 'tcp' }], tags: ['cache'] },
  { id: 'svc-mq', label: 'Bus de messages', category: 'services', icon: 'i-lucide-send', kind: 'service', ports: [rj45(1)], services: [{ name: 'AMQP', port: 5672, protocol: 'tcp' }], tags: ['file'] },
  { id: 'svc-tftp', label: 'Serveur TFTP / PXE', category: 'services', icon: 'i-lucide-download', kind: 'service', ports: [rj45(1)], services: [{ name: 'TFTP', port: 69, protocol: 'udp' }], tags: ['déploiement'] },
  { id: 'svc-ipam', label: 'IPAM', category: 'services', icon: 'i-lucide-list-tree', kind: 'service', ports: [rj45(1)], tags: ['adressage'] },

  /* --------------------------------------------------- WAN & opérateur */
  { id: 'wan-internet', label: 'Internet', category: 'wan', icon: 'i-lucide-earth', kind: 'external', ports: [{ connector: 'lc', count: 4, speedGbps: 10 }, rj45(4, 10)], tags: ['wan'] },
  { id: 'wan-fai', label: 'Lien opérateur (FAI)', category: 'wan', icon: 'i-lucide-cloud-download', kind: 'external', ports: [{ connector: 'lc', count: 2, speedGbps: 10 }, rj45(2, 10)], tags: ['fai'] },
  { id: 'wan-mpls', label: 'Lien MPLS', category: 'wan', icon: 'i-lucide-spline-pointer', kind: 'external', ports: [sfpPlus(2)], tags: ['mpls'] },
  { id: 'wan-sdwan', label: 'Boîtier SD-WAN', category: 'wan', icon: 'i-lucide-shuffle', kind: 'device', ports: [rj45(4)], needsPower: true, tags: ['sd-wan'] },
  { id: 'wan-4g', label: 'Secours 4G/5G', category: 'wan', icon: 'i-lucide-signal', kind: 'device', ports: [rj45(1)], needsPower: true, tags: ['secours'] },
  { id: 'wan-ipsec', label: 'Tunnel IPsec', category: 'wan', icon: 'i-lucide-shield-user', kind: 'external', ports: [], tags: ['tunnel'] },
  { id: 'wan-cloud', label: 'Région cloud', category: 'wan', icon: 'i-lucide-cloud-cog', kind: 'external', ports: [qsfp28(2)], tags: ['cloud'] },
  { id: 'wan-cdn', label: 'CDN', category: 'wan', icon: 'i-lucide-globe-check', kind: 'external', ports: [], tags: ['diffusion'] },
  { id: 'wan-dmz', label: 'Zone DMZ', category: 'wan', icon: 'i-lucide-square-dashed', kind: 'external', ports: [rj45(4)], tags: ['zone'] },

  /* ------------------------------------------ Postes & périphériques */
  { id: 'ep-workstation', label: 'Poste de travail', category: 'endpoints', icon: 'i-lucide-monitor', kind: 'endpoint', ports: [rj45(1)], needsPower: true, tags: ['utilisateur'] },
  { id: 'ep-laptop', label: 'Ordinateur portable', category: 'endpoints', icon: 'i-lucide-laptop', kind: 'endpoint', ports: [rj45(1), { connector: 'wireless', count: 1, speedGbps: 2 }], tags: ['utilisateur'] },
  { id: 'ep-thin', label: 'Client léger', category: 'endpoints', icon: 'i-lucide-tv-minimal', kind: 'endpoint', ports: [rj45(1)], needsPower: true, tags: ['vdi'] },
  { id: 'ep-printer', label: 'Imprimante réseau', category: 'endpoints', icon: 'i-lucide-printer', kind: 'endpoint', ports: [rj45(1)], needsPower: true, services: [{ name: 'IPP', port: 631, protocol: 'tcp' }], tags: ['impression'] },
  { id: 'ep-phone', label: 'Téléphone IP', category: 'endpoints', icon: 'i-lucide-phone', kind: 'endpoint', ports: [rj45(2)], tags: ['voip'] },
  { id: 'ep-camera', label: 'Caméra IP', category: 'endpoints', icon: 'i-lucide-cctv', kind: 'endpoint', ports: [rj45(1)], services: [{ name: 'RTSP', port: 554, protocol: 'tcp' }], tags: ['vidéo', 'poe'] },
  { id: 'ep-badge', label: 'Lecteur de badge', category: 'endpoints', icon: 'i-lucide-scan-line', kind: 'endpoint', ports: [rj45(1)], tags: ['contrôle d\'accès'] },
  { id: 'ep-iot', label: 'Capteur IoT', category: 'endpoints', icon: 'i-lucide-toy-brick', kind: 'endpoint', ports: [{ connector: 'wireless', count: 1, speedGbps: 0.1 }], tags: ['iot'] },
  { id: 'ep-display', label: 'Affichage dynamique', category: 'endpoints', icon: 'i-lucide-tv', kind: 'endpoint', ports: [rj45(1)], needsPower: true, tags: ['affichage'] },

  /* ------------------------------------------------------ Supervision */
  { id: 'mon-prometheus', label: 'Collecteur de métriques', category: 'monitoring', icon: 'i-lucide-activity', kind: 'service', ports: [rj45(1), sfpPlus(1)], services: [{ name: 'Prometheus', port: 9090, protocol: 'tcp' }], tags: ['métriques'] },
  { id: 'mon-grafana', label: 'Tableaux de bord', category: 'monitoring', icon: 'i-lucide-chart-line', kind: 'service', ports: [rj45(1)], services: [{ name: 'Grafana', port: 3000, protocol: 'tcp' }], tags: ['visualisation'] },
  { id: 'mon-syslog', label: 'Collecteur syslog', category: 'monitoring', icon: 'i-lucide-scroll-text', kind: 'service', ports: [rj45(1)], services: [{ name: 'Syslog', port: 514, protocol: 'udp' }], tags: ['journaux'] },
  { id: 'mon-snmp', label: 'Sonde SNMP', category: 'monitoring', icon: 'i-lucide-gauge', kind: 'service', ports: [rj45(1)], services: [{ name: 'SNMP', port: 161, protocol: 'udp' }], tags: ['snmp'] },
  { id: 'mon-netflow', label: 'Collecteur NetFlow', category: 'monitoring', icon: 'i-lucide-chart-no-axes-combined', kind: 'service', ports: [rj45(1)], services: [{ name: 'NetFlow', port: 2055, protocol: 'udp' }], tags: ['flux'] },
  { id: 'mon-tap', label: 'TAP réseau', category: 'monitoring', icon: 'i-lucide-git-compare', kind: 'passive', ports: [rj45(4)], tags: ['capture'] },
  { id: 'mon-console', label: 'Serveur de console série', category: 'monitoring', icon: 'i-lucide-terminal', kind: 'device', ports: [{ connector: 'serial', count: 16, speedGbps: 0 }, rj45(1)], needsPower: true, tags: ['oob'] }
]

export function findCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find(item => item.id === id)
}

export function itemsOfCategory(category: CategoryId): CatalogItem[] {
  return CATALOG.filter(item => item.category === category)
}

/* ------------------------------------------------ Configurations CPU */

export interface CpuPreset {
  id: string
  label: string
  vendor: 'Intel' | 'AMD' | 'ARM'
  cores: number
  threads: number
  tdp: number
  segment: 'serveur' | 'station' | 'edge'
}

export const CPU_PRESETS: CpuPreset[] = [
  { id: 'xeon-bronze-3408u', label: 'Xeon Bronze 3408U', vendor: 'Intel', cores: 8, threads: 8, tdp: 125, segment: 'serveur' },
  { id: 'xeon-silver-4410y', label: 'Xeon Silver 4410Y', vendor: 'Intel', cores: 12, threads: 24, tdp: 150, segment: 'serveur' },
  { id: 'xeon-gold-6430', label: 'Xeon Gold 6430', vendor: 'Intel', cores: 32, threads: 64, tdp: 270, segment: 'serveur' },
  { id: 'xeon-gold-6548y', label: 'Xeon Gold 6548Y+', vendor: 'Intel', cores: 32, threads: 64, tdp: 250, segment: 'serveur' },
  { id: 'xeon-platinum-8480', label: 'Xeon Platinum 8480+', vendor: 'Intel', cores: 56, threads: 112, tdp: 350, segment: 'serveur' },
  { id: 'xeon-w-3475x', label: 'Xeon w7-3475X', vendor: 'Intel', cores: 36, threads: 72, tdp: 300, segment: 'station' },
  { id: 'epyc-9124', label: 'EPYC 9124', vendor: 'AMD', cores: 16, threads: 32, tdp: 200, segment: 'serveur' },
  { id: 'epyc-9354', label: 'EPYC 9354', vendor: 'AMD', cores: 32, threads: 64, tdp: 280, segment: 'serveur' },
  { id: 'epyc-9654', label: 'EPYC 9654', vendor: 'AMD', cores: 96, threads: 192, tdp: 360, segment: 'serveur' },
  { id: 'tr-7960x', label: 'Threadripper 7960X', vendor: 'AMD', cores: 24, threads: 48, tdp: 350, segment: 'station' },
  { id: 'tr-7980x', label: 'Threadripper 7980X', vendor: 'AMD', cores: 64, threads: 128, tdp: 350, segment: 'station' },
  { id: 'tr-pro-7995wx', label: 'Threadripper PRO 7995WX', vendor: 'AMD', cores: 96, threads: 192, tdp: 350, segment: 'station' },
  { id: 'ampere-altra', label: 'Ampere Altra Q80-30', vendor: 'ARM', cores: 80, threads: 80, tdp: 210, segment: 'serveur' },
  { id: 'graviton', label: 'ARM Neoverse N2', vendor: 'ARM', cores: 64, threads: 64, tdp: 180, segment: 'edge' }
]

export function findCpu(id: string): CpuPreset | undefined {
  return CPU_PRESETS.find(cpu => cpu.id === id)
}

/* ---------------------------------------------------- Supports de lien */

export type MediumId =
  | 'cat5e' | 'cat6' | 'cat6a' | 'cat7' | 'cat8' | 'dac'
  | 'om3' | 'om4' | 'om5' | 'os2' | 'aoc' | 'wireless' | 'power' | 'serial'

export interface MediumSpec {
  id: MediumId
  label: string
  /** Débit maximal réellement supporté. */
  maxSpeedGbps: number
  /** Longueur maximale normalisée, en mètres. */
  maxLengthM: number
  connectors: Connector[]
  family: 'cuivre' | 'fibre' | 'radio' | 'énergie' | 'console'
}

export const MEDIA: MediumSpec[] = [
  { id: 'cat5e', label: 'Cat 5e', maxSpeedGbps: 1, maxLengthM: 100, connectors: ['rj45'], family: 'cuivre' },
  { id: 'cat6', label: 'Cat 6', maxSpeedGbps: 10, maxLengthM: 55, connectors: ['rj45'], family: 'cuivre' },
  { id: 'cat6a', label: 'Cat 6a', maxSpeedGbps: 10, maxLengthM: 100, connectors: ['rj45'], family: 'cuivre' },
  { id: 'cat7', label: 'Cat 7', maxSpeedGbps: 10, maxLengthM: 100, connectors: ['rj45'], family: 'cuivre' },
  { id: 'cat8', label: 'Cat 8', maxSpeedGbps: 40, maxLengthM: 30, connectors: ['rj45'], family: 'cuivre' },
  { id: 'dac', label: 'DAC', maxSpeedGbps: 100, maxLengthM: 7, connectors: ['sfp+', 'sfp28', 'qsfp+', 'qsfp28'], family: 'cuivre' },
  { id: 'om3', label: 'Fibre OM3', maxSpeedGbps: 40, maxLengthM: 300, connectors: ['lc', 'sc', 'mpo', 'sfp+', 'sfp28', 'qsfp28'], family: 'fibre' },
  { id: 'om4', label: 'Fibre OM4', maxSpeedGbps: 100, maxLengthM: 400, connectors: ['lc', 'sc', 'mpo', 'sfp+', 'sfp28', 'qsfp28'], family: 'fibre' },
  { id: 'om5', label: 'Fibre OM5', maxSpeedGbps: 100, maxLengthM: 300, connectors: ['lc', 'mpo', 'qsfp28', 'qsfp-dd'], family: 'fibre' },
  { id: 'os2', label: 'Fibre OS2', maxSpeedGbps: 400, maxLengthM: 10000, connectors: ['lc', 'sc', 'mpo', 'sfp+', 'sfp28', 'qsfp28', 'qsfp-dd'], family: 'fibre' },
  { id: 'aoc', label: 'AOC', maxSpeedGbps: 100, maxLengthM: 30, connectors: ['sfp+', 'sfp28', 'qsfp+', 'qsfp28'], family: 'fibre' },
  { id: 'wireless', label: 'Sans-fil', maxSpeedGbps: 2, maxLengthM: 100, connectors: ['wireless'], family: 'radio' },
  { id: 'power', label: 'Alimentation', maxSpeedGbps: 0, maxLengthM: 20, connectors: ['power'], family: 'énergie' },
  { id: 'serial', label: 'Console série', maxSpeedGbps: 0, maxLengthM: 15, connectors: ['serial'], family: 'console' }
]

/** Famille d'un connecteur : décide de sa place et de sa couleur sur le nœud. */
export type ConnectorFamily = 'data' | 'power' | 'console'

export function connectorFamily(connector: Connector): ConnectorFamily {
  if (connector === 'power') return 'power'
  if (connector === 'serial') return 'console'
  return 'data'
}

/** Vrai pour la connectique optique, qui impose de la fibre. */
export function isOptical(connector: Connector): boolean {
  return connector === 'lc' || connector === 'sc' || connector === 'mpo'
}

export function findMedium(id: string): MediumSpec | undefined {
  return MEDIA.find(medium => medium.id === id)
}
