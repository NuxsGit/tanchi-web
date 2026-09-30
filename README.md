# Tanchi Web

Console d'administration système auto-hébergée : supervision d'hôtes, hub d'applications et modélisation de politiques réseau, dans une seule interface.

**Stack technique :** Nuxt 4 · Nuxt UI 4 · TypeScript · SQLite

---

## 🚀 Démarrage rapide

### Prérequis

Assurez-vous de disposer des éléments suivants sur votre machine :
- **Node.js** (v18+ recommandé)
- **npm** (ou `pnpm` / `bun`)
- **git**
- **sqlite3** (optionnel, pour l'inspection en CLI)

---

### 🛠️ Guide d'initialisation pas à pas

#### 1. Cloner le projet et installer les dépendances

```bash
git clone https://github.com/votre-orga/tanchi-web.git
cd tanchi-web
npm install
```

#### 2. Configurer l'environnement

Créez le fichier de configuration locale à partir de l'exemple :

```bash
cp .env.example .env
```

*Note : vous pouvez y définir le chemin de la base de données via `TANCHI_DB` si vous souhaitez utiliser un emplacement personnalisé.*

#### 3. Initialiser la base de données & Lancer le serveur

La base de données SQLite s'initialise et génère ses tables automatiquement au premier lancement de l'application.

Démarrez l'application en mode développement :

```bash
npm run dev
ou
set TANCHI_DB=./data/tanchi.db && npm run dev
```

> 💡 **Initialisation de la DB :** Au démarrage, Tanchi créera automatiquement le dossier `data/` ainsi que le fichier `data/tanchi.db` s'ils n'existent pas encore. Les logs de la console afficheront le chemin exact du fichier initialisé.

L'application est accessible sur `http://localhost:3000`.

#### 4. Créer le compte administrateur

1. Ouvrez votre navigateur sur `http://localhost:3000/register`.
2. Remplissez le formulaire d'inscription.
3. **Le premier compte créé sur l'instance devient automatiquement le propriétaire (*owner*).**

---

## ⚙️ Variables d'environnement

| Variable | Valeur par défaut | Description |
|---|---|---|
| `TANCHI_DB` | `./data/tanchi.db` | Emplacement du fichier SQLite principal |
| `TANCHI_SECURE_COOKIES` | `auto` | Active le flag `Secure` sur les cookies. À passer à `true` derrière un reverse proxy TLS |

---

## 💾 Base de données & Administration

Toutes les données (comptes, sessions, clés API, matrices FlowMatrix) résident dans **un seul fichier SQLite** (`data/tanchi.db`).

L'application s'exécutes en mode **WAL** (*Write-Ahead Logging*). Les fichiers `tanchi.db-wal` et `tanchi.db-shm` sont créés temporairement à côté de la base pendant que le serveur tourne.

### Sauvegarder la base

- **Depuis l'interface :** **Paramètres** → **Données** → **Télécharger une sauvegarde**
- **Via la CLI :**

```bash
sqlite3 data/tanchi.db "VACUUM INTO 'sauvegarde.db'"
```

> `VACUUM INTO` produit un snapshot propre et cohérent, même si le serveur est en train de tourner.

### Déplacer la base de données

Si vous changez le chemin de la base via la variable `TANCHI_DB`, **arrêtez le serveur au préalable** pour vous assurer que le journal WAL est fusionné dans le fichier `.db` :

```bash
TANCHI_DB=/srv/tanchi/tanchi.db npm run dev
```

### Inspecter la base en ligne de commande

```bash
sqlite3 data/tanchi.db ".tables"
sqlite3 data/tanchi.db "SELECT id, username, email, role FROM users;"
```

**Tables gérées :** `users`, `sessions`, `api_keys`, `fmd_workspaces`.

---

## 🧩 Modules

### FlowMatrix Designer (`/apps/fmd`)
Module de modélisation réseau intégré :
- Matrices de flux et détection automatique de conflits
- Visualisation par graphe nodal
- Importation et exportation au format JSON et CSV
- Génération de configurations **Juniper SRX**
- Sauvegarde des matrices par compte en base locale

*Portage Vue du projet [NuxsGit/Tanchi-FlowMatrix-Designer](https://github.com/NuxsGit/Tanchi-FlowMatrix-Designer) (sous licence GPLv3).*

### Hub d'applications
Emplacements réservés pour les modules futurs : **Flow**, **Matrix**, **CRM**, **Shield** et **Storage**.

---

## 🎨 Thèmes & Apparence

L'interface propose 4 thèmes avec rendu côté serveur (SSR) sans saut de couleur au chargement :

| Famille | Mode Sombre | Mode Clair |
|---|---|---|
| **Tanchi** | Vert & Noir | Blanc & Vert |
| **Nothing** | Rouge & Noir | Jaune & Blanc |

Le choix est conservé dans un cookie et peut être modifié depuis la page d'accueil ou via **Paramètres** → **Apparence**.
