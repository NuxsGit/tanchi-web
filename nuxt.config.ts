// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Les DevTools chargent `vite-plugin-inspect`, qui conserve en mémoire le
  // graphe complet des modules (source + transformé). Sur une machine à 6 Go
  // c'est plusieurs centaines de Mo pour rien : activation à la demande via
  // `NUXT_DEVTOOLS=true npm run dev`.
  devtools: { enabled: process.env.NUXT_DEVTOOLS === 'true' },

  // La base SQLite vit dans le projet : sans cette exclusion, chaque écriture
  // dans `tanchi.db-wal` réveille le watcher de Vite.
  ignore: ['data/**'],
  watch: [],
  vite: {
    server: {
      watch: { ignored: ['**/data/**'] }
    }
  },

  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  icon: {
    // `server` sert les icônes depuis la collection Lucide installée en local :
    // aucune requête vers Internet, et surtout un recours pour tout ce que le
    // scan statique ne peut pas voir (nos catalogues sont des données, pas des
    // littéraux de template).
    provider: 'server',
    serverBundle: {
      collections: ['lucide']
    },
    clientBundle: {
      // Le scan par défaut ignore les .ts : or nos icônes vivent dans des
      // catalogues (shared/topology, shared/apps, shared/learn), pas dans des
      // templates. Sans cet ajout, elles ne sont jamais embarquées et le mode
      // CSS ne peut pas produire leur règle — l'icône reste invisible.
      scan: {
        globInclude: ['app/**/*.{vue,ts}', 'shared/**/*.ts'],
        globExclude: ['node_modules', 'dist', '.output', '.nuxt', 'data']
      },
      sizeLimitKb: 1024
    }
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
    // Stocké en cookie plutôt qu'en localStorage : le serveur connaît le mode
    // dès la première requête et rend la bonne palette, sans flash.
    storage: 'cookie',
    storageKey: 'tanchi_color_mode'
  },
  experimental: {
    // Les payloads des pages déjà rendues sont réutilisés à la navigation.
    payloadExtraction: true
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Tanchi Web — Control Center pour Sysadmins',
      htmlAttrs: { lang: 'fr' },
      meta: [
        { name: 'description', content: 'Centralisez vos métriques, conteneurs et logs dans une seule interface.' }
      ],
      // Peint le fond avant même le chargement de la feuille principale : le
      // thème mémorisé s'applique au premier pixel, sans flash blanc.
      style: [
        {
          children: `html{background:#050705;color-scheme:dark}`
            + `html[data-theme=blanc-vert]{background:#fbfdfb;color-scheme:light}`
            + `html[data-theme=nothing-jaune]{background:#fff;color-scheme:light}`
            + `html[data-theme=nothing-rouge]{background:#000;color-scheme:dark}`
        }
      ]
    }
  }
})
