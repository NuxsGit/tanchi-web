/**
 * Contenu pédagogique de TanchiLearn.
 *
 * Chaque cours est un dossier de la pile ; chaque chapitre une fiche que l'on
 * fait défiler. Le contenu décrit l'application telle qu'elle est réellement
 * livrée : les raccourcis, libellés et écrans cités existent tous.
 */

export type LearnBlock =
  | { kind: 'text', text: string }
  | { kind: 'steps', title?: string, items: string[] }
  | { kind: 'keys', items: { keys: string[], label: string }[] }
  | { kind: 'note', tone: 'info' | 'tip' | 'warning', text: string }
  | { kind: 'code', caption?: string, code: string }
  | { kind: 'quiz', question: string, options: string[], answer: number, explain: string }

export interface LearnChapter {
  id: string
  title: string
  /** Durée de lecture indicative, en minutes. */
  minutes: number
  blocks: LearnBlock[]
}

export interface LearnCourse {
  id: string
  title: string
  subtitle: string
  icon: string
  /** Teinte du dossier, en degrés sur la roue chromatique. */
  hue: number
  level: 'Découverte' | 'Intermédiaire' | 'Avancé'
  /** Application concernée, pour proposer « Ouvrir l'app ». */
  to?: string
  chapters: LearnChapter[]
}

export const LEARN_COURSES: LearnCourse[] = [
  /* ------------------------------------------------------------ Découverte */
  {
    id: 'decouverte',
    title: 'Prendre en main Tanchi',
    subtitle: 'Le hub, la barre latérale et les thèmes',
    icon: 'i-lucide-compass',
    hue: 210,
    level: 'Découverte',
    to: '/apps',
    chapters: [
      {
        id: 'hub',
        title: 'Le hub applicatif',
        minutes: 2,
        blocks: [
          {
            kind: 'text',
            text: 'Tanchi Web n\'est pas une application unique mais une suite. Le hub, à l\'adresse /apps, est la porte d\'entrée : chaque tuile y décrit un module, son rôle et son état.'
          },
          {
            kind: 'steps',
            title: 'Depuis le hub',
            items: [
              'Cliquez une tuile pour ouvrir le module correspondant.',
              'Un module marqué « bientôt » n\'est pas encore livré : sa tuile reste visible mais inerte.',
              'L\'icône en forme de punaise épingle le module dans la barre latérale.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Le hub est l\'endroit à retenir. Tout le reste s\'atteint depuis là, même si vous n\'épinglez rien.'
          }
        ]
      },
      {
        id: 'navbar',
        title: 'Épingler ses applications',
        minutes: 2,
        blocks: [
          {
            kind: 'text',
            text: 'La barre latérale se range en trois sections : Pilotage, Applications, Système. La section Applications ne contient que ce que vous y mettez — c\'est volontaire, une barre chargée par défaut devient illisible au bout d\'une semaine.'
          },
          {
            kind: 'steps',
            items: [
              'Ouvrez le hub.',
              'Épinglez les modules que vous utilisez chaque jour.',
              'Huit épingles au maximum : au-delà, la barre cesse d\'être un raccourci.'
            ]
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'Le choix est enregistré sur votre compte, pas dans le navigateur. Il vous suit d\'un poste à l\'autre.'
          }
        ]
      },
      {
        id: 'themes',
        title: 'Thèmes et confort visuel',
        minutes: 2,
        blocks: [
          {
            kind: 'text',
            text: 'Quatre thèmes sont proposés, en deux familles. La famille Tanchi joue le vert sur noir ou le vert sur blanc ; la famille Nothing reprend le jaune sur blanc de Nothing OS et le rouge sur noir des premières versions.'
          },
          {
            kind: 'steps',
            items: [
              'Paramètres, onglet Apparence.',
              'Choisissez la famille, puis clair ou sombre.',
              'Le thème est écrit dans un cookie et rendu dès le serveur.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Le rendu se fait avant le premier affichage : pas de flash blanc au chargement, même en thème sombre.'
          },
          {
            kind: 'quiz',
            question: 'Combien d\'applications peut-on épingler dans la barre latérale ?',
            options: ['Quatre', 'Huit', 'Autant qu\'on veut'],
            answer: 1,
            explain: 'La limite est fixée à huit, pour que la barre reste un raccourci et non un second hub.'
          }
        ]
      }
    ]
  },

  /* ----------------------------------------------------------- Topology */
  {
    id: 'topology',
    title: 'TopologyBoard',
    subtitle: 'Schémas d\'infrastructure et câblage',
    icon: 'i-lucide-network',
    hue: 145,
    level: 'Intermédiaire',
    to: '/apps/topology',
    chapters: [
      {
        id: 'poser',
        title: 'Poser ses premiers équipements',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Le dock de droite contient cent quarante-quatre composants, rangés par catégorie : commutateurs, routeurs, pare-feu, serveurs, stockage, alimentation, sans-fil, sécurité physique. La recherche du dock trie par utilité, pas par ordre alphabétique — les objets les plus posés remontent.'
          },
          {
            kind: 'steps',
            items: [
              'Cherchez un composant dans le dock, ou parcourez sa catégorie.',
              'Glissez-le sur le plan.',
              'Sélectionnez-le : l\'inspecteur de gauche s\'ouvre.',
              'Renseignez ce qui compte — nombre de ports d\'un commutateur, processeur d\'un serveur, puissance d\'un onduleur.'
            ]
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'Quatorze préréglages processeur sont fournis, du Xeon Silver au Threadripper PRO. Ils remplissent cœurs, fréquence et enveloppe thermique d\'un coup.'
          },
          {
            kind: 'keys',
            items: [
              { keys: ['P'], label: 'Replier ou rouvrir le dock' },
              { keys: ['F'], label: 'Recadrer sur le contenu' },
              { keys: ['Z'], label: 'Plein écran' }
            ]
          }
        ]
      },
      {
        id: 'cabler',
        title: 'Câbler pour de vrai',
        minutes: 4,
        blocks: [
          {
            kind: 'text',
            text: 'Chaque objet expose des points de connexion distincts : les ports de données sur le flanc droit, l\'alimentation et la console en bas. On ne relie pas un plan, on relie deux ports.'
          },
          {
            kind: 'steps',
            title: 'Tirer un câble',
            items: [
              'Approchez le curseur d\'un objet : ses points de connexion apparaissent.',
              'Cliquez un point et maintenez.',
              'Lâchez sur le point d\'arrivée.',
              'Le câble est choisi tout seul : cordon secteur entre deux points d\'alimentation, cuivre ou fibre entre deux ports de données.'
            ]
          },
          {
            kind: 'text',
            text: 'Le choix du média tient compte du débit des deux extrémités et de la longueur déclarée. Un lien de sept mètres à 25 Gb/s devient un DAC ; le même à quinze mètres passe en AOC, parce qu\'un DAC ne tient pas cette distance.'
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'Un serveur sans cordon secteur est signalé même si vous n\'avez posé aucun point d\'alimentation : tout équipement qui consomme se voit attribuer une entrée secteur implicite.'
          },
          {
            kind: 'keys',
            items: [
              { keys: ['L'], label: 'Relier depuis la sélection' },
              { keys: ['Clic'], label: 'Sélectionner un câble' },
              { keys: ['Suppr'], label: 'Supprimer la sélection' }
            ]
          }
        ]
      },
      {
        id: 'pipeline',
        title: 'La pipeline de diagnostic',
        minutes: 4,
        blocks: [
          {
            kind: 'text',
            text: 'Trente règles indépendantes relisent le plan en continu, réparties en cinq familles : câblage, alimentation, réseau, sécurité, capacité. Chacune renvoie un constat, sa gravité et le correctif proposé.'
          },
          {
            kind: 'steps',
            title: 'Ce que la pipeline repère',
            items: [
              'Un port ouvert sans usage, ou un service exposé sans raison.',
              'Un média incompatible avec la distance ou le débit demandé.',
              'Une double alimentation manquante sur un équipement critique.',
              'Une boucle de niveau 2 — en distinguant la vraie boucle d\'un tissu leaf-spine, qui n\'en est pas une.',
              'Un commutateur dont les ports sont saturés.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Appuyez sur E pour dérouler les diagnostics. Chaque constat pointe les objets concernés : cliquez-le, le plan se recentre dessus.'
          }
        ]
      },
      {
        id: 'generer',
        title: 'Générer et régler un schéma',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Deux boutons font l\'essentiel du travail ingrat. « Générer un modèle » propose huit architectures prêtes — de la petite agence au tissu leaf-spine — entièrement câblées sur de vrais ports. « Régler le schéma » relit le plan, corrige ce qui peut l\'être et vous liste chaque changement avant de valider.'
          },
          {
            kind: 'steps',
            title: 'Régler le schéma',
            items: [
              'Appuyez sur R.',
              'Lisez la liste des corrections proposées : chacune indique la règle d\'origine.',
              'Choisissez « Créer un plan corrigé » pour garder l\'original intact, ou « Appliquer sur ce plan ».'
            ]
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'Certaines anomalies restent volontairement non corrigées : ce sont les choix d\'architecture. Un tissu mal dimensionné se répare sur le papier, pas par un bouton.'
          },
          {
            kind: 'quiz',
            question: 'Un lien 25 Gb/s de quinze mètres : quel média la pipeline retient-elle ?',
            options: ['Un DAC cuivre', 'Un AOC', 'De la paire torsadée'],
            answer: 1,
            explain: 'Le DAC plafonne autour de sept mètres. Au-delà, seul l\'AOC tient le débit sur la distance.'
          }
        ]
      },
      {
        id: 'raccourcis',
        title: 'Travailler vite',
        minutes: 2,
        blocks: [
          {
            kind: 'text',
            text: 'Le plan est infini dans les quatre directions. La molette fait défiler, Ctrl et molette zooment, le clic du milieu déplace la vue.'
          },
          {
            kind: 'keys',
            items: [
              { keys: ['Ctrl', 'Z'], label: 'Annuler — soixante pas d\'historique' },
              { keys: ['Ctrl', 'Y'], label: 'Rétablir' },
              { keys: ['Ctrl', 'C'], label: 'Copier la sélection' },
              { keys: ['Ctrl', 'V'], label: 'Coller' },
              { keys: ['Ctrl', 'D'], label: 'Dupliquer' },
              { keys: ['Ctrl', 'A'], label: 'Tout sélectionner' },
              { keys: ['Maj', 'clic'], label: 'Étendre la sélection' },
              { keys: ['Glisser'], label: 'Rectangle de sélection' },
              { keys: ['Ctrl', '0'], label: 'Réinitialiser la vue' },
              { keys: ['?'], label: 'Afficher toute l\'aide' }
            ]
          }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------------- FMD */
  {
    id: 'fmd',
    title: 'FlowMatrix Designer',
    subtitle: 'Matrices de flux et politiques réseau',
    icon: 'i-lucide-git-fork',
    hue: 265,
    level: 'Intermédiaire',
    to: '/apps/fmd',
    chapters: [
      {
        id: 'matrice',
        title: 'Construire une matrice',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Une matrice de flux répond à une question simple, posée autant de fois qu\'il y a de lignes : qui parle à qui, sur quel service, et est-ce autorisé ? Les sections regroupent les flux par domaine — production, sauvegarde, supervision — pour que la matrice reste lisible à trois cents lignes.'
          },
          {
            kind: 'steps',
            items: [
              'Créez une section et nommez-la d\'après son domaine.',
              'Ajoutez un flux : source, destination, application, action.',
              'L\'action vaut ALLOW ou DENY.',
              'Le statut suit la validation : en attente, approuvé ou rejeté.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Les objets adresses et services se déclarent une fois et se réutilisent. Renommer un objet met à jour tous les flux qui s\'y réfèrent.'
          }
        ]
      },
      {
        id: 'conflits',
        title: 'Repérer les conflits',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Deux flux qui portent le même triplet source, destination, application mais des actions opposées se contredisent. Sur un pare-feu, seul le premier s\'applique et le second ne servira jamais — sans que rien ne le signale.'
          },
          {
            kind: 'steps',
            items: [
              'FlowMatrix calcule une clé par flux à partir de ce triplet.',
              'Toute clé apparaissant deux fois avec des actions divergentes est marquée.',
              'Les lignes concernées se surlignent : tranchez avant d\'exporter.'
            ]
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'Un conflit non tranché produit une configuration qui se charge sans erreur et ne fait pas ce que vous croyez. C\'est le pire des deux mondes.'
          }
        ]
      },
      {
        id: 'export',
        title: 'Exporter et partager',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'La matrice se traduit en configuration Juniper SRX : chaque flux devient une politique nommée, avec son application. L\'export CSV sert aux revues et aux audits.'
          },
          {
            kind: 'code',
            caption: 'Extrait de configuration générée',
            code: 'set applications application app-tcp-443 protocol tcp\nset applications application app-tcp-443 destination-port 443\nset security policies from-zone trust to-zone dmz policy p001-web match application app-tcp-443\nset security policies from-zone trust to-zone dmz policy p001-web then permit'
          },
          {
            kind: 'text',
            text: 'Une matrice s\'ouvre en brouillon personnel ou en portée équipe. En portée équipe, tous les membres travaillent sur le même document ; le numéro de révision empêche d\'écraser le travail d\'un coéquipier en silence.'
          },
          {
            kind: 'quiz',
            question: 'Deux membres enregistrent la même matrice en même temps. Que se passe-t-il ?',
            options: [
              'Le dernier écrase le premier',
              'Le second est prévenu du conflit et choisit quoi garder',
              'L\'enregistrement est refusé aux deux'
            ],
            answer: 1,
            explain: 'Chaque écriture annonce la révision qu\'elle croit modifier. Si elle a bougé, le serveur refuse et renvoie sa version pour que vous arbitriez.'
          }
        ]
      }
    ]
  },

  /* ------------------------------------------------------------- SubNet */
  {
    id: 'subnet',
    title: 'SubNet',
    subtitle: 'Calcul et dimensionnement CIDR',
    icon: 'i-lucide-calculator',
    hue: 30,
    level: 'Découverte',
    to: '/apps/subnet',
    chapters: [
      {
        id: 'lire',
        title: 'Lire un bloc CIDR',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Le suffixe d\'un CIDR compte les bits figés du réseau. Les bits restants numérotent les machines : un /24 laisse huit bits libres, soit 256 adresses, dont 254 attribuables une fois retirées l\'adresse de réseau et celle de diffusion.'
          },
          {
            kind: 'steps',
            title: 'Onglet Calculateur',
            items: [
              'Saisissez le bloc, par exemple 192.168.10.0/24.',
              'Vous obtenez masque, masque inverse, diffusion, première et dernière adresse.',
              'Le compte d\'adresses attribuables est distinct du compte total : c\'est celui qui compte pour dimensionner.'
            ]
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'Un /31 fait exception : deux adresses, toutes deux utilisables. C\'est prévu pour les liaisons point à point, et l\'outil le traite comme tel.'
          }
        ]
      },
      {
        id: 'dimensionner',
        title: 'Dimensionner un réseau',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'La question se pose presque toujours dans l\'autre sens : j\'ai tant de machines, quel préfixe me faut-il ? L\'onglet Dimensionnement répond directement.'
          },
          {
            kind: 'steps',
            items: [
              'Indiquez le nombre de machines à héberger.',
              'L\'outil renvoie le plus petit préfixe qui les contient.',
              'Prévoyez de la marge : un réseau plein se redécoupe rarement à chaud.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Cinquante machines demandent un /26, qui en accepte 62. Un /27 n\'en tient que 30 : la marche est brutale, chaque bit double la taille.'
          }
        ]
      },
      {
        id: 'vlsm',
        title: 'Découper en VLSM',
        minutes: 4,
        blocks: [
          {
            kind: 'text',
            text: 'Le VLSM découpe un bloc en sous-réseaux de tailles différentes, chacun ajusté à son besoin. C\'est ce qui évite de gaspiller un /24 pour une liaison à deux adresses.'
          },
          {
            kind: 'steps',
            title: 'Onglet Plan d\'adressage',
            items: [
              'Déclarez le bloc parent.',
              'Listez vos besoins : un nom et un nombre de machines par sous-réseau.',
              'L\'allocation se fait du plus grand au plus petit — l\'ordre inverse fragmente le bloc et fait échouer les grandes demandes.',
              'Le plan obtenu se copie tel quel dans votre documentation.'
            ]
          },
          {
            kind: 'note',
            tone: 'info',
            text: 'L\'onglet Découpage fait le travail complémentaire : couper un bloc en sous-réseaux égaux d\'un préfixe donné.'
          },
          {
            kind: 'quiz',
            question: 'Combien d\'adresses attribuables dans un /26 ?',
            options: ['64', '62', '30'],
            answer: 1,
            explain: 'Un /26 contient 64 adresses ; l\'adresse de réseau et celle de diffusion ne s\'attribuent pas, il en reste 62.'
          }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------- ConfigLab */
  {
    id: 'configlab',
    title: 'ConfigLab',
    subtitle: 'Cron, regex et serveurs web',
    icon: 'i-lucide-flask-conical',
    hue: 190,
    level: 'Intermédiaire',
    to: '/apps/configlab',
    chapters: [
      {
        id: 'cron',
        title: 'Écrire un cron sans se tromper',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Cinq champs, dans cet ordre : minute, heure, jour du mois, mois, jour de la semaine. ConfigLab les explique un par un et affiche les cinq prochaines exécutions — la seule vérification qui ne ment pas.'
          },
          {
            kind: 'code',
            caption: 'Toutes les cinq minutes, de 9 h à 17 h, en semaine',
            code: '*/5 9-17 * * 1-5'
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'Piège classique : quand le jour du mois et le jour de la semaine sont tous deux renseignés, cron déclenche si l\'un OU l\'autre correspond, pas les deux. « 0 0 13 * 5 » s\'exécute chaque vendredi ET chaque 13 du mois.'
          },
          {
            kind: 'text',
            text: 'Les macros @daily, @weekly, @monthly, @hourly et @reboot sont acceptées. L\'outil affiche leur équivalent en cinq champs.'
          }
        ]
      },
      {
        id: 'regex',
        title: 'Décoder une expression régulière',
        minutes: 4,
        blocks: [
          {
            kind: 'text',
            text: 'ConfigLab découpe le motif jeton par jeton et commente chaque fragment. Une erreur de syntaxe est traduite en français : « parenthèse ouvrante sans fermeture » vaut mieux que « Unterminated group ».'
          },
          {
            kind: 'steps',
            items: [
              'Collez le motif dans le champ.',
              'Activez les options utiles : g pour toutes les occurrences, i pour ignorer la casse, m pour le multiligne.',
              'Collez un échantillon réel dans le banc d\'essai.',
              'Les correspondances se surlignent et les groupes capturés s\'affichent, nommés compris.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Testez toujours sur une vraie ligne de journal, pas sur un exemple reconstitué de mémoire. C\'est là que se cachent les espaces multiples et les champs vides.'
          }
        ]
      },
      {
        id: 'web',
        title: 'Convertir Nginx et Apache',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'La conversion va dans les deux sens et couvre les directives réellement courantes : hôte virtuel, racine, certificats, mandataire inverse, réécritures, en-têtes, journaux, contrôle d\'accès.'
          },
          {
            kind: 'steps',
            items: [
              'Collez la configuration source.',
              'La validation signale sur-le-champ un point-virgule manquant, un bloc non refermé, une RewriteRule sans RewriteEngine On.',
              'Le résultat est validé à son tour : la structure produite est vérifiée avant que vous ne la copiiez.',
              'Toute directive sans équivalent direct est reportée en commentaire, jamais supprimée en silence.'
            ]
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'ProxyPass d\'Apache ne transmet pas les en-têtes d\'origine. Le bloc Nginx produit vous le rappelle : ajoutez proxy_set_header Host et X-Forwarded-For à la main.'
          },
          {
            kind: 'quiz',
            question: '« 0 0 13 * 5 » : quand la tâche s\'exécute-t-elle ?',
            options: [
              'Uniquement les vendredis 13',
              'Chaque vendredi et chaque 13 du mois',
              'Le treizième vendredi de l\'année'
            ],
            answer: 1,
            explain: 'Quand les deux champs de jour sont restreints, cron applique un OU. C\'est contre-intuitif et c\'est la source d\'erreur la plus fréquente.'
          }
        ]
      }
    ]
  },

  /* ----------------------------------------------------------- TaskTeam */
  {
    id: 'tasks',
    title: 'TaskTeam',
    subtitle: 'Kanban d\'équipe par projet',
    icon: 'i-lucide-square-kanban',
    hue: 340,
    level: 'Découverte',
    to: '/apps/tasks',
    chapters: [
      {
        id: 'colonnes',
        title: 'Les cinq colonnes',
        minutes: 2,
        blocks: [
          {
            kind: 'text',
            text: 'Le tableau suit cinq états, et pas un de plus. Chaque colonne a une définition précise : c\'est ce qui empêche une tâche de stagner dans un flou.'
          },
          {
            kind: 'steps',
            items: [
              'Backlog — idées et demandes non planifiées.',
              'À faire — planifié pour le cycle en cours.',
              'En cours — quelqu\'un travaille dessus, maintenant.',
              'Revue — en attente de relecture ou de validation.',
              'Terminé — livré et vérifié.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Si « En cours » compte plus d\'entrées que de personnes dans l\'équipe, le tableau ment. Rien n\'avance en parallèle.'
          }
        ]
      },
      {
        id: 'organiser',
        title: 'Projets, priorités, assignation',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Les tâches se rangent par projet au sein d\'une équipe. La priorité — basse, normale, haute, critique — sert à trancher, pas à décorer : quatre tâches critiques, c\'est zéro tâche critique.'
          },
          {
            kind: 'steps',
            items: [
              'Choisissez l\'équipe, puis le projet.',
              'Créez la tâche directement dans la colonne visée.',
              'Assignez-la à un membre : une tâche sans propriétaire n\'avance pas.',
              'Glissez la carte d\'une colonne à l\'autre ; la position est conservée pour toute l\'équipe.'
            ]
          }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------- Dashboard */
  {
    id: 'dashboard',
    title: 'Tableau de bord',
    subtitle: 'La grille de widgets 7 × 14',
    icon: 'i-lucide-layout-dashboard',
    hue: 55,
    level: 'Intermédiaire',
    to: '/dashboard',
    chapters: [
      {
        id: 'grille',
        title: 'Composer sa grille',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Le tableau de bord est vide au départ, et c\'est voulu. Sept colonnes sur quatorze rangées : à vous d\'y poser ce que vous voulez voir en ouvrant l\'onglet le matin.'
          },
          {
            kind: 'steps',
            items: [
              'Passez en mode édition.',
              'Ajoutez un widget depuis la palette.',
              'Glissez-le à sa place ; les widgets déjà posés se poussent.',
              'Redimensionnez par la poignée d\'angle.',
              'La disposition est enregistrée sur votre compte.'
            ]
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Un tableau de bord utile tient en un écran. Si vous devez faire défiler pour voir l\'essentiel, l\'essentiel est mal placé.'
          }
        ]
      }
    ]
  },

  /* ----------------------------------------------------------- Sécurité */
  {
    id: 'securite',
    title: 'Comptes et accès',
    subtitle: 'Sessions, clés API, partage',
    icon: 'i-lucide-shield-check',
    hue: 0,
    level: 'Avancé',
    to: '/settings',
    chapters: [
      {
        id: 'sessions',
        title: 'Sessions et mot de passe',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Les mots de passe ne sont jamais stockés en clair : chacun est dérivé par scrypt avec son propre sel. La session tient dans un cookie httpOnly, illisible par le JavaScript de la page — un script injecté ne peut pas la voler.'
          },
          {
            kind: 'steps',
            items: [
              'Paramètres, onglet Sécurité, pour changer de mot de passe.',
              'Le changement invalide les autres sessions ouvertes.',
              'La déconnexion détruit la session côté serveur, pas seulement le cookie.'
            ]
          }
        ]
      },
      {
        id: 'cles',
        title: 'Clés API',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Une clé API sert aux intégrations qui ne peuvent pas ouvrir de session : sauvegarde, supervision, script de déploiement. Elle est rattachée à votre compte et n\'ouvre rien de plus que vos propres accès.'
          },
          {
            kind: 'steps',
            title: 'Paramètres, onglet Clés API',
            items: [
              'Créez la clé et nommez-la d\'après son usage, pas d\'après sa date.',
              'La liste n\'affiche qu\'une version masquée.',
              '« Révéler » réaffiche le secret entier et note la date de cet accès.',
              'La révocation est immédiate et définitive.'
            ]
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'Le secret reste récupérable côté serveur — c\'est ce qui permet de le réafficher plus tard. Traitez donc une clé comme un mot de passe : une par usage, révoquée dès le moindre doute, jamais recopiée dans un dépôt ou une conversation.'
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Une clé par usage. Une clé partagée entre trois scripts ne se révoque jamais, parce que plus personne ne sait ce qu\'elle casserait.'
          }
        ]
      },
      {
        id: 'partage',
        title: 'Portée personnelle ou portée équipe',
        minutes: 3,
        blocks: [
          {
            kind: 'text',
            text: 'Une matrice de flux, un plan de topologie ou un plan d\'adressage s\'ouvre dans l\'une de deux portées. En portée personnelle, vous êtes seul à le voir : c\'est le brouillon, l\'essai, la version qu\'on n\'assume pas encore. En portée équipe, tous les membres travaillent sur le même document.'
          },
          {
            kind: 'steps',
            title: 'Choisir sa portée',
            items: [
              'Le sélecteur en haut de chaque application liste vos portées.',
              'Personnel : rien n\'est visible par les autres.',
              'Équipe : chaque membre ouvre et modifie le même document.',
              'On bascule de l\'une à l\'autre à tout moment, sans perdre son travail.'
            ]
          },
          {
            kind: 'note',
            tone: 'warning',
            text: 'En portée équipe, deux personnes peuvent enregistrer en même temps. Chaque écriture annonce la version qu\'elle croit modifier : si un coéquipier est passé avant, l\'enregistrement est refusé et sa version vous est proposée. Vous arbitrez, mais rien n\'est écrasé en silence.'
          },
          {
            kind: 'note',
            tone: 'tip',
            text: 'Commencez en portée personnelle, passez en portée équipe quand le document mérite d\'être relu. Une équipe qui voit tous les brouillons finit par n\'en lire aucun.'
          },
          {
            kind: 'quiz',
            question: 'Vous travaillez en portée personnelle. Un coéquipier voit-il votre document ?',
            options: [
              'Oui, tous les membres de l\'équipe y ont accès',
              'Non, il faut le passer en portée équipe',
              'Seulement le propriétaire de l\'instance'
            ],
            answer: 1,
            explain: 'La portée personnelle n\'est visible que de vous. Le partage est un geste explicite, jamais un effet de bord.'
          }
        ]
      }
    ]
  }
]

export function findCourse(id: string): LearnCourse | undefined {
  return LEARN_COURSES.find(course => course.id === id)
}

/** Nombre total de chapitres, toutes formations confondues. */
export const TOTAL_CHAPTERS = LEARN_COURSES.reduce(
  (sum, course) => sum + course.chapters.length,
  0
)

/** Clé de progression d'un chapitre. */
export function chapterKey(courseId: string, chapterId: string): string {
  return `${courseId}/${chapterId}`
}

export interface LearnProgress {
  /** Chapitres achevés, au format « cours/chapitre ». */
  done: string[]
  /** Réponses de quiz réussies, même format. */
  quiz: string[]
  /** Points cumulés. */
  xp: number
}

export const EMPTY_PROGRESS: LearnProgress = { done: [], quiz: [], xp: 0 }

export const XP_CHAPTER = 10
export const XP_QUIZ = 15

export interface LearnRank {
  label: string
  min: number
  icon: string
}

/** Paliers de progression — de quoi donner un cap sans infantiliser. */
export const RANKS: LearnRank[] = [
  { label: 'Nouvel arrivant', min: 0, icon: 'i-lucide-egg' },
  { label: 'Opérateur', min: 40, icon: 'i-lucide-terminal' },
  { label: 'Technicien', min: 100, icon: 'i-lucide-wrench' },
  { label: 'Administrateur', min: 180, icon: 'i-lucide-server-cog' },
  { label: 'Architecte', min: 280, icon: 'i-lucide-crown' }
]

export function rankFor(xp: number): { current: LearnRank, next: LearnRank | null, ratio: number } {
  let index = 0
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i]!.min) index = i
  }

  const current = RANKS[index]!
  const next = RANKS[index + 1] ?? null
  const ratio = next
    ? (xp - current.min) / (next.min - current.min)
    : 1

  return { current, next, ratio: Math.min(1, Math.max(0, ratio)) }
}
