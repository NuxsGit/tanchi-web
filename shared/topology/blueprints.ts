import type { MediumId } from './catalog'
import {
  createNode,
  genId,
  inferCable,
  portSlots,
  type BoardLink,
  type BoardNode,
  type NodeConfig,
  type PortSlot
} from './model'

/**
 * Modèles d'infrastructure prêts à poser.
 *
 * Un modèle décrit l'intention — « relier le serveur au commutateur en
 * données », « alimenter la baie » — et laisse le moteur de câblage choisir les
 * prises et le câble. Les plans générés passent ainsi par exactement le même
 * chemin qu'un câblage fait à la main, et respectent les mêmes contrôles.
 */

interface Spot {
  /** Référence locale au modèle, résolue en identifiant réel à la génération. */
  ref: string
  type: string
  label?: string
  col: number
  row: number
  config?: NodeConfig
}

interface Wire {
  from: string
  to: string
  /** Nature du lien ; la connectique en découle. */
  kind?: 'data' | 'power'
  lengthM: number
  /** Plafond de débit, quand le modèle vise moins que la capacité des ports. */
  speedGbps?: number
  label?: string
}

export interface Blueprint {
  id: string
  label: string
  description: string
  icon: string
  /** Étiquette de contexte : à qui ce modèle s'adresse. */
  audience: string
  spots: Spot[]
  wires: Wire[]
}

const COL = 220
const ROW = 130

export const BLUEPRINTS: Blueprint[] = [
  {
    id: 'pme',
    label: 'PME — socle complet',
    description: 'Accès opérateur, pare-feu, commutateur PoE, serveur de fichiers, postes et Wi-Fi, le tout sur onduleur.',
    icon: 'i-lucide-building',
    audience: '10 à 50 postes',
    spots: [
      { ref: 'wan', type: 'wan-fai', label: 'Lien FAI', col: 0, row: 1 },
      { ref: 'fw', type: 'fw-pfsense', label: 'Pare-feu', col: 1, row: 1, config: { ip: '192.168.1.1', vlan: 1 } },
      { ref: 'sw', type: 'sw-poe-24', label: 'Commutateur PoE', col: 2, row: 1, config: { ip: '192.168.1.2', vlan: 1 } },
      { ref: 'nas', type: 'st-nas', label: 'NAS fichiers', col: 3, row: 0, config: { ip: '192.168.1.10', vlan: 1 } },
      { ref: 'srv', type: 'srv-tower', label: 'Serveur métier', col: 3, row: 1, config: { ip: '192.168.1.11', vlan: 1, ramGb: 64 } },
      { ref: 'dns', type: 'svc-dns', label: 'DNS interne', col: 4, row: 0, config: { ip: '192.168.1.12', vlan: 1 } },
      { ref: 'dhcp', type: 'svc-dhcp', label: 'DHCP', col: 4, row: 1, config: { ip: '192.168.1.13', vlan: 1 } },
      { ref: 'ap', type: 'wifi-ap6', label: 'Point d\'accès', col: 3, row: 2, config: { ip: '192.168.1.20', vlan: 1 } },
      { ref: 'pc', type: 'ep-workstation', label: 'Postes bureau', col: 4, row: 2, config: { vlan: 1 } },
      { ref: 'ups', type: 'pwr-ups', label: 'Onduleur', col: 1, row: 3 },
      { ref: 'pdu', type: 'pwr-pdu', label: 'PDU', col: 2, row: 3 }
    ],
    wires: [
      { from: 'wan', to: 'fw', lengthM: 20, speedGbps: 1 },
      { from: 'fw', to: 'sw', lengthM: 3, speedGbps: 1 },
      { from: 'sw', to: 'nas', lengthM: 5, speedGbps: 1 },
      { from: 'sw', to: 'srv', lengthM: 5, speedGbps: 1 },
      { from: 'sw', to: 'dns', lengthM: 5, speedGbps: 1 },
      { from: 'sw', to: 'dhcp', lengthM: 5, speedGbps: 1 },
      { from: 'sw', to: 'ap', lengthM: 25, speedGbps: 1 },
      { from: 'sw', to: 'pc', lengthM: 30, speedGbps: 1 },
      { from: 'ups', to: 'pdu', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'fw', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'sw', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'srv', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'nas', kind: 'power', lengthM: 2 }
    ]
  },
  {
    id: 'proxmox-ha',
    label: 'Cluster Proxmox haute dispo',
    description: 'Trois hyperviseurs sur double commutateur, stockage Ceph, et alimentation répartie sur deux voies.',
    icon: 'i-lucide-layers-2',
    audience: 'Virtualisation redondée',
    spots: [
      { ref: 'sw1', type: 'sw-tor', label: 'ToR A', col: 1, row: 0, config: { ip: '10.0.0.2' } },
      { ref: 'sw2', type: 'sw-tor', label: 'ToR B', col: 3, row: 0, config: { ip: '10.0.0.3' } },
      { ref: 'n1', type: 'hv-proxmox', label: 'PVE-01', col: 0, row: 2, config: { ip: '10.0.0.11', cpu: 'EPYC 9354', cores: 32, ramGb: 512, rackUnit: 'U20' } },
      { ref: 'n2', type: 'hv-proxmox', label: 'PVE-02', col: 2, row: 2, config: { ip: '10.0.0.12', cpu: 'EPYC 9354', cores: 32, ramGb: 512, rackUnit: 'U18' } },
      { ref: 'n3', type: 'hv-proxmox', label: 'PVE-03', col: 4, row: 2, config: { ip: '10.0.0.13', cpu: 'EPYC 9354', cores: 32, ramGb: 512, rackUnit: 'U16' } },
      { ref: 'ceph', type: 'st-ceph', label: 'Ceph', col: 2, row: 3, config: { ip: '10.0.0.20', storageTb: 96, rackUnit: 'U12' } },
      { ref: 'mon', type: 'mon-prometheus', label: 'Supervision', col: 0, row: 0, config: { ip: '10.0.0.30' } },
      { ref: 'upsA', type: 'pwr-ups', label: 'Onduleur A', col: 0, row: 4 },
      { ref: 'upsB', type: 'pwr-ups', label: 'Onduleur B', col: 4, row: 4 },
      { ref: 'pduA', type: 'pwr-pdu', label: 'PDU A', col: 1, row: 4 },
      { ref: 'pduB', type: 'pwr-pdu', label: 'PDU B', col: 3, row: 4 }
    ],
    wires: [
      { from: 'sw1', to: 'sw2', lengthM: 2, speedGbps: 100, label: 'Interconnexion' },
      { from: 'n1', to: 'sw1', lengthM: 3, speedGbps: 10 },
      { from: 'n1', to: 'sw2', lengthM: 3, speedGbps: 10 },
      { from: 'n2', to: 'sw1', lengthM: 3, speedGbps: 10 },
      { from: 'n2', to: 'sw2', lengthM: 3, speedGbps: 10 },
      { from: 'n3', to: 'sw1', lengthM: 3, speedGbps: 10 },
      { from: 'n3', to: 'sw2', lengthM: 3, speedGbps: 10 },
      { from: 'ceph', to: 'sw1', lengthM: 5, speedGbps: 10 },
      { from: 'ceph', to: 'sw2', lengthM: 5, speedGbps: 10 },
      { from: 'mon', to: 'sw1', lengthM: 5, speedGbps: 10 },
      { from: 'upsA', to: 'pduA', kind: 'power', lengthM: 1 },
      { from: 'upsB', to: 'pduB', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 'n1', kind: 'power', lengthM: 2 },
      { from: 'pduB', to: 'n1', kind: 'power', lengthM: 2 },
      { from: 'pduA', to: 'n2', kind: 'power', lengthM: 2 },
      { from: 'pduB', to: 'n2', kind: 'power', lengthM: 2 },
      { from: 'pduA', to: 'n3', kind: 'power', lengthM: 2 },
      { from: 'pduB', to: 'n3', kind: 'power', lengthM: 2 },
      { from: 'pduA', to: 'sw1', kind: 'power', lengthM: 1 },
      { from: 'pduB', to: 'sw2', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 'ceph', kind: 'power', lengthM: 2 },
      { from: 'pduB', to: 'ceph', kind: 'power', lengthM: 2 }
    ]
  },
  {
    id: 'k8s',
    label: 'Grappe Kubernetes',
    description: 'Plan de contrôle, trois workers, répartiteur de charge, registre d\'images et supervision.',
    icon: 'i-lucide-hexagon',
    audience: 'Conteneurs en production',
    spots: [
      { ref: 'lb', type: 'svc-lb', label: 'Load balancer', col: 0, row: 1, config: { ip: '10.10.0.5' } },
      { ref: 'cp', type: 'k8s-control', label: 'Control plane', col: 1, row: 1, config: { ip: '10.10.0.10', cores: 8, ramGb: 32 } },
      { ref: 'w1', type: 'k8s-worker', label: 'Worker 1', col: 2, row: 0, config: { ip: '10.10.0.21', cores: 16, ramGb: 128 } },
      { ref: 'w2', type: 'k8s-worker', label: 'Worker 2', col: 2, row: 1, config: { ip: '10.10.0.22', cores: 16, ramGb: 128 } },
      { ref: 'w3', type: 'k8s-worker', label: 'Worker 3', col: 2, row: 2, config: { ip: '10.10.0.23', cores: 16, ramGb: 128 } },
      { ref: 'sw', type: 'sw-arista', label: 'Commutateur', col: 3, row: 1, config: { ip: '10.10.0.2' } },
      { ref: 'reg', type: 'registry', label: 'Registre', col: 4, row: 0, config: { ip: '10.10.0.30' } },
      { ref: 'mon', type: 'mon-prometheus', label: 'Métriques', col: 4, row: 2, config: { ip: '10.10.0.40' } },
      { ref: 'pdu', type: 'pwr-pdu', label: 'PDU', col: 3, row: 3 },
      { ref: 'ups', type: 'pwr-ups', label: 'Onduleur', col: 4, row: 3 }
    ],
    wires: [
      { from: 'lb', to: 'cp', lengthM: 3, speedGbps: 10 },
      { from: 'cp', to: 'sw', lengthM: 3, speedGbps: 10 },
      { from: 'w1', to: 'sw', lengthM: 2, speedGbps: 10 },
      { from: 'w2', to: 'sw', lengthM: 2, speedGbps: 10 },
      { from: 'w3', to: 'sw', lengthM: 2, speedGbps: 10 },
      { from: 'reg', to: 'sw', lengthM: 5, speedGbps: 10 },
      { from: 'mon', to: 'sw', lengthM: 5, speedGbps: 10 },
      { from: 'ups', to: 'pdu', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'sw', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'cp', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'w1', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'w2', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'w3', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'lb', kind: 'power', lengthM: 2 }
    ]
  },
  {
    id: 'dmz',
    label: 'DMZ web publique',
    description: 'Internet, pare-feu, WAF, proxy inverse, deux serveurs web et base isolée derrière un second filtrage.',
    icon: 'i-lucide-globe-lock',
    audience: 'Exposition maîtrisée',
    spots: [
      { ref: 'net', type: 'wan-internet', label: 'Internet', col: 0, row: 1 },
      { ref: 'fw', type: 'fw-palo', label: 'Pare-feu', col: 1, row: 1, config: { ip: '203.0.113.1' } },
      { ref: 'swd', type: 'sw-access-24', label: 'Commutateur DMZ', col: 2, row: 1, config: { ip: '172.16.0.2', vlan: 100 } },
      { ref: 'waf', type: 'sec-waf', label: 'WAF', col: 3, row: 0, config: { ip: '172.16.0.5', vlan: 100 } },
      { ref: 'proxy', type: 'svc-proxy', label: 'Proxy inverse', col: 3, row: 1, config: { ip: '172.16.0.10', vlan: 100 } },
      { ref: 'web1', type: 'svc-web', label: 'Web 1', col: 4, row: 0, config: { ip: '172.16.0.21', vlan: 100 } },
      { ref: 'web2', type: 'svc-web', label: 'Web 2', col: 4, row: 2, config: { ip: '172.16.0.22', vlan: 100 } },
      { ref: 'fw2', type: 'fw-generic', label: 'Pare-feu interne', col: 5, row: 1, config: { ip: '10.0.50.1' } },
      { ref: 'db', type: 'svc-db', label: 'Base de données', col: 6, row: 1, config: { ip: '10.0.50.10', vlan: 50 } },
      { ref: 'siem', type: 'sec-siem', label: 'SIEM', col: 2, row: 3, config: { ip: '172.16.0.30', vlan: 100 } }
    ],
    wires: [
      { from: 'net', to: 'fw', lengthM: 50, speedGbps: 10 },
      { from: 'fw', to: 'swd', lengthM: 3, speedGbps: 10 },
      { from: 'swd', to: 'waf', lengthM: 3, speedGbps: 10 },
      { from: 'swd', to: 'proxy', lengthM: 3, speedGbps: 10 },
      { from: 'swd', to: 'web1', lengthM: 5, speedGbps: 10 },
      { from: 'swd', to: 'web2', lengthM: 5, speedGbps: 10 },
      { from: 'swd', to: 'siem', lengthM: 5, speedGbps: 10 },
      { from: 'swd', to: 'fw2', lengthM: 5, speedGbps: 10 },
      { from: 'fw2', to: 'db', lengthM: 5, speedGbps: 10 }
    ]
  },
  {
    id: 'leaf-spine',
    label: 'Datacenter leaf-spine',
    description: 'Deux spines, quatre leaves entièrement maillés, châssis de calcul et console série hors bande.',
    icon: 'i-lucide-circuit-board',
    audience: 'Salle machine',
    spots: [
      { ref: 's1', type: 'sw-juniper-qfx', label: 'Spine 1', col: 1, row: 0, config: { ip: '10.255.0.1' } },
      { ref: 's2', type: 'sw-juniper-qfx', label: 'Spine 2', col: 3, row: 0, config: { ip: '10.255.0.2' } },
      { ref: 'l1', type: 'sw-cisco-nexus', label: 'Leaf 1', col: 0, row: 2, config: { ip: '10.255.1.1' } },
      { ref: 'l2', type: 'sw-cisco-nexus', label: 'Leaf 2', col: 1.5, row: 2, config: { ip: '10.255.1.2' } },
      { ref: 'l3', type: 'sw-cisco-nexus', label: 'Leaf 3', col: 3, row: 2, config: { ip: '10.255.1.3' } },
      { ref: 'l4', type: 'sw-cisco-nexus', label: 'Leaf 4', col: 4.5, row: 2, config: { ip: '10.255.1.4' } },
      { ref: 'c1', type: 'srv-blade', label: 'Châssis A', col: 0.5, row: 3.5, config: { rackUnit: 'U30' } },
      { ref: 'c2', type: 'srv-blade', label: 'Châssis B', col: 3.5, row: 3.5, config: { rackUnit: 'U24' } },
      { ref: 'con', type: 'mon-console', label: 'Console série', col: 2.2, row: 4.6, config: { ip: '10.255.9.1' } },
      { ref: 'pdu', type: 'pwr-pdu', label: 'PDU', col: 0, row: 4.6 },
      { ref: 'ups', type: 'pwr-ups', label: 'Onduleur', col: 4.5, row: 4.6 }
    ],
    wires: [
      { from: 'l1', to: 's1', lengthM: 15, speedGbps: 100 },
      { from: 'l1', to: 's2', lengthM: 15, speedGbps: 100 },
      { from: 'l2', to: 's1', lengthM: 15, speedGbps: 100 },
      { from: 'l2', to: 's2', lengthM: 15, speedGbps: 100 },
      { from: 'l3', to: 's1', lengthM: 15, speedGbps: 100 },
      { from: 'l3', to: 's2', lengthM: 15, speedGbps: 100 },
      { from: 'l4', to: 's1', lengthM: 15, speedGbps: 100 },
      { from: 'l4', to: 's2', lengthM: 15, speedGbps: 100 },
      { from: 'c1', to: 'l1', lengthM: 3, speedGbps: 10 },
      { from: 'c1', to: 'l2', lengthM: 3, speedGbps: 10 },
      { from: 'c2', to: 'l3', lengthM: 3, speedGbps: 10 },
      { from: 'c2', to: 'l4', lengthM: 3, speedGbps: 10 },
      { from: 'con', to: 'l1', lengthM: 2, speedGbps: 1 },
      { from: 'ups', to: 'pdu', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'c1', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'c2', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'l1', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'l2', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'l3', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'l4', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'con', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 's1', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 's2', kind: 'power', lengthM: 1 }
    ]
  },
  {
    id: 'campus',
    label: 'Réseau campus',
    description: 'Cœur redondé, deux niveaux de distribution, commutateurs d\'étage en fibre, Wi-Fi centralisé et téléphonie.',
    icon: 'i-lucide-building-2',
    audience: 'Site multi-étages',
    spots: [
      { ref: 'fw', type: 'fw-fortigate', label: 'Pare-feu', col: 2, row: -1, config: { ip: '10.1.0.254' } },
      { ref: 'core', type: 'sw-core', label: 'Cœur', col: 2, row: 0, config: { ip: '10.1.0.1' } },
      { ref: 'd1', type: 'rt-l3-switch', label: 'Distribution A', col: 1, row: 1, config: { ip: '10.1.1.1' } },
      { ref: 'd2', type: 'rt-l3-switch', label: 'Distribution B', col: 3, row: 1, config: { ip: '10.1.1.2' } },
      { ref: 'a1', type: 'sw-cisco-cat', label: 'Étage 1', col: 0, row: 2, config: { ip: '10.1.10.1', vlan: 10 } },
      { ref: 'a2', type: 'sw-cisco-cat', label: 'Étage 2', col: 2, row: 2, config: { ip: '10.1.20.1', vlan: 20 } },
      { ref: 'a3', type: 'sw-cisco-cat', label: 'Étage 3', col: 4, row: 2, config: { ip: '10.1.30.1', vlan: 30 } },
      { ref: 'wlc', type: 'wifi-wlc', label: 'Contrôleur Wi-Fi', col: 1, row: 3, config: { ip: '10.1.5.10' } },
      { ref: 'ap', type: 'wifi-ap6', label: 'Point d\'accès', col: 0, row: 3, config: { ip: '10.1.40.11' } },
      { ref: 'voip', type: 'ep-phone', label: 'Téléphone IP', col: 4, row: 3, config: { ip: '10.1.50.11' } },
      { ref: 'mon', type: 'mon-snmp', label: 'Sonde SNMP', col: 3, row: 3, config: { ip: '10.1.9.10' } }
    ],
    wires: [
      { from: 'fw', to: 'core', lengthM: 5, speedGbps: 40 },
      { from: 'core', to: 'd1', lengthM: 30, speedGbps: 40 },
      { from: 'core', to: 'd2', lengthM: 30, speedGbps: 40 },
      { from: 'd1', to: 'd2', lengthM: 10, speedGbps: 40 },
      { from: 'd1', to: 'a1', lengthM: 80, speedGbps: 10 },
      { from: 'd1', to: 'a2', lengthM: 80, speedGbps: 10 },
      { from: 'd2', to: 'a2', lengthM: 80, speedGbps: 10 },
      { from: 'd2', to: 'a3', lengthM: 80, speedGbps: 10 },
      { from: 'wlc', to: 'd1', lengthM: 5, speedGbps: 10 },
      { from: 'ap', to: 'a1', lengthM: 40, speedGbps: 2.5 },
      { from: 'voip', to: 'a3', lengthM: 20, speedGbps: 1 },
      { from: 'mon', to: 'd2', lengthM: 5, speedGbps: 1 }
    ]
  },
  {
    id: 'rack',
    label: 'Baie complète',
    description: 'Baie 42U instrumentée : ToR, serveurs positionnés en U, NAS, double PDU sur onduleur et console série.',
    icon: 'i-lucide-columns-3',
    audience: 'Documentation de baie',
    spots: [
      { ref: 'tor', type: 'sw-tor', label: 'ToR', col: 1, row: 0, config: { rackUnit: 'U42', ip: '10.0.0.2' } },
      { ref: 's1', type: 'srv-1u', label: 'SRV-01', col: 2, row: 0, config: { rackUnit: 'U40', ip: '10.0.0.11', cpu: 'Xeon Gold 6430' } },
      { ref: 's2', type: 'srv-1u', label: 'SRV-02', col: 2, row: 1, config: { rackUnit: 'U39', ip: '10.0.0.12', cpu: 'Xeon Gold 6430' } },
      { ref: 's3', type: 'srv-2u', label: 'SRV-03', col: 2, row: 2, config: { rackUnit: 'U37', ip: '10.0.0.13', cpu: 'Threadripper PRO 7995WX' } },
      { ref: 'nas', type: 'st-nas', label: 'NAS', col: 3, row: 1, config: { rackUnit: 'U34', ip: '10.0.0.20' } },
      { ref: 'con', type: 'mon-console', label: 'Console série', col: 3, row: 2, config: { rackUnit: 'U33', ip: '10.0.0.250' } },
      { ref: 'rack', type: 'rack-42u', label: 'Baie 42U', col: 0, row: 1 },
      { ref: 'ups', type: 'pwr-ups', label: 'Onduleur', col: 0, row: 3 },
      { ref: 'pduA', type: 'pwr-pdu', label: 'PDU A', col: 1, row: 3, config: { rackUnit: 'U01' } },
      { ref: 'pduB', type: 'pwr-pdu', label: 'PDU B', col: 2, row: 3, config: { rackUnit: 'U02' } }
    ],
    wires: [
      { from: 's1', to: 'tor', lengthM: 1, speedGbps: 10 },
      { from: 's2', to: 'tor', lengthM: 1, speedGbps: 10 },
      { from: 's3', to: 'tor', lengthM: 1, speedGbps: 10 },
      { from: 'nas', to: 'tor', lengthM: 2, speedGbps: 10 },
      { from: 'con', to: 'tor', lengthM: 2, speedGbps: 1 },
      { from: 'ups', to: 'pduA', kind: 'power', lengthM: 1 },
      { from: 'ups', to: 'pduB', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 'tor', kind: 'power', lengthM: 1 },
      { from: 'pduB', to: 'tor', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 's1', kind: 'power', lengthM: 1 },
      { from: 'pduB', to: 's1', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 's2', kind: 'power', lengthM: 1 },
      { from: 'pduB', to: 's2', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 's3', kind: 'power', lengthM: 1 },
      { from: 'pduB', to: 's3', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 'nas', kind: 'power', lengthM: 1 },
      { from: 'pduB', to: 'nas', kind: 'power', lengthM: 1 },
      { from: 'pduA', to: 'con', kind: 'power', lengthM: 1 },
      { from: 'pduB', to: 'con', kind: 'power', lengthM: 1 }
    ]
  },
  {
    id: 'multisite',
    label: 'Multi-site & télétravail',
    description: 'Siège et agence reliés par Internet, secours 4G côté agence, et passerelle VPN pour les nomades.',
    icon: 'i-lucide-waypoints',
    audience: 'Organisation répartie',
    spots: [
      { ref: 'net', type: 'wan-internet', label: 'Internet', col: 2, row: 0 },
      { ref: 'fw1', type: 'fw-fortigate', label: 'Pare-feu siège', col: 1, row: 1, config: { ip: '192.168.10.1' } },
      { ref: 'sw1', type: 'sw-access-48', label: 'Commutateur siège', col: 0, row: 2, config: { ip: '192.168.10.2' } },
      { ref: 'fw2', type: 'fw-fortigate', label: 'Pare-feu agence', col: 3, row: 1, config: { ip: '192.168.20.1' } },
      { ref: 'sw2', type: 'sw-access-24', label: 'Commutateur agence', col: 4, row: 2, config: { ip: '192.168.20.2' } },
      { ref: 'lte', type: 'wan-4g', label: 'Secours 4G', col: 4, row: 0, config: { ip: '192.168.20.9' } },
      { ref: 'vpn', type: 'sec-wireguard', label: 'VPN nomades', col: 2, row: 2, config: { ip: '192.168.10.5' } },
      { ref: 'lap', type: 'ep-laptop', label: 'Poste nomade', col: 2, row: 3 },
      { ref: 'pdu', type: 'pwr-pdu', label: 'PDU siège', col: 0, row: 3 },
      { ref: 'ups', type: 'pwr-ups', label: 'Onduleur siège', col: 0, row: 4 },
      { ref: 'pdu2', type: 'pwr-pdu', label: 'PDU agence', col: 4, row: 3 },
      { ref: 'ups2', type: 'pwr-ups', label: 'Onduleur agence', col: 4, row: 4 }
    ],
    wires: [
      { from: 'net', to: 'fw1', lengthM: 30, speedGbps: 1 },
      { from: 'net', to: 'fw2', lengthM: 30, speedGbps: 1 },
      { from: 'fw1', to: 'sw1', lengthM: 3, speedGbps: 10 },
      { from: 'fw2', to: 'sw2', lengthM: 3, speedGbps: 1 },
      { from: 'lte', to: 'fw2', lengthM: 3, speedGbps: 1 },
      { from: 'vpn', to: 'fw1', lengthM: 3, speedGbps: 1 },
      { from: 'lap', to: 'vpn', lengthM: 50, speedGbps: 2 },
      { from: 'ups', to: 'pdu', kind: 'power', lengthM: 1 },
      { from: 'pdu', to: 'fw1', kind: 'power', lengthM: 2 },
      { from: 'pdu', to: 'sw1', kind: 'power', lengthM: 2 },
      { from: 'ups2', to: 'pdu2', kind: 'power', lengthM: 1 },
      { from: 'pdu2', to: 'fw2', kind: 'power', lengthM: 2 },
      { from: 'pdu2', to: 'sw2', kind: 'power', lengthM: 2 },
      { from: 'pdu2', to: 'lte', kind: 'power', lengthM: 2 }
    ]
  }
]

export function findBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS.find(blueprint => blueprint.id === id)
}

/* ------------------------------------------------- Choix des prises */

/** Occupation en cours de génération, pour ne pas saturer une prise. */
type Usage = Map<string, number>

const usageKey = (nodeId: string, slotId: string) => `${nodeId}|${slotId}`

function freeSlots(node: BoardNode, kind: 'data' | 'power', usage: Usage): PortSlot[] {
  return portSlots(node)
    .filter(slot => (kind === 'power' ? slot.family === 'power' : slot.family === 'data'))
    .filter(slot => (usage.get(usageKey(node.id, slot.id)) ?? 0) < slot.count)
}

/**
 * Meilleure paire de prises entre deux équipements.
 *
 * Le score privilégie une connectique identique, écarte le cuivre au-delà de
 * 90 m, et préfère les prises les plus rapides — soit le raisonnement d'un
 * câbleur devant sa baie.
 */
function chooseWiring(
  from: BoardNode,
  to: BoardNode,
  wire: Wire,
  usage: Usage
): { fromPort: string, toPort: string, medium: MediumId, speedGbps: number } | null {
  const kind = wire.kind ?? 'data'
  const sources = freeSlots(from, kind, usage)
  const targets = freeSlots(to, kind, usage)

  let best: { score: number, fromPort: string, toPort: string, medium: MediumId, speed: number } | null = null

  for (const a of sources) {
    for (const b of targets) {
      const cable = inferCable(a.connector, b.connector, a.speedGbps, b.speedGbps, wire.lengthM)
      if (!cable) continue

      const copper = a.connector === 'rj45' && b.connector === 'rj45'
      let score = Math.min(a.speedGbps, b.speedGbps)

      if (a.connector === b.connector) score += 100
      if (copper && wire.lengthM > 90) score -= 1000
      if (!copper && wire.lengthM > 90) score += 50

      // Un débit visé par le modèle oriente vers la prise adaptée.
      if (wire.speedGbps) {
        const usable = Math.min(a.speedGbps, b.speedGbps)
        score -= Math.abs(usable - wire.speedGbps) / 10
        if (usable < wire.speedGbps) score -= 200
      }

      if (!best || score > best.score) {
        best = {
          score,
          fromPort: a.id,
          toPort: b.id,
          medium: cable.medium,
          speed: wire.speedGbps ? Math.min(cable.speedGbps || wire.speedGbps, wire.speedGbps) : cable.speedGbps
        }
      }
    }
  }

  if (!best) return null

  usage.set(usageKey(from.id, best.fromPort), (usage.get(usageKey(from.id, best.fromPort)) ?? 0) + 1)
  usage.set(usageKey(to.id, best.toPort), (usage.get(usageKey(to.id, best.toPort)) ?? 0) + 1)

  return {
    fromPort: best.fromPort,
    toPort: best.toPort,
    medium: best.medium,
    speedGbps: best.speed
  }
}

/**
 * Instancie un modèle à partir d'une origine donnée.
 *
 * Les liaisons passent par le moteur de câblage : prises réelles, câble déduit
 * des connecteurs, occupation respectée. Un lien impossible est omis plutôt que
 * posé de force.
 */
export function instantiate(
  blueprint: Blueprint,
  originX = 60,
  originY = 60
): { nodes: BoardNode[], links: BoardLink[] } {
  const byRef = new Map<string, BoardNode>()
  const nodes: BoardNode[] = []

  for (const spot of blueprint.spots) {
    const node = createNode(spot.type, originX + spot.col * COL, originY + spot.row * ROW)
    if (!node) continue

    if (spot.label) node.label = spot.label
    if (spot.config) node.config = { ...node.config, ...spot.config }

    byRef.set(spot.ref, node)
    nodes.push(node)
  }

  const usage: Usage = new Map()
  const links: BoardLink[] = []

  for (const wire of blueprint.wires) {
    const from = byRef.get(wire.from)
    const to = byRef.get(wire.to)
    if (!from || !to) continue

    const wiring = chooseWiring(from, to, wire, usage)
    if (!wiring) continue

    links.push({
      id: genId('l'),
      from: from.id,
      to: to.id,
      fromPort: wiring.fromPort,
      toPort: wiring.toPort,
      medium: wiring.medium,
      speedGbps: wiring.speedGbps,
      lengthM: wire.lengthM,
      label: wire.label
    })
  }

  return { nodes, links }
}
