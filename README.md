# Tanchi Web

Console d'administration système auto-hébergée : supervision d'hôtes, hub
d'applications et modélisation de politiques réseau, dans une seule interface.

Nuxt 4 · Nuxt UI 4 · TypeScript · SQLite

## Démarrer

```bash
npm install
npm run dev
```

Le premier compte créé sur `/register` devient propriétaire de l'instance.

## Base de données locale

Toutes les données (comptes, sessions, clés API, matrices FlowMatrix) vivent
dans **un seul fichier SQLite** :

```
data/tanchi.db
```

Créé automatiquement au premier démarrage, avec `data/tanchi.db-wal` et
`data/tanchi.db-shm` tant que le serveur tourne (mode WAL). Le chemin exact est
affiché dans les logs au démarrage et dans **Paramètres → Données**.

### Déplacer la base

Le chemin est piloté par `TANCHI_DB` :

```bash
TANCHI_DB=/srv/tanchi/tanchi.db npm run dev
```

Arrêtez le serveur avant de déplacer le fichier, pour que le journal WAL soit
fusionné dans le `.db`. Sinon, déplacez aussi les fichiers `-wal` et `-shm`.

### Sauvegarder

Depuis **Paramètres → Données → Télécharger une sauvegarde**, ou en ligne de
commande :

```bash
sqlite3 data/tanchi.db "VACUUM INTO 'sauvegarde.db'"
```

`VACUUM INTO` produit un snapshot cohérent même serveur allumé, contrairement à
une simple copie du `.db`.

### Inspecter

```bash
sqlite3 data/tanchi.db ".tables"
sqlite3 data/tanchi.db "SELECT id, username, email, role FROM users;"
```

Tables : `users`, `sessions`, `api_keys`, `fmd_workspaces`.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `TANCHI_DB` | `./data/tanchi.db` | Emplacement du fichier SQLite |
| `TANCHI_SECURE_COOKIES` | auto | Force l'attribut `Secure` des cookies de session. Auto = actif seulement en HTTPS ; mettez `true` derrière un reverse proxy TLS |

## Modules

**FlowMatrix Designer** (`/apps/fmd`) est le module intégré : matrices de flux,
détection de conflits, graphe nodal, import/export JSON et CSV, génération de
configuration Juniper SRX. Portage Vue du projet
[NuxsGit/Tanchi-FlowMatrix-Designer](https://github.com/NuxsGit/Tanchi-FlowMatrix-Designer)
(GPLv3). Les matrices sont enregistrées par compte dans la base locale.

Les autres cartes du hub (Flow, Matrix, CRM, Shield, Storage) sont des
emplacements réservés.

## Thèmes

Quatre palettes, croisement de deux familles et d'un mode clair/sombre :

| Famille | Sombre | Clair |
|---|---|---|
| Tanchi | Vert & Noir | Blanc & Vert |
| Nothing | Rouge & Noir | Jaune & Blanc |

Le choix est mémorisé en cookie et rendu côté serveur : pas de flash au
chargement. Réglable depuis la page d'accueil ou **Paramètres → Apparence**.
