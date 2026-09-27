<script setup lang="ts">
import { TANCHI_APPS } from '~~/shared/apps'

const { isLoggedIn, user } = useAuth()

useHead({ title: 'Tanchi Web — la console d\'administration qui reste chez vous' })

/** Seuls les modules réellement livrés sont mis en avant. */
const apps = computed(() => TANCHI_APPS.filter(app => app.status === 'active'))
const upcoming = computed(() => TANCHI_APPS.filter(app => app.status !== 'active'))

/**
 * Démonstration du traducteur, reprise telle quelle de l'application.
 * Ces trois commandes sont exactement ce que rend /apps/shell.
 */
const demo = [
  { platform: 'Debian / Ubuntu', command: 'sudo ufw allow 22/tcp' },
  { platform: 'RHEL / Rocky', command: 'sudo firewall-cmd --permanent --add-port=22/tcp' },
  { platform: 'Cisco IOS', command: 'permit tcp any any eq 22' }
]

/**
 * Chiffres du catalogue.
 *
 * Écrits ici plutôt qu'importés : charger les catalogues complets sur une page
 * publique coûterait plus cher que ce que la donnée rapporte. Sources —
 * shared/topology/catalog.ts, shared/topology/diagnostics.ts,
 * server/assets/oui.txt, shared/shell/intents.ts, shared/learn/courses.ts.
 */
const figures = [
  { value: '144', label: 'composants réseau', detail: 'du switch ToR à l\'onduleur' },
  { value: '30', label: 'règles de diagnostic', detail: 'câblage, alimentation, sécurité, capacité' },
  { value: '46 521', label: 'préfixes IEEE', detail: 'registre MAC embarqué, hors ligne' },
  { value: '55', label: 'intentions shell', detail: 'sur 8 systèmes et équipements' }
]

const values = [
  {
    index: '01',
    icon: 'i-lucide-shield-check',
    title: 'Vos données restent vos données',
    lead: 'Chez vous, et nulle part ailleurs',
    body: 'Comptes, équipes, matrices de flux, plans réseau : tout vit sur votre serveur. Pas de compte à ouvrir chez un tiers, pas de synchronisation dans un nuage, pas de télémétrie. Vous restez maître de l\'instance et de ce qu\'elle contient, sans avoir à faire confiance à qui que ce soit.'
  },
  {
    index: '02',
    icon: 'i-lucide-wifi-off',
    title: 'Rien ne sort',
    lead: 'Aucune dépendance externe',
    body: 'Les icônes sont servies depuis une collection locale, le registre IEEE des adresses MAC est embarqué, et le traducteur de commandes repose sur un catalogue, pas sur un modèle de langue. La console fonctionne dans un réseau isolé, sans rien demander à personne.'
  },
  {
    index: '03',
    icon: 'i-lucide-scale',
    title: 'Des outils qui ne bluffent pas',
    lead: 'Se taire plutôt qu\'inventer',
    body: 'Le traducteur refuse une phrase qu\'il ne comprend pas au lieu de fabriquer une commande plausible. Le convertisseur Nginx reporte en commentaire ce qu\'il ne sait pas traduire. Le contrôleur de topologie explique chaque constat et cite la règle qui l\'a levé. Une console d\'administration qui devine est une console dangereuse.'
  },
  {
    index: '04',
    icon: 'i-lucide-users',
    title: 'À plusieurs, sans s\'écraser',
    lead: 'Révisions et conflits assumés',
    body: 'Une matrice ou un plan s\'ouvre en brouillon personnel ou en portée équipe. Chaque enregistrement annonce la révision qu\'il croit modifier : si un coéquipier est passé avant, le serveur refuse et vous laisse arbitrer. Personne n\'écrase personne en silence.'
  }
]

/** Ce que la console n'émet jamais vers l'extérieur. */
const never = [
  'Aucune mesure d\'audience, aucune télémétrie',
  'Aucune police ni icône chargée depuis un CDN',
  'Aucun appel à un service d\'intelligence artificielle',
  'Aucune remontée d\'erreur vers un service tiers'
]

const stack = [
  { label: 'Nuxt 4 · Vue 3 · TypeScript', detail: 'rendu serveur, hydratation partielle' },
  { label: 'Hébergé sur votre matériel', detail: 'aucun service tiers appelé' },
  { label: 'scrypt + cookie httpOnly', detail: 'mot de passe jamais stocké en clair' },
  { label: 'Quatre thèmes, rendus au serveur', detail: 'aucun flash au chargement' }
]
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink">
    <!-- Bandeau d'état -->
    <div class="border-b border-line bg-surface">
      <UContainer class="flex h-8 items-center justify-between gap-4 font-mono text-[11px] text-ink-dim">
        <span class="flex items-center gap-2">
          <span class="size-1.5 rounded-full bg-success-500" />
          instance auto-hébergée
        </span>
        <span class="hidden sm:block">auto-hébergé · hors ligne · français</span>
      </UContainer>
    </div>

    <!-- Barre de navigation -->
    <header class="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <UContainer class="flex h-14 items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <span class="flex size-7 items-center justify-center rounded-md bg-accent-fill">
            <UIcon name="i-lucide-square-terminal" class="size-4 text-accent-ink" />
          </span>
          <span class="text-sm font-semibold tracking-tight">Tanchi Web</span>
        </NuxtLink>

        <nav class="hidden items-center gap-6 text-sm text-ink-muted md:flex">
          <a href="#valeurs" class="transition hover:text-ink">Valeurs</a>
          <a href="#suite" class="transition hover:text-ink">La suite</a>
          <a href="#socle" class="transition hover:text-ink">Socle technique</a>
        </nav>

        <div class="flex items-center gap-2">
          <template v-if="isLoggedIn">
            <span class="hidden font-mono text-[11px] text-ink-dim sm:block">{{ user?.username }}</span>
            <UButton to="/apps" icon="i-lucide-layout-grid" size="sm" label="Ouvrir le hub" />
          </template>
          <template v-else>
            <UButton to="/login" color="neutral" variant="ghost" size="sm" label="Connexion" />
            <UButton to="/register" size="sm" label="Créer un compte" />
          </template>
        </div>
      </UContainer>
    </header>

    <!-- ==================================================== Présentation -->
    <section class="border-b border-line">
      <UContainer class="grid gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_26rem] lg:py-24">
        <div>
          <p class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            <span class="h-px w-6 bg-accent" />
            console d'administration système
          </p>

          <h1 class="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Les outils du quotidien,<br>
            <span class="text-accent">sur votre propre serveur</span>
          </h1>

          <p class="mt-5 max-w-xl text-base leading-relaxed text-ink-muted">
            Tanchi Web réunit ce qu'un administrateur ressort dix fois par jour : calculs de sous-réseaux,
            schémas d'infrastructure, matrices de flux, expressions cron, adresses MAC, commandes shell.
            Le tout sur votre propre serveur, sans compte à créer ailleurs
            et sans rien envoyer à l'extérieur.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <UButton
              :to="isLoggedIn ? '/apps' : '/register'"
              size="lg"
              icon="i-lucide-arrow-right"
              trailing
              :label="isLoggedIn ? 'Retourner au hub' : 'Installer et commencer'"
            />
            <UButton
              to="/apps/learn"
              size="lg"
              color="neutral"
              variant="outline"
              icon="i-lucide-graduation-cap"
              label="Visiter la suite"
            />
          </div>

          <!-- Chiffres vérifiables -->
          <dl class="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-8 sm:grid-cols-4">
            <div v-for="item in figures" :key="item.label">
              <dt class="font-mono text-2xl text-ink">{{ item.value }}</dt>
              <dd class="mt-0.5 text-xs text-ink-muted">{{ item.label }}</dd>
              <dd class="mt-0.5 text-[11px] leading-snug text-ink-dim">{{ item.detail }}</dd>
            </div>
          </dl>
        </div>

        <!-- Démonstration : une phrase, trois systèmes -->
        <div class="lg:pt-10">
          <div class="overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/20">
            <div class="flex items-center gap-2 border-b border-line px-3 py-2">
              <span class="flex gap-1.5">
                <span class="size-2 rounded-full bg-error-500/60" />
                <span class="size-2 rounded-full bg-warning-500/60" />
                <span class="size-2 rounded-full bg-success-500/60" />
              </span>
              <span class="ml-1 font-mono text-[11px] text-ink-dim">tanchi · shelltraductor</span>
            </div>

            <div class="p-4">
              <p class="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Vous écrivez</p>
              <p class="mt-1.5 rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink">
                ouvrir le port 22
              </p>

              <p class="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-dim">Il rend</p>
              <div class="mt-1.5 space-y-1.5">
                <div
                  v-for="item in demo"
                  :key="item.platform"
                  class="rounded-md border border-line bg-canvas px-3 py-2"
                >
                  <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">{{ item.platform }}</p>
                  <p class="mt-1 break-all font-mono text-[12px] leading-relaxed text-accent">{{ item.command }}</p>
                </div>
              </div>

              <p class="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-dim">
                <UIcon name="i-lucide-info" class="mt-0.5 size-3 shrink-0" />
                Avec la commande de vérification, celle du retour en arrière, et le sens de chaque option.
              </p>
            </div>
          </div>
        </div>
      </UContainer>
    </section>

    <!-- ========================================================= Valeurs -->
    <section id="valeurs" class="border-b border-line bg-surface">
      <UContainer class="py-16 lg:py-20">
        <p class="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Ce à quoi la console tient</p>
        <h2 class="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
          Quatre partis pris, tenus jusque dans le code
        </h2>

        <div class="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          <article
            v-for="item in values"
            :key="item.index"
            class="bg-surface p-6"
          >
            <div class="flex items-center gap-3">
              <span class="flex size-8 items-center justify-center rounded-md bg-accent-soft ring-1 ring-accent/25">
                <UIcon :name="item.icon" class="size-4 text-accent" />
              </span>
              <span class="font-mono text-[11px] text-ink-dim">{{ item.index }}</span>
            </div>

            <h3 class="mt-4 text-lg font-medium tracking-tight text-ink">{{ item.title }}</h3>
            <p class="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-accent">{{ item.lead }}</p>
            <p class="mt-3 text-sm leading-relaxed text-ink-muted">{{ item.body }}</p>
          </article>
        </div>
      </UContainer>
    </section>

    <!-- ======================================================== La suite -->
    <section id="suite" class="border-b border-line">
      <UContainer class="py-16 lg:py-20">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Ce qui est livré</p>
            <h2 class="mt-3 text-3xl font-semibold tracking-tight">
              {{ apps.length }} applications, une seule console
            </h2>
          </div>
          <p class="max-w-md text-sm leading-relaxed text-ink-muted">
            Chaque module s'ouvre depuis le hub et s'épingle dans la barre latérale.
            Vous choisissez ce que vous voyez : rien n'est imposé par défaut.
          </p>
        </div>

        <div class="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <NuxtLink
            v-for="app in apps"
            :key="app.id"
            :to="isLoggedIn ? app.to : '/login'"
            class="group flex flex-col bg-surface p-5 transition hover:bg-raised"
          >
            <span class="flex size-9 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/25 transition group-hover:ring-accent/50">
              <UIcon :name="app.icon" class="size-4.5 text-accent" />
            </span>

            <h3 class="mt-4 text-sm font-medium text-ink">{{ app.name }}</h3>
            <p class="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim">{{ app.tagline }}</p>
            <p class="mt-2.5 text-xs leading-relaxed text-ink-muted">{{ app.description }}</p>

            <span class="mt-auto pt-4 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim transition group-hover:text-accent">
              ouvrir
              <UIcon name="i-lucide-arrow-up-right" class="size-3" />
            </span>
          </NuxtLink>
        </div>

        <p v-if="upcoming.length" class="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-dim">
          <UIcon name="i-lucide-clock" class="size-3.5" />
          En chantier :
          <span v-for="app in upcoming" :key="app.id" class="rounded border border-line px-1.5 py-0.5 font-mono text-[10px]">
            {{ app.name }}
          </span>
        </p>
      </UContainer>
    </section>

    <!-- ================================================== Socle technique -->
    <section id="socle" class="border-b border-line bg-surface">
      <UContainer class="grid gap-10 py-16 lg:grid-cols-2 lg:py-20">
        <div>
          <p class="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">Sous le capot</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight">
            Rien d'exotique,<br>rien de caché
          </h2>
          <p class="mt-5 max-w-lg text-sm leading-relaxed text-ink-muted">
            Une application Nuxt qui tourne sur votre matériel. Pas de conteneur obligatoire, pas de
            service tiers, pas de CDN, pas de télémétrie. Ce que vous installez est ce qui s'exécute :
            la console reste entièrement fonctionnelle sur un réseau coupé d'Internet.
          </p>

          <div class="mt-6 rounded-lg border border-line bg-canvas p-4">
            <p class="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Ce qui ne part jamais</p>
            <ul class="mt-2.5 space-y-1.5">
              <li v-for="item in never" :key="item" class="flex items-start gap-2 text-xs text-ink-muted">
                <UIcon name="i-lucide-x" class="mt-0.5 size-3.5 shrink-0 text-error-500" />
                {{ item }}
              </li>
            </ul>
          </div>
        </div>

        <ul class="grid content-start gap-px overflow-hidden rounded-xl border border-line bg-line">
          <li
            v-for="item in stack"
            :key="item.label"
            class="flex items-start gap-3 bg-surface px-5 py-4"
          >
            <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success-500" />
            <span>
              <span class="block text-sm text-ink">{{ item.label }}</span>
              <span class="mt-0.5 block text-xs text-ink-dim">{{ item.detail }}</span>
            </span>
          </li>
        </ul>
      </UContainer>
    </section>

    <!-- ============================================================ Fin -->
    <section class="border-b border-line">
      <UContainer class="flex flex-wrap items-center justify-between gap-6 py-14">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">
            {{ isLoggedIn ? `Bon retour, ${user?.username}.` : 'Une console, chez vous, en quelques minutes.' }}
          </h2>
          <p class="mt-2 max-w-lg text-sm text-ink-muted">
            {{ isLoggedIn
              ? 'Vos matrices, plans et tableaux vous attendent dans le hub.'
              : 'Le premier compte créé devient propriétaire de l\'instance.' }}
          </p>
        </div>

        <UButton
          :to="isLoggedIn ? '/apps' : '/register'"
          size="lg"
          icon="i-lucide-arrow-right"
          trailing
          :label="isLoggedIn ? 'Ouvrir le hub' : 'Créer le compte propriétaire'"
        />
      </UContainer>
    </section>

    <footer>
      <UContainer class="flex flex-wrap items-center justify-between gap-4 py-8 font-mono text-[11px] text-ink-dim">
        <span class="flex items-center gap-2">
          <span class="flex size-5 items-center justify-center rounded bg-accent-fill">
            <UIcon name="i-lucide-square-terminal" class="size-3 text-accent-ink" />
          </span>
          tanchi web — console d'administration auto-hébergée
        </span>
        <span>aucune donnée ne quitte cette machine</span>
      </UContainer>
    </footer>
  </div>
</template>
