/**
 * Catalogue des intentions reconnues.
 *
 * Chaque entrée décrit ce que l'utilisateur peut demander, les paramètres à
 * extraire de sa phrase, et la commande correspondante par plateforme. Une
 * plateforme absente signifie « pas d'équivalent direct » : l'interface le dit
 * plutôt que d'improviser.
 */

import type { Intent } from './types'

const PORT = { id: 'port', label: 'Port', placeholder: '22', fallback: '22' }
const PROTO = { id: 'proto', label: 'Protocole', placeholder: 'tcp', fallback: 'tcp' }
const IP = { id: 'ip', label: 'Adresse ou réseau', placeholder: '192.168.1.10' }
const SERVICE = { id: 'service', label: 'Service', placeholder: 'nginx' }
const IFACE = { id: 'iface', label: 'Interface', placeholder: 'eth0', fallback: 'eth0' }
const USER = { id: 'user', label: 'Utilisateur', placeholder: 'alice' }
const PATH = { id: 'path', label: 'Chemin', placeholder: '/var/www' }
const HOST = { id: 'host', label: 'Hôte', placeholder: 'exemple.fr' }
const PACKAGE = { id: 'package', label: 'Paquet', placeholder: 'nginx' }
const CONTAINER = { id: 'container', label: 'Conteneur', placeholder: 'web' }

export const INTENTS: Intent[] = [
  /* =============================================================== Pare-feu */
  {
    id: 'firewall.open-port',
    label: 'Ouvrir un port',
    category: 'Pare-feu',
    keywords: [['ouvrir', 4], ['ouvre', 4], ['autoriser', 3], ['port', 4], ['debloquer', 3], ['pare-feu', 2], ['firewall', 2]],
    exclude: ['fermer', 'bloquer', 'interdire', 'supprimer'],
    slots: [PORT, PROTO],
    examples: ['ouvrir le port 22', 'autoriser le port https', 'ouvre le port 53 en udp'],
    platforms: {
      debian: {
        commands: ['sudo ufw allow {port}/{proto}'],
        verify: 'sudo ufw status numbered',
        undo: 'sudo ufw delete allow {port}/{proto}',
        note: 'Si ufw est inactif, la règle est enregistrée mais ne s\'applique qu\'après « sudo ufw enable ».'
      },
      rhel: {
        commands: [
          'sudo firewall-cmd --permanent --add-port={port}/{proto}',
          'sudo firewall-cmd --reload'
        ],
        verify: 'sudo firewall-cmd --list-ports',
        undo: 'sudo firewall-cmd --permanent --remove-port={port}/{proto} && sudo firewall-cmd --reload',
        note: 'Sans --permanent, la règle disparaît au prochain redémarrage de firewalld.'
      },
      windows: {
        commands: ['New-NetFirewallRule -DisplayName "Autoriser {proto_up} {port}" -Direction Inbound -Protocol {proto_up} -LocalPort {port} -Action Allow'],
        verify: 'Get-NetFirewallRule -DisplayName "Autoriser {proto_up} {port}" | Format-List',
        undo: 'Remove-NetFirewallRule -DisplayName "Autoriser {proto_up} {port}"',
        note: 'À lancer depuis une console PowerShell ouverte en administrateur.'
      },
      macos: {
        commands: [
          'echo "pass in proto {proto} from any to any port {port}" | sudo tee -a /etc/pf.conf',
          'sudo pfctl -f /etc/pf.conf -e'
        ],
        verify: 'sudo pfctl -sr',
        note: 'Le pare-feu applicatif de macOS filtre par programme, pas par port : le filtrage par port passe par pf.'
      },
      cisco: {
        commands: [
          'configure terminal',
          'ip access-list extended AUTORISE-{port}',
          ' permit {proto} any any eq {port}',
          'end'
        ],
        verify: 'show access-lists AUTORISE-{port}',
        note: 'La liste ne filtre rien tant qu\'elle n\'est pas appliquée : « interface X » puis « ip access-group AUTORISE-{port} in ».'
      },
      mikrotik: {
        commands: ['/ip firewall filter add chain=input protocol={proto} dst-port={port} action=accept comment="port {port}"'],
        verify: '/ip firewall filter print where dst-port={port}',
        undo: '/ip firewall filter remove [find dst-port={port}]',
        note: 'La règle est ajoutée en fin de chaîne : vérifiez qu\'aucun drop ne la précède.'
      },
      junos: {
        commands: [
          'configure',
          'set firewall family inet filter PROTECT term autorise-{port} from protocol {proto} destination-port {port}',
          'set firewall family inet filter PROTECT term autorise-{port} then accept',
          'commit and-quit'
        ],
        verify: 'show configuration firewall family inet filter PROTECT'
      }
    }
  },
  {
    id: 'firewall.close-port',
    label: 'Fermer un port',
    category: 'Pare-feu',
    keywords: [['fermer', 5], ['ferme', 5], ['bloquer', 4], ['interdire', 4], ['port', 4], ['refuser', 3]],
    exclude: ['ouvrir', 'autoriser'],
    slots: [PORT, PROTO],
    examples: ['fermer le port 23', 'bloquer le port telnet'],
    platforms: {
      debian: {
        commands: ['sudo ufw deny {port}/{proto}'],
        verify: 'sudo ufw status numbered',
        undo: 'sudo ufw delete deny {port}/{proto}',
        note: 'Pour retirer une autorisation existante plutôt que d\'ajouter un refus : « sudo ufw delete allow {port}/{proto} ».'
      },
      rhel: {
        commands: [
          'sudo firewall-cmd --permanent --remove-port={port}/{proto}',
          'sudo firewall-cmd --reload'
        ],
        verify: 'sudo firewall-cmd --list-ports'
      },
      windows: {
        commands: ['New-NetFirewallRule -DisplayName "Bloquer {proto_up} {port}" -Direction Inbound -Protocol {proto_up} -LocalPort {port} -Action Block'],
        verify: 'Get-NetFirewallRule -DisplayName "Bloquer {proto_up} {port}"',
        undo: 'Remove-NetFirewallRule -DisplayName "Bloquer {proto_up} {port}"'
      },
      mikrotik: {
        commands: ['/ip firewall filter add chain=input protocol={proto} dst-port={port} action=drop comment="blocage {port}"'],
        verify: '/ip firewall filter print'
      },
      cisco: {
        commands: [
          'configure terminal',
          'ip access-list extended BLOQUE-{port}',
          ' deny {proto} any any eq {port}',
          ' permit ip any any',
          'end'
        ],
        note: 'Le « permit ip any any » final évite de tout couper : une ACL se termine par un refus implicite.'
      }
    }
  },
  {
    id: 'firewall.allow-ip',
    label: 'Autoriser une adresse',
    category: 'Pare-feu',
    keywords: [['autoriser', 4], ['autorise', 4], ['whitelist', 4], ['ouvrir', 2], ['adresse', 3], ['ip', 3], ['machine', 2]],
    exclude: ['bloquer', 'interdire'],
    slots: [IP],
    examples: ['autoriser 192.168.1.10', 'whitelist 10.0.0.0/8'],
    platforms: {
      debian: {
        commands: ['sudo ufw allow from {ip}'],
        verify: 'sudo ufw status numbered',
        undo: 'sudo ufw delete allow from {ip}'
      },
      rhel: {
        commands: [
          'sudo firewall-cmd --permanent --add-source={ip} --zone=trusted',
          'sudo firewall-cmd --reload'
        ],
        verify: 'sudo firewall-cmd --zone=trusted --list-sources'
      },
      windows: {
        commands: ['New-NetFirewallRule -DisplayName "Autoriser {ip}" -Direction Inbound -RemoteAddress {ip} -Action Allow'],
        undo: 'Remove-NetFirewallRule -DisplayName "Autoriser {ip}"'
      },
      mikrotik: {
        commands: ['/ip firewall filter add chain=input src-address={ip} action=accept place-before=0 comment="autorise {ip}"'],
        note: 'place-before=0 hisse la règle en tête de chaîne, avant tout blocage.'
      }
    }
  },
  {
    id: 'firewall.block-ip',
    label: 'Bloquer une adresse',
    category: 'Pare-feu',
    keywords: [['bloquer', 5], ['bloque', 5], ['banni', 4], ['bannir', 4], ['interdire', 4], ['blacklist', 4], ['adresse', 2], ['ip', 2]],
    exclude: ['autoriser', 'debloquer'],
    slots: [IP],
    examples: ['bloquer 203.0.113.7', 'bannir le réseau 198.51.100.0/24'],
    platforms: {
      debian: {
        commands: ['sudo ufw deny from {ip}'],
        verify: 'sudo ufw status numbered',
        undo: 'sudo ufw delete deny from {ip}'
      },
      rhel: {
        commands: [
          'sudo firewall-cmd --permanent --add-rich-rule=\'rule family="ipv4" source address="{ip}" drop\'',
          'sudo firewall-cmd --reload'
        ],
        verify: 'sudo firewall-cmd --list-rich-rules'
      },
      windows: {
        commands: ['New-NetFirewallRule -DisplayName "Bloquer {ip}" -Direction Inbound -RemoteAddress {ip} -Action Block'],
        undo: 'Remove-NetFirewallRule -DisplayName "Bloquer {ip}"'
      },
      mikrotik: {
        commands: ['/ip firewall address-list add list=blackhole address={ip}'],
        note: 'Une liste d\'adresses se réutilise dans plusieurs règles et se met à jour sans toucher au filtrage.'
      },
      cisco: {
        commands: [
          'configure terminal',
          'ip access-list extended BLOQUE-SOURCE',
          ' deny ip {ip_addr} {ip_wildcard} any',
          ' permit ip any any',
          'end'
        ]
      }
    }
  },
  {
    id: 'firewall.list',
    label: 'Lister les règles du pare-feu',
    category: 'Pare-feu',
    keywords: [['regles', 4], ['liste', 3], ['lister', 3], ['voir', 2], ['afficher', 2], ['pare-feu', 5], ['firewall', 5], ['ufw', 4]],
    slots: [],
    examples: ['voir les règles du pare-feu', 'lister le firewall'],
    platforms: {
      debian: { commands: ['sudo ufw status verbose'] },
      rhel: { commands: ['sudo firewall-cmd --list-all'] },
      windows: { commands: ['Get-NetFirewallRule -Enabled True | Select-Object DisplayName, Direction, Action'] },
      macos: { commands: ['sudo pfctl -sr'] },
      cisco: { commands: ['show access-lists'] },
      mikrotik: { commands: ['/ip firewall filter print'] },
      junos: { commands: ['show configuration firewall'] }
    }
  },
  {
    id: 'firewall.enable',
    label: 'Activer le pare-feu',
    category: 'Pare-feu',
    keywords: [['activer', 5], ['active', 4], ['demarrer', 3], ['pare-feu', 5], ['firewall', 5], ['ufw', 4]],
    exclude: ['desactiver', 'regles', 'lister'],
    slots: [],
    examples: ['activer le pare-feu'],
    platforms: {
      debian: {
        commands: ['sudo ufw enable'],
        verify: 'sudo ufw status',
        undo: 'sudo ufw disable',
        danger: 'Si vous êtes connecté en SSH, autorisez le port 22 AVANT d\'activer, sinon la session est coupée.'
      },
      rhel: {
        commands: ['sudo systemctl enable --now firewalld'],
        verify: 'sudo firewall-cmd --state',
        undo: 'sudo systemctl disable --now firewalld'
      },
      windows: {
        commands: ['Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True'],
        verify: 'Get-NetFirewallProfile | Select-Object Name, Enabled'
      }
    }
  },

  /* ================================================================= Réseau */
  {
    id: 'net.show-ip',
    label: 'Voir les adresses IP',
    category: 'Réseau',
    keywords: [['adresse', 4], ['adresses', 4], ['ip', 4], ['voir', 2], ['afficher', 2], ['quelle', 2], ['configuration', 2]],
    exclude: ['ajouter', 'changer', 'bloquer', 'autoriser', 'mac'],
    slots: [],
    examples: ['voir mes adresses ip', 'quelle est mon adresse ip'],
    platforms: {
      debian: { commands: ['ip -c addr show'], note: 'ip -br addr donne une vue condensée, une ligne par interface.' },
      rhel: { commands: ['ip -c addr show'] },
      windows: { commands: ['Get-NetIPAddress | Where-Object AddressFamily -eq IPv4 | Format-Table InterfaceAlias, IPAddress, PrefixLength'] },
      macos: { commands: ['ifconfig | grep "inet "'] },
      cisco: { commands: ['show ip interface brief'] },
      mikrotik: { commands: ['/ip address print'] },
      junos: { commands: ['show interfaces terse'] }
    }
  },
  {
    id: 'net.set-ip',
    label: 'Configurer une adresse IP',
    category: 'Réseau',
    keywords: [['configurer', 4], ['ajouter', 4], ['definir', 4], ['attribuer', 4], ['adresse', 3], ['ip', 3], ['interface', 3]],
    slots: [IP, IFACE],
    examples: ['ajouter l\'adresse 192.168.1.50/24 sur eth0'],
    platforms: {
      debian: {
        commands: ['sudo ip addr add {ip} dev {iface}'],
        verify: 'ip -br addr show {iface}',
        undo: 'sudo ip addr del {ip} dev {iface}',
        note: 'Attribution temporaire : elle disparaît au redémarrage. Pour la rendre durable, passez par Netplan ou /etc/network/interfaces.'
      },
      rhel: {
        commands: ['sudo nmcli connection modify {iface} ipv4.addresses {ip} ipv4.method manual', 'sudo nmcli connection up {iface}'],
        verify: 'nmcli connection show {iface} | grep ipv4'
      },
      windows: {
        commands: ['New-NetIPAddress -InterfaceAlias "{iface}" -IPAddress {ip} -PrefixLength 24'],
        verify: 'Get-NetIPAddress -InterfaceAlias "{iface}"'
      },
      cisco: {
        commands: ['configure terminal', 'interface {iface}', ' ip address {ip_addr} {ip_mask}', ' no shutdown', 'end'],
        verify: 'show ip interface {iface}',
        note: 'Le masque est rendu en notation décimale, seule forme acceptée par IOS.'
      },
      mikrotik: {
        commands: ['/ip address add address={ip} interface={iface}'],
        verify: '/ip address print'
      },
      junos: {
        commands: ['configure', 'set interfaces {iface} unit 0 family inet address {ip}', 'commit and-quit']
      }
    }
  },
  {
    id: 'net.default-route',
    label: 'Voir ou définir la passerelle',
    category: 'Réseau',
    keywords: [['passerelle', 5], ['gateway', 5], ['route', 4], ['defaut', 3], ['routage', 3]],
    slots: [{ id: 'ip', label: 'Passerelle', placeholder: '192.168.1.1' }],
    examples: ['voir la passerelle par défaut', 'définir la passerelle 192.168.1.1'],
    platforms: {
      debian: {
        commands: ['ip route show default'],
        note: 'Pour la changer : sudo ip route replace default via {ip}'
      },
      rhel: { commands: ['ip route show default'] },
      windows: { commands: ['Get-NetRoute -DestinationPrefix "0.0.0.0/0"'] },
      macos: { commands: ['netstat -rn | grep default'] },
      cisco: { commands: ['show ip route 0.0.0.0'], note: 'Pour la définir : ip route 0.0.0.0 0.0.0.0 {ip}' },
      mikrotik: { commands: ['/ip route print where dst-address=0.0.0.0/0'] },
      junos: { commands: ['show route 0.0.0.0/0'] }
    }
  },
  {
    id: 'net.add-route',
    label: 'Ajouter une route',
    category: 'Réseau',
    keywords: [['ajouter', 4], ['route', 5], ['router', 3], ['joindre', 2], ['reseau', 3]],
    exclude: ['passerelle', 'defaut'],
    slots: [
      { id: 'network', label: 'Réseau visé', placeholder: '10.0.0.0/8' },
      { id: 'ip', label: 'Prochain saut', placeholder: '192.168.1.254' }
    ],
    examples: ['ajouter une route vers 10.0.0.0/8 via 192.168.1.254'],
    platforms: {
      debian: {
        commands: ['sudo ip route add {network} via {ip}'],
        verify: 'ip route get {network}',
        undo: 'sudo ip route del {network} via {ip}',
        note: 'Route temporaire : elle ne survit pas au redémarrage.'
      },
      rhel: { commands: ['sudo ip route add {network} via {ip}'], undo: 'sudo ip route del {network} via {ip}' },
      windows: { commands: ['New-NetRoute -DestinationPrefix {network} -NextHop {ip} -InterfaceAlias "Ethernet"'] },
      cisco: { commands: ['configure terminal', 'ip route {network_addr} {network_mask} {ip}', 'end'] },
      mikrotik: { commands: ['/ip route add dst-address={network} gateway={ip}'] },
      junos: { commands: ['configure', 'set routing-options static route {network} next-hop {ip}', 'commit and-quit'] }
    }
  },
  {
    id: 'net.ping',
    label: 'Tester la joignabilité',
    category: 'Réseau',
    keywords: [['ping', 5], ['tester', 4], ['joindre', 3], ['joignable', 4], ['repond', 3], ['accessible', 3], ['connectivite', 4]],
    slots: [HOST],
    examples: ['tester si exemple.fr répond', 'ping 8.8.8.8'],
    platforms: {
      debian: { commands: ['ping -c 4 {host}'] },
      rhel: { commands: ['ping -c 4 {host}'] },
      windows: { commands: ['Test-NetConnection -ComputerName {host}'], note: 'Ajoutez -Port 443 pour tester aussi un port précis.' },
      macos: { commands: ['ping -c 4 {host}'] },
      cisco: { commands: ['ping {host}'] },
      mikrotik: { commands: ['/ping {host} count=4'] },
      junos: { commands: ['ping {host} count 4'] }
    }
  },
  {
    id: 'net.dns',
    label: 'Résoudre un nom',
    category: 'Réseau',
    keywords: [['dns', 5], ['resoudre', 5], ['resolution', 4], ['nom', 2], ['enregistrement', 3], ['nslookup', 4], ['dig', 4]],
    slots: [HOST],
    examples: ['résoudre exemple.fr', 'dns de tanchi.io'],
    platforms: {
      debian: { commands: ['dig +short {host}'], note: 'dig {host} ANY +noall +answer donne tous les enregistrements connus du résolveur.' },
      rhel: { commands: ['dig +short {host}'] },
      windows: { commands: ['Resolve-DnsName {host}'] },
      macos: { commands: ['dig +short {host}'] },
      mikrotik: { commands: ['/resolve {host}'] }
    }
  },
  {
    id: 'net.listening',
    label: 'Voir les ports en écoute',
    category: 'Réseau',
    keywords: [['ecoute', 5], ['ecoutent', 5], ['ouverts', 3], ['ports', 4], ['listen', 4], ['netstat', 4], ['socket', 4], ['quel', 2], ['processus', 2]],
    exclude: ['ouvrir', 'fermer', 'autoriser'],
    slots: [],
    examples: ['quels ports sont en écoute', 'voir les sockets ouverts'],
    platforms: {
      debian: { commands: ['sudo ss -tulpn'], note: 'La colonne process ne s\'affiche qu\'avec les droits root.' },
      rhel: { commands: ['sudo ss -tulpn'] },
      windows: { commands: ['Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess'] },
      macos: { commands: ['sudo lsof -nP -iTCP -sTCP:LISTEN'] }
    }
  },
  {
    id: 'net.arp',
    label: 'Voir la table ARP',
    category: 'Réseau',
    keywords: [['arp', 5], ['voisins', 4], ['mac', 3], ['table', 2], ['correspondance', 2]],
    slots: [],
    examples: ['voir la table arp', 'liste des voisins mac'],
    platforms: {
      debian: { commands: ['ip neigh show'] },
      rhel: { commands: ['ip neigh show'] },
      windows: { commands: ['Get-NetNeighbor -AddressFamily IPv4'] },
      macos: { commands: ['arp -an'] },
      cisco: { commands: ['show arp'] },
      mikrotik: { commands: ['/ip arp print'] },
      junos: { commands: ['show arp'] }
    }
  },
  {
    id: 'net.capture',
    label: 'Capturer le trafic',
    category: 'Réseau',
    keywords: [['capturer', 5], ['capture', 5], ['tcpdump', 5], ['sniffer', 4], ['trafic', 4], ['trames', 3], ['wireshark', 3]],
    slots: [IFACE, PORT],
    examples: ['capturer le trafic sur eth0 port 443'],
    platforms: {
      debian: {
        commands: ['sudo tcpdump -i {iface} -nn port {port} -w /tmp/capture.pcap'],
        note: 'Sans -w, la capture s\'affiche à l\'écran. Le fichier .pcap s\'ouvre ensuite dans Wireshark.',
        verify: 'sudo tcpdump -r /tmp/capture.pcap | head'
      },
      rhel: { commands: ['sudo tcpdump -i {iface} -nn port {port} -w /tmp/capture.pcap'] },
      macos: { commands: ['sudo tcpdump -i {iface} -nn port {port}'] },
      windows: { commands: ['pktmon start --capture --pkt-size 0 --file C:\\capture.etl'], note: 'pktmon stop met fin à la capture.' },
      mikrotik: { commands: ['/tool sniffer quick interface={iface} port={port}'] }
    }
  },
  {
    id: 'net.iface-state',
    label: 'Activer ou couper une interface',
    category: 'Réseau',
    keywords: [['interface', 4], ['activer', 3], ['couper', 4], ['desactiver', 4], ['monter', 3], ['shutdown', 4], ['carte', 2]],
    slots: [IFACE],
    examples: ['couper l\'interface eth0', 'activer l\'interface ens18'],
    platforms: {
      debian: { commands: ['sudo ip link set {iface} up'], undo: 'sudo ip link set {iface} down', verify: 'ip -br link show {iface}' },
      rhel: { commands: ['sudo ip link set {iface} up'], undo: 'sudo ip link set {iface} down' },
      windows: { commands: ['Enable-NetAdapter -Name "{iface}"'], undo: 'Disable-NetAdapter -Name "{iface}"' },
      cisco: {
        commands: ['configure terminal', 'interface {iface}', ' no shutdown', 'end'],
        undo: 'configure terminal ; interface {iface} ; shutdown ; end',
        danger: 'Couper l\'interface qui porte votre session vous déconnecte du équipement.'
      },
      mikrotik: { commands: ['/interface enable {iface}'], undo: '/interface disable {iface}' },
      junos: { commands: ['configure', 'delete interfaces {iface} disable', 'commit and-quit'] }
    }
  },
  {
    id: 'net.save-config',
    label: 'Enregistrer la configuration',
    category: 'Réseau',
    keywords: [['enregistrer', 5], ['sauvegarder', 5], ['sauver', 4], ['configuration', 4], ['persister', 3], ['write', 3]],
    slots: [],
    examples: ['enregistrer la configuration'],
    platforms: {
      cisco: { commands: ['write memory'], note: 'Équivalent : copy running-config startup-config.' },
      mikrotik: { commands: ['/system backup save name=sauvegarde'], note: 'RouterOS applique les changements immédiatement ; cette commande produit une sauvegarde.' },
      junos: { commands: ['configure', 'commit and-quit'], note: 'JunOS ne rend rien actif tant que le commit n\'est pas passé.' }
    }
  },
  {
    id: 'net.vlan',
    label: 'Créer un VLAN',
    category: 'Réseau',
    keywords: [['vlan', 5], ['creer', 3], ['ajouter', 2], ['segment', 2]],
    slots: [
      { id: 'vlan', label: 'Identifiant VLAN', placeholder: '10' },
      IFACE
    ],
    examples: ['créer le vlan 10 sur eth0'],
    platforms: {
      debian: { commands: ['sudo ip link add link {iface} name {iface}.{vlan} type vlan id {vlan}', 'sudo ip link set {iface}.{vlan} up'] },
      cisco: { commands: ['configure terminal', 'vlan {vlan}', ' name VLAN{vlan}', 'end'], verify: 'show vlan brief' },
      mikrotik: { commands: ['/interface vlan add name=vlan{vlan} vlan-id={vlan} interface={iface}'] },
      junos: { commands: ['configure', 'set vlans VLAN{vlan} vlan-id {vlan}', 'commit and-quit'] }
    }
  },

  /* =============================================================== Services */
  {
    id: 'svc.restart',
    label: 'Redémarrer un service',
    category: 'Services',
    keywords: [['redemarrer', 5], ['redemarre', 5], ['relancer', 5], ['restart', 4], ['service', 3], ['recharger', 3]],
    exclude: ['machine', 'serveur entier', 'systeme'],
    slots: [SERVICE],
    examples: ['redémarrer nginx', 'relancer le service ssh'],
    platforms: {
      debian: { commands: ['sudo systemctl restart {service}'], verify: 'systemctl status {service} --no-pager' },
      rhel: { commands: ['sudo systemctl restart {service}'], verify: 'systemctl status {service} --no-pager' },
      windows: { commands: ['Restart-Service -Name {service}'], verify: 'Get-Service -Name {service}' },
      macos: { commands: ['sudo launchctl kickstart -k system/{service}'] },
      docker: { commands: ['docker restart {service}'], verify: 'docker ps --filter name={service}' }
    }
  },
  {
    id: 'svc.start',
    label: 'Démarrer un service',
    category: 'Services',
    keywords: [['demarrer', 5], ['demarre', 5], ['lancer', 4], ['start', 4], ['service', 3]],
    exclude: ['arreter', 'redemarrer', 'relancer', 'pare-feu'],
    slots: [SERVICE],
    examples: ['démarrer nginx'],
    platforms: {
      debian: { commands: ['sudo systemctl start {service}'], verify: 'systemctl is-active {service}' },
      rhel: { commands: ['sudo systemctl start {service}'], verify: 'systemctl is-active {service}' },
      windows: { commands: ['Start-Service -Name {service}'] },
      docker: { commands: ['docker start {service}'] }
    }
  },
  {
    id: 'svc.stop',
    label: 'Arrêter un service',
    category: 'Services',
    keywords: [['arreter', 5], ['arrete', 5], ['stopper', 5], ['stop', 4], ['couper', 3], ['service', 3]],
    exclude: ['redemarrer', 'relancer', 'machine'],
    slots: [SERVICE],
    examples: ['arrêter le service apache2'],
    platforms: {
      debian: { commands: ['sudo systemctl stop {service}'], verify: 'systemctl is-active {service}', danger: 'Le service devient indisponible immédiatement.' },
      rhel: { commands: ['sudo systemctl stop {service}'], danger: 'Le service devient indisponible immédiatement.' },
      windows: { commands: ['Stop-Service -Name {service}'] },
      docker: { commands: ['docker stop {service}'] }
    }
  },
  {
    id: 'svc.enable',
    label: 'Activer un service au démarrage',
    category: 'Services',
    keywords: [['activer', 4], ['demarrage', 5], ['boot', 4], ['automatique', 4], ['enable', 4], ['service', 3]],
    slots: [SERVICE],
    examples: ['activer nginx au démarrage'],
    platforms: {
      debian: { commands: ['sudo systemctl enable --now {service}'], verify: 'systemctl is-enabled {service}', undo: 'sudo systemctl disable --now {service}' },
      rhel: { commands: ['sudo systemctl enable --now {service}'], verify: 'systemctl is-enabled {service}' },
      windows: { commands: ['Set-Service -Name {service} -StartupType Automatic'], verify: 'Get-Service -Name {service} | Select-Object Name, StartType' }
    }
  },
  {
    id: 'svc.status',
    label: 'État d\'un service',
    category: 'Services',
    keywords: [['etat', 5], ['status', 5], ['tourne', 4], ['fonctionne', 4], ['marche', 3], ['service', 4], ['actif', 3]],
    slots: [SERVICE],
    examples: ['est-ce que nginx tourne', 'état du service ssh'],
    platforms: {
      debian: { commands: ['systemctl status {service} --no-pager'] },
      rhel: { commands: ['systemctl status {service} --no-pager'] },
      windows: { commands: ['Get-Service -Name {service}'] },
      docker: { commands: ['docker ps --filter name={service}'] }
    }
  },
  {
    id: 'svc.logs',
    label: 'Journal d\'un service',
    category: 'Journaux',
    keywords: [['journal', 5], ['logs', 5], ['log', 4], ['erreurs', 3], ['sortie', 2], ['service', 3]],
    slots: [SERVICE],
    examples: ['voir les logs de nginx', 'journal du service ssh'],
    platforms: {
      debian: { commands: ['sudo journalctl -u {service} -n 100 --no-pager'], note: 'Ajoutez -f pour suivre le flux en direct.' },
      rhel: { commands: ['sudo journalctl -u {service} -n 100 --no-pager'] },
      windows: { commands: ['Get-WinEvent -LogName System -MaxEvents 100 | Where-Object Message -like "*{service}*"'] },
      docker: { commands: ['docker logs --tail 100 {service}'], note: 'docker logs -f suit la sortie en direct.' }
    }
  },

  /* ============================================================== Processus */
  {
    id: 'proc.list',
    label: 'Lister les processus',
    category: 'Processus',
    keywords: [['processus', 5], ['process', 4], ['programmes', 3], ['tourne', 2], ['liste', 2], ['consomme', 4], ['cpu', 3], ['memoire', 3]],
    exclude: ['tuer', 'arreter'],
    slots: [],
    examples: ['lister les processus', 'qui consomme le cpu'],
    platforms: {
      debian: { commands: ['ps aux --sort=-%cpu | head -20'], note: 'top ou htop donnent la même chose en temps réel.' },
      rhel: { commands: ['ps aux --sort=-%cpu | head -20'] },
      windows: { commands: ['Get-Process | Sort-Object CPU -Descending | Select-Object -First 20'] },
      macos: { commands: ['ps aux -r | head -20'] },
      docker: { commands: ['docker stats --no-stream'] }
    }
  },
  {
    id: 'proc.kill',
    label: 'Terminer un processus',
    category: 'Processus',
    keywords: [['tuer', 5], ['tue', 5], ['kill', 5], ['terminer', 4], ['arreter', 3], ['processus', 4]],
    slots: [{ id: 'name', label: 'Nom ou PID', placeholder: 'nginx' }],
    examples: ['tuer le processus nginx'],
    platforms: {
      debian: {
        commands: ['pkill -15 {name}'],
        note: 'Le signal 15 demande une fermeture propre. Si le processus résiste, pkill -9 {name} le force.',
        danger: 'Le signal 9 ne laisse aucune chance de sauvegarder : à réserver aux processus bloqués.'
      },
      rhel: { commands: ['pkill -15 {name}'] },
      windows: { commands: ['Stop-Process -Name {name}'], danger: 'Ajouter -Force termine sans demander la fermeture propre.' },
      macos: { commands: ['pkill -15 {name}'] },
      docker: { commands: ['docker kill {name}'] }
    }
  },

  /* ================================================================= Disque */
  {
    id: 'disk.free',
    label: 'Espace disque disponible',
    category: 'Disque',
    keywords: [['espace', 5], ['disque', 5], ['plein', 4], ['libre', 4], ['place', 4], ['stockage', 4], ['reste', 3]],
    exclude: ['dossier', 'repertoire'],
    slots: [],
    examples: ['combien d\'espace disque reste', 'le disque est-il plein'],
    platforms: {
      debian: { commands: ['df -h'], note: 'df -i montre l\'occupation des inodes : un disque peut être « plein » sans l\'être en octets.' },
      rhel: { commands: ['df -h'] },
      windows: { commands: ['Get-Volume | Select-Object DriveLetter, FileSystemLabel, SizeRemaining, Size'] },
      macos: { commands: ['df -h'] },
      docker: { commands: ['docker system df'] }
    }
  },
  {
    id: 'disk.usage',
    label: 'Taille d\'un dossier',
    category: 'Disque',
    keywords: [['taille', 5], ['poids', 4], ['dossier', 5], ['repertoire', 5], ['occupe', 4], ['pese', 4]],
    slots: [PATH],
    examples: ['taille du dossier /var/log'],
    platforms: {
      debian: { commands: ['du -sh {path}'], note: 'du -h --max-depth=1 {path} détaille les sous-dossiers.' },
      rhel: { commands: ['du -sh {path}'] },
      macos: { commands: ['du -sh {path}'] },
      windows: { commands: ['(Get-ChildItem "{path}" -Recurse | Measure-Object Length -Sum).Sum / 1GB'] }
    }
  },
  {
    id: 'disk.big-files',
    label: 'Trouver les gros fichiers',
    category: 'Disque',
    keywords: [['gros', 5], ['volumineux', 5], ['plus grands', 4], ['fichiers', 4], ['trouver', 3], ['saturent', 3]],
    slots: [PATH],
    examples: ['trouver les gros fichiers dans /var'],
    platforms: {
      debian: { commands: ['sudo find {path} -type f -size +100M -exec ls -lh {} \\; 2>/dev/null | sort -k5 -hr | head -20'] },
      rhel: { commands: ['sudo find {path} -type f -size +100M -exec ls -lh {} \\; 2>/dev/null | head -20'] },
      windows: { commands: ['Get-ChildItem "{path}" -Recurse -File | Sort-Object Length -Descending | Select-Object -First 20 FullName, Length'] }
    }
  },
  {
    id: 'disk.list',
    label: 'Lister les disques',
    category: 'Disque',
    keywords: [['disques', 5], ['partitions', 5], ['volumes', 4], ['lister', 3], ['montage', 3]],
    slots: [],
    examples: ['lister les disques et partitions'],
    platforms: {
      debian: { commands: ['lsblk -f'] },
      rhel: { commands: ['lsblk -f'] },
      windows: { commands: ['Get-Disk | Format-Table Number, FriendlyName, Size, PartitionStyle'] },
      macos: { commands: ['diskutil list'] }
    }
  },
  {
    id: 'disk.mount',
    label: 'Monter un système de fichiers',
    category: 'Disque',
    keywords: [['monter', 5], ['monte', 5], ['mount', 5], ['rattacher', 4]],
    slots: [
      { id: 'device', label: 'Périphérique', placeholder: '/dev/sdb1' },
      PATH
    ],
    examples: ['monter /dev/sdb1 sur /mnt/data'],
    platforms: {
      debian: {
        commands: ['sudo mkdir -p {path}', 'sudo mount {device} {path}'],
        verify: 'findmnt {path}',
        undo: 'sudo umount {path}',
        note: 'Pour un montage permanent, ajoutez une ligne dans /etc/fstab en utilisant l\'UUID donné par blkid.'
      },
      rhel: { commands: ['sudo mkdir -p {path}', 'sudo mount {device} {path}'], undo: 'sudo umount {path}' },
      macos: { commands: ['sudo diskutil mount {device}'] }
    }
  },

  /* ================================================================ Comptes */
  {
    id: 'user.create',
    label: 'Créer un utilisateur',
    category: 'Comptes',
    keywords: [['creer', 5], ['cree', 5], ['ajouter', 4], ['nouveau', 3], ['utilisateur', 5], ['compte', 4]],
    exclude: ['supprimer', 'groupe seul'],
    slots: [USER],
    examples: ['créer l\'utilisateur alice'],
    platforms: {
      debian: {
        commands: ['sudo useradd -m -s /bin/bash {user}', 'sudo passwd {user}'],
        verify: 'id {user}',
        undo: 'sudo userdel -r {user}',
        note: '-m crée le dossier personnel, -s fixe l\'interpréteur de connexion.'
      },
      rhel: { commands: ['sudo useradd -m {user}', 'sudo passwd {user}'], verify: 'id {user}' },
      windows: { commands: ['New-LocalUser -Name "{user}" -NoPassword'], verify: 'Get-LocalUser -Name "{user}"' },
      macos: { commands: ['sudo sysadminctl -addUser {user} -password -'] }
    }
  },
  {
    id: 'user.delete',
    label: 'Supprimer un utilisateur',
    category: 'Comptes',
    keywords: [['supprimer', 5], ['supprime', 5], ['effacer', 4], ['retirer', 4], ['utilisateur', 5], ['compte', 4]],
    exclude: ['creer', 'ajouter'],
    slots: [USER],
    examples: ['supprimer l\'utilisateur bob'],
    platforms: {
      debian: { commands: ['sudo userdel -r {user}'], danger: '-r efface aussi le dossier personnel et son contenu, sans confirmation.' },
      rhel: { commands: ['sudo userdel -r {user}'], danger: '-r efface aussi le dossier personnel.' },
      windows: { commands: ['Remove-LocalUser -Name "{user}"'], danger: 'Le profil reste sur le disque mais le compte disparaît.' }
    }
  },
  {
    id: 'user.password',
    label: 'Changer un mot de passe',
    category: 'Comptes',
    keywords: [['mot de passe', 5], ['passe', 4], ['password', 5], ['changer', 3], ['reinitialiser', 4]],
    slots: [USER],
    examples: ['changer le mot de passe de alice'],
    platforms: {
      debian: { commands: ['sudo passwd {user}'] },
      rhel: { commands: ['sudo passwd {user}'] },
      windows: { commands: ['Set-LocalUser -Name "{user}" -Password (Read-Host -AsSecureString)'] },
      cisco: { commands: ['configure terminal', 'username {user} privilege 15 secret NOUVEAU', 'end'] }
    }
  },
  {
    id: 'user.group',
    label: 'Ajouter à un groupe',
    category: 'Comptes',
    keywords: [['groupe', 5], ['sudoer', 5], ['sudo', 5], ['ajouter', 4], ['droits', 4], ['administrateur', 3]],
    slots: [USER, { id: 'group', label: 'Groupe', placeholder: 'sudo', fallback: 'sudo' }],
    examples: ['ajouter alice au groupe sudo', 'donner les droits sudo à bob'],
    platforms: {
      debian: { commands: ['sudo usermod -aG {group} {user}'], verify: 'groups {user}', note: 'L\'appartenance ne prend effet qu\'à la prochaine ouverture de session.' },
      rhel: { commands: ['sudo usermod -aG wheel {user}'], note: 'Sur RHEL, le groupe d\'administration s\'appelle wheel.' },
      windows: { commands: ['Add-LocalGroupMember -Group "Administrateurs" -Member "{user}"'] }
    }
  },
  {
    id: 'user.list',
    label: 'Lister les utilisateurs',
    category: 'Comptes',
    keywords: [['lister', 4], ['liste', 4], ['utilisateurs', 5], ['comptes', 4], ['qui', 2]],
    slots: [],
    examples: ['lister les utilisateurs'],
    platforms: {
      debian: { commands: ['getent passwd | awk -F: \'$3 >= 1000 {print $1}\''], note: 'Le seuil 1000 écarte les comptes système.' },
      rhel: { commands: ['getent passwd | awk -F: \'$3 >= 1000 {print $1}\''] },
      windows: { commands: ['Get-LocalUser | Select-Object Name, Enabled, LastLogon'] }
    }
  },

  /* ================================================================ Paquets */
  {
    id: 'pkg.install',
    label: 'Installer un paquet',
    category: 'Paquets',
    keywords: [['installer', 5], ['installe', 5], ['ajouter', 3], ['paquet', 4], ['logiciel', 3]],
    exclude: ['desinstaller', 'supprimer'],
    slots: [PACKAGE],
    examples: ['installer nginx', 'installe le paquet htop'],
    platforms: {
      debian: { commands: ['sudo apt update', 'sudo apt install -y {package}'], verify: 'dpkg -l | grep {package}' },
      rhel: { commands: ['sudo dnf install -y {package}'], verify: 'rpm -q {package}' },
      windows: { commands: ['winget install {package}'] },
      macos: { commands: ['brew install {package}'] }
    }
  },
  {
    id: 'pkg.remove',
    label: 'Désinstaller un paquet',
    category: 'Paquets',
    keywords: [['desinstaller', 5], ['supprimer', 4], ['retirer', 4], ['paquet', 4], ['purger', 4]],
    exclude: ['utilisateur', 'fichier'],
    slots: [PACKAGE],
    examples: ['désinstaller apache2'],
    platforms: {
      debian: { commands: ['sudo apt remove -y {package}'], note: 'apt purge supprime aussi les fichiers de configuration.' },
      rhel: { commands: ['sudo dnf remove -y {package}'] },
      windows: { commands: ['winget uninstall {package}'] },
      macos: { commands: ['brew uninstall {package}'] }
    }
  },
  {
    id: 'pkg.update',
    label: 'Mettre à jour le système',
    category: 'Paquets',
    keywords: [['mettre a jour', 5], ['mise a jour', 5], ['maj', 4], ['update', 4], ['upgrade', 4], ['systeme', 2]],
    slots: [],
    examples: ['mettre à jour le système'],
    platforms: {
      debian: { commands: ['sudo apt update', 'sudo apt upgrade -y'], note: 'apt full-upgrade accepte de retirer des paquets si une dépendance l\'exige.' },
      rhel: { commands: ['sudo dnf upgrade -y'] },
      windows: { commands: ['winget upgrade --all'] },
      macos: { commands: ['brew update && brew upgrade'] }
    }
  },

  /* =============================================================== Fichiers */
  {
    id: 'file.perms',
    label: 'Changer les droits',
    category: 'Fichiers',
    keywords: [['droits', 5], ['permissions', 5], ['chmod', 5], ['acces', 3], ['lecture', 2], ['ecriture', 2]],
    slots: [PATH, { id: 'mode', label: 'Droits', placeholder: '755', fallback: '755' }],
    examples: ['mettre les droits 755 sur /var/www'],
    platforms: {
      debian: { commands: ['sudo chmod -R {mode} {path}'], verify: 'ls -ld {path}', danger: '-R applique à toute l\'arborescence : vérifiez le chemin avant de valider.' },
      rhel: { commands: ['sudo chmod -R {mode} {path}'] },
      macos: { commands: ['sudo chmod -R {mode} {path}'] },
      windows: { commands: ['icacls "{path}" /grant Users:(OI)(CI)F'] }
    }
  },
  {
    id: 'file.owner',
    label: 'Changer le propriétaire',
    category: 'Fichiers',
    keywords: [['proprietaire', 5], ['chown', 5], ['appartient', 4], ['possede', 3]],
    slots: [PATH, USER],
    examples: ['changer le propriétaire de /var/www en www-data'],
    platforms: {
      debian: { commands: ['sudo chown -R {user}:{user} {path}'], verify: 'ls -ld {path}' },
      rhel: { commands: ['sudo chown -R {user}:{user} {path}'] },
      macos: { commands: ['sudo chown -R {user} {path}'] }
    }
  },
  {
    id: 'file.find',
    label: 'Chercher un fichier',
    category: 'Fichiers',
    keywords: [['chercher', 5], ['trouver', 5], ['localiser', 4], ['fichier', 4], ['ou est', 4]],
    exclude: ['gros', 'volumineux'],
    slots: [{ id: 'name', label: 'Nom recherché', placeholder: 'nginx.conf' }, { id: 'path', label: 'Chemin', placeholder: '/var', fallback: '/' }],
    examples: ['trouver le fichier nginx.conf'],
    platforms: {
      debian: { commands: ['sudo find {path} -type f -name "{name}" 2>/dev/null'], note: 'locate {name} répond instantanément si la base mlocate est à jour.' },
      rhel: { commands: ['sudo find {path} -type f -name "{name}" 2>/dev/null'] },
      macos: { commands: ['find {path} -type f -name "{name}"'] },
      windows: { commands: ['Get-ChildItem "{path}" -Recurse -Filter "{name}" -ErrorAction SilentlyContinue'] }
    }
  },
  {
    id: 'file.archive',
    label: 'Archiver un dossier',
    category: 'Fichiers',
    keywords: [['archiver', 6], ['archive', 6], ['compresser', 6], ['zip', 4], ['tar', 4], ['sauvegarde', 3]],
    slots: [PATH],
    examples: ['archiver le dossier /var/www'],
    platforms: {
      debian: { commands: ['tar -czf sauvegarde.tar.gz {path}'], verify: 'tar -tzf sauvegarde.tar.gz | head', undo: 'tar -xzf sauvegarde.tar.gz' },
      rhel: { commands: ['tar -czf sauvegarde.tar.gz {path}'] },
      macos: { commands: ['tar -czf sauvegarde.tar.gz {path}'] },
      windows: { commands: ['Compress-Archive -Path "{path}" -DestinationPath sauvegarde.zip'] }
    }
  },
  {
    id: 'file.copy-remote',
    label: 'Copier vers une machine distante',
    category: 'Fichiers',
    keywords: [['copier', 5], ['transferer', 5], ['envoyer', 4], ['distant', 4], ['scp', 5], ['rsync', 5]],
    slots: [PATH, { id: 'user', label: 'Compte distant', placeholder: 'alice', fallback: 'root' }, HOST],
    examples: ['copier /var/www vers serveur.local'],
    platforms: {
      debian: { commands: ['rsync -avz {path} {user}@{host}:{path}'], note: 'rsync ne retransfère que les différences : c\'est ce qui le rend supportable sur un gros volume.' },
      rhel: { commands: ['rsync -avz {path} {user}@{host}:{path}'] },
      macos: { commands: ['rsync -avz {path} {user}@{host}:{path}'] },
      windows: { commands: ['Copy-Item "{path}" -Destination "\\\\{host}\\partage" -Recurse'] }
    }
  },

  /* =============================================================== Journaux */
  {
    id: 'log.errors',
    label: 'Voir les erreurs récentes',
    category: 'Journaux',
    keywords: [['erreurs', 5], ['erreur', 5], ['probleme', 4], ['plantage', 4], ['recentes', 3], ['journal', 3]],
    exclude: ['service'],
    slots: [],
    examples: ['voir les erreurs récentes du système'],
    platforms: {
      debian: { commands: ['sudo journalctl -p err -b --no-pager | tail -50'], note: '-p err ne garde que la priorité erreur et au-delà, -b limite au démarrage courant.' },
      rhel: { commands: ['sudo journalctl -p err -b --no-pager | tail -50'] },
      windows: { commands: ['Get-WinEvent -FilterHashtable @{LogName="System"; Level=2} -MaxEvents 50'] },
      macos: { commands: ['log show --last 1h --predicate \'eventType == logEvent AND messageType >= 16\''] },
      cisco: { commands: ['show logging | include %'] },
      mikrotik: { commands: ['/log print where topics~"error"'] }
    }
  },
  {
    id: 'log.follow',
    label: 'Suivre un fichier de journal',
    category: 'Journaux',
    keywords: [['suivre', 5], ['direct', 4], ['temps reel', 5], ['tail', 5], ['defiler', 3]],
    slots: [{ id: 'path', label: 'Fichier', placeholder: '/var/log/syslog', fallback: '/var/log/syslog' }],
    examples: ['suivre /var/log/nginx/error.log en direct'],
    platforms: {
      debian: { commands: ['sudo tail -f {path}'] },
      rhel: { commands: ['sudo tail -f {path}'] },
      macos: { commands: ['tail -f {path}'] },
      windows: { commands: ['Get-Content "{path}" -Wait -Tail 50'] }
    }
  },

  /* ================================================================ Système */
  {
    id: 'sys.reboot',
    label: 'Redémarrer la machine',
    category: 'Système',
    keywords: [['redemarrer', 4], ['reboot', 5], ['machine', 4], ['serveur', 3], ['systeme', 3]],
    exclude: ['service', 'nginx', 'apache'],
    slots: [],
    examples: ['redémarrer le serveur'],
    platforms: {
      debian: { commands: ['sudo systemctl reboot'], danger: 'Coupe toutes les sessions et tous les services en cours.' },
      rhel: { commands: ['sudo systemctl reboot'], danger: 'Coupe toutes les sessions et tous les services en cours.' },
      windows: { commands: ['Restart-Computer -Force'], danger: '-Force ignore les applications qui refusent de se fermer.' },
      macos: { commands: ['sudo shutdown -r now'], danger: 'Redémarrage immédiat.' },
      cisco: { commands: ['reload'], danger: 'Enregistrez la configuration avant : ce qui n\'est pas écrit est perdu.' },
      mikrotik: { commands: ['/system reboot'] }
    }
  },
  {
    id: 'sys.uptime',
    label: 'Depuis quand la machine tourne',
    category: 'Système',
    keywords: [['uptime', 5], ['depuis quand', 5], ['demarre', 3], ['allume', 3], ['charge', 3]],
    slots: [],
    examples: ['depuis quand la machine tourne'],
    platforms: {
      debian: { commands: ['uptime -p && who -b'] },
      rhel: { commands: ['uptime -p && who -b'] },
      windows: { commands: ['(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime'] },
      macos: { commands: ['uptime'] },
      cisco: { commands: ['show version | include uptime'] },
      mikrotik: { commands: ['/system resource print'] }
    }
  },
  {
    id: 'sys.version',
    label: 'Version du système',
    category: 'Système',
    keywords: [['version', 5], ['quelle distribution', 5], ['os', 3], ['systeme', 3], ['noyau', 4], ['kernel', 4]],
    slots: [],
    examples: ['quelle version du système', 'version du noyau'],
    platforms: {
      debian: { commands: ['cat /etc/os-release && uname -r'] },
      rhel: { commands: ['cat /etc/os-release && uname -r'] },
      windows: { commands: ['Get-ComputerInfo | Select-Object OsName, OsVersion, OsBuildNumber'] },
      macos: { commands: ['sw_vers'] },
      cisco: { commands: ['show version'] },
      mikrotik: { commands: ['/system resource print'] },
      junos: { commands: ['show version'] },
      docker: { commands: ['docker version'] }
    }
  },
  {
    id: 'sys.hardware',
    label: 'Matériel de la machine',
    category: 'Système',
    keywords: [['materiel', 5], ['hardware', 5], ['processeur', 4], ['ram', 4], ['memoire', 3], ['combien de', 3], ['coeurs', 4]],
    slots: [],
    examples: ['combien de cœurs et de ram'],
    platforms: {
      debian: { commands: ['lscpu | head -20 && free -h'] },
      rhel: { commands: ['lscpu | head -20 && free -h'] },
      windows: { commands: ['Get-CimInstance Win32_ComputerSystem | Select-Object NumberOfLogicalProcessors, TotalPhysicalMemory'] },
      macos: { commands: ['system_profiler SPHardwareDataType'] }
    }
  },

  /* ====================================================== SSH & certificats */
  {
    id: 'ssh.keygen',
    label: 'Générer une clé SSH',
    category: 'SSH & certificats',
    keywords: [['generer', 5], ['cle', 5], ['ssh', 5], ['keygen', 5], ['paire', 3]],
    exclude: ['certificat', 'csr'],
    slots: [],
    examples: ['générer une clé ssh'],
    platforms: {
      debian: { commands: ['ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)"'], note: 'ed25519 est plus court et plus rapide que RSA, pour une sécurité équivalente ou meilleure.' },
      rhel: { commands: ['ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)"'] },
      macos: { commands: ['ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)"'] },
      windows: { commands: ['ssh-keygen -t ed25519'] }
    }
  },
  {
    id: 'ssh.copy-id',
    label: 'Installer sa clé sur un serveur',
    category: 'SSH & certificats',
    keywords: [['copier', 4], ['installer', 3], ['cle', 5], ['ssh', 4], ['sans mot de passe', 4], ['copy-id', 5]],
    slots: [USER, HOST],
    examples: ['copier ma clé ssh vers alice@serveur.local'],
    platforms: {
      debian: { commands: ['ssh-copy-id {user}@{host}'], verify: 'ssh {user}@{host} "echo connexion sans mot de passe"' },
      rhel: { commands: ['ssh-copy-id {user}@{host}'] },
      macos: { commands: ['ssh-copy-id {user}@{host}'] },
      windows: { commands: ['type $env:USERPROFILE\\.ssh\\id_ed25519.pub | ssh {user}@{host} "cat >> .ssh/authorized_keys"'] }
    }
  },
  {
    id: 'cert.expiry',
    label: 'Vérifier l\'expiration d\'un certificat',
    category: 'SSH & certificats',
    keywords: [['certificat', 5], ['expiration', 5], ['expire', 5], ['ssl', 4], ['tls', 4], ['validite', 4]],
    slots: [HOST],
    examples: ['quand expire le certificat de exemple.fr'],
    platforms: {
      debian: { commands: ['echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null | openssl x509 -noout -dates -subject -issuer'] },
      rhel: { commands: ['echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null | openssl x509 -noout -dates'] },
      macos: { commands: ['echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null | openssl x509 -noout -dates'] },
      windows: { commands: ['(Invoke-WebRequest "https://{host}" -UseBasicParsing).BaseResponse'] }
    }
  },

  /* ============================================================= Conteneurs */
  {
    id: 'docker.ps',
    label: 'Lister les conteneurs',
    category: 'Conteneurs',
    keywords: [['conteneurs', 5], ['containers', 5], ['docker', 5], ['lister', 3], ['tournent', 3]],
    slots: [],
    examples: ['lister les conteneurs docker'],
    platforms: {
      docker: { commands: ['docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"'] },
      debian: { commands: ['docker ps -a'] }
    }
  },
  {
    id: 'docker.exec',
    label: 'Entrer dans un conteneur',
    category: 'Conteneurs',
    keywords: [['entrer', 5], ['shell', 4], ['bash', 4], ['conteneur', 5], ['exec', 5], ['dedans', 3]],
    slots: [CONTAINER],
    examples: ['entrer dans le conteneur web'],
    platforms: {
      docker: { commands: ['docker exec -it {container} sh'], note: 'Si l\'image contient bash, remplacez sh par bash.' },
      debian: { commands: ['docker exec -it {container} sh'] }
    }
  }
]

export const CATEGORIES = [...new Set(INTENTS.map(intent => intent.category))]
