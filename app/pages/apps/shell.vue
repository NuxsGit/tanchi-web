<script setup lang="ts">
import { CATEGORIES, INTENTS } from '~~/shared/shell/intents'
import { explainCommand, renderRecipe, searchIntents, translate, type SlotValue } from '~~/shared/shell/translate'
import { PLATFORMS, findPlatform, type PlatformId } from '~~/shared/shell/types'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'ShellTraductor — Tanchi Web' })

const toast = useToast()

/* ------------------------------------------------------------- Traduction */

const platform = ref<PlatformId>('debian')
const query = ref('ouvrir le port 22')

const results = computed(() => translate(query.value, platform.value))
const primary = computed(() => results.value[0] ?? null)
const alternatives = computed(() => results.value.slice(1))

/** Valeurs corrigées à la main : la phrase ne dit pas toujours tout. */
const overrides = ref<Record<string, string>>({})

watch(() => primary.value?.intent.id, () => { overrides.value = {} })

const values = computed<SlotValue[]>(() =>
  (primary.value?.values ?? []).map(slot => ({
    ...slot,
    value: overrides.value[slot.id] ?? slot.value,
    assumed: overrides.value[slot.id] ? false : slot.assumed
  }))
)

const recipe = computed(() => {
  if (!primary.value) return null
  const source = primary.value.intent.platforms[platform.value]
  return source ? renderRecipe(source, values.value) : null
})

const explanations = computed(() =>
  recipe.value ? explainCommand(recipe.value.commands.join(' ; ')) : []
)

const currentPlatform = computed(() => findPlatform(platform.value)!)

/* --------------------------------------------------------------- Actions */

async function copy(value: string, label = 'Commande') {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} copiée`, color: 'success' })
  } catch {
    toast.add({ title: 'Copie impossible', color: 'error' })
  }
}

function copyAll() {
  if (!recipe.value) return
  copy(recipe.value.commands.join('\n'), `${recipe.value.commands.length} commande(s)`)
}

const history = ref<string[]>([])

let historyTimer: ReturnType<typeof setTimeout> | null = null

watch(query, value => {
  if (historyTimer) clearTimeout(historyTimer)

  // On n'archive qu'une fois la frappe posée, sinon chaque lettre fait une entrée.
  historyTimer = setTimeout(() => {
    const trimmed = value.trim()
    if (trimmed.length < 4 || !primary.value) return
    history.value = [trimmed, ...history.value.filter(item => item !== trimmed)].slice(0, 8)
  }, 900)
})

onBeforeUnmount(() => {
  if (historyTimer) clearTimeout(historyTimer)
})

function ask(text: string) {
  query.value = text
  tab.value = 'translate'
}

/* --------------------------------------------------------------- Catalogue */

const catalogFilter = ref('')
const catalogCategory = ref<string | null>(null)

const catalog = computed(() => {
  let list = searchIntents(catalogFilter.value)
  if (catalogCategory.value) list = list.filter(intent => intent.category === catalogCategory.value)
  return list
})

const byCategory = computed(() => {
  const groups = new Map<string, typeof INTENTS>()
  for (const intent of catalog.value) {
    const bucket = groups.get(intent.category) ?? []
    bucket.push(intent)
    groups.set(intent.category, bucket)
  }
  return [...groups.entries()]
})

const tab = ref('translate')

const tabs = [
  { value: 'translate', slot: 'translate', label: 'Traduire', icon: 'i-lucide-languages' },
  { value: 'catalog', slot: 'catalog', label: 'Ce que je sais faire', icon: 'i-lucide-book-marked' }
]

const SUGGESTIONS = [
  'ouvrir le port 22',
  'redémarrer nginx',
  'combien d\'espace disque il reste',
  'bloquer 203.0.113.7',
  'ajouter alice au groupe sudo',
  'quels ports sont en écoute',
  'quand expire le certificat de exemple.fr',
  'ajouter une route vers 10.0.0.0/8 via 192.168.1.254'
]
</script>

<template>
  <div class="space-y-4">
    <!-- En-tête -->
    <header class="overflow-hidden rounded-xl border border-line bg-surface">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
        <div class="flex items-center gap-2">
          <NuxtLink to="/apps" class="transition hover:text-ink">applications</NuxtLink>
          <span>/</span>
          <span class="text-accent">shell</span>
        </div>
        <span>{{ INTENTS.length }} intentions · {{ PLATFORMS.length }} plateformes · hors ligne</span>
      </div>

      <div class="flex items-center gap-2.5 p-4">
        <span class="flex size-9 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
          <UIcon name="i-lucide-languages" class="size-4.5 text-accent" />
        </span>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-ink">Tanchi ShellTraductor</h1>
          <p class="text-xs text-ink-dim">
            Décrivez ce que vous voulez faire, choisissez la machine, récupérez la commande
          </p>
        </div>
      </div>
    </header>

    <UTabs v-model="tab" :items="tabs" :unmount-on-hide="false" variant="link" class="w-full">
      <!-- ==================================================== Traduire -->
      <template #translate>
        <div class="mt-4 space-y-4">
          <!-- Plateforme -->
          <div class="rounded-xl border border-line bg-surface p-3">
            <p class="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">Appareil ou système</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="item in PLATFORMS"
                :key="item.id"
                type="button"
                class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition"
                :class="platform === item.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-line hover:border-accent/50'"
                @click="platform = item.id"
              >
                <UIcon
                  :name="item.icon"
                  class="size-4 shrink-0"
                  :class="platform === item.id ? 'text-accent' : 'text-ink-dim'"
                />
                <span>
                  <span class="block text-xs" :class="platform === item.id ? 'text-accent' : 'text-ink-muted'">
                    {{ item.short }}
                  </span>
                  <span class="block font-mono text-[10px] text-ink-dim">{{ item.hint }}</span>
                </span>
              </button>
            </div>
          </div>

          <!-- Demande -->
          <div class="rounded-xl border border-line bg-surface p-3">
            <UInput
              v-model="query"
              size="xl"
              class="w-full"
              icon="i-lucide-message-square-text"
              placeholder="ouvrir le port 22, redémarrer nginx, bloquer une adresse…"
              autofocus
            />

            <div class="mt-2 flex flex-wrap gap-1">
              <button
                v-for="item in SUGGESTIONS"
                :key="item"
                type="button"
                class="rounded border border-line px-2 py-0.5 text-[11px] text-ink-dim transition hover:border-accent/60 hover:text-accent"
                @click="ask(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>

          <!-- Résultat -->
          <div v-if="primary && recipe" class="overflow-hidden rounded-xl border border-line bg-surface">
            <div class="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
              <UIcon name="i-lucide-corner-down-right" class="size-4 text-accent" />
              <h2 class="text-sm font-medium text-ink">{{ primary.intent.label }}</h2>
              <UBadge :label="primary.intent.category" color="neutral" variant="subtle" size="sm" />

              <span class="ml-auto flex items-center gap-2">
                <span class="font-mono text-[11px] text-ink-dim">
                  {{ currentPlatform.shell }} · confiance {{ Math.round(primary.confidence * 100) }} %
                </span>
                <UButton
                  icon="i-lucide-copy"
                  color="primary"
                  variant="soft"
                  size="xs"
                  label="Copier"
                  @click="copyAll"
                />
              </span>
            </div>

            <!-- Paramètres relus -->
            <div v-if="values.length" class="flex flex-wrap gap-2 border-b border-line bg-canvas px-3 py-2">
              <div v-for="slot in values" :key="slot.id" class="flex items-center gap-1.5">
                <span class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">{{ slot.label }}</span>
                <input
                  :value="slot.value"
                  class="w-28 rounded border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink outline-none transition focus:border-accent"
                  :class="slot.value
                    ? (slot.assumed ? 'border-warning-500/50' : 'border-line')
                    : 'border-error-500/60'"
                  :placeholder="primary.intent.slots.find(item => item.id === slot.id)?.placeholder"
                  @input="overrides[slot.id] = ($event.target as HTMLInputElement).value"
                >
                <span v-if="slot.assumed" class="text-[10px] text-warning-500" title="Valeur par défaut">par défaut</span>
              </div>
            </div>

            <div class="p-3">
              <!-- Avertissement -->
              <div
                v-if="recipe.danger"
                class="mb-3 flex items-start gap-2 rounded-md border border-error-500/40 bg-error-500/5 p-2.5"
              >
                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-error-500" />
                <p class="text-xs leading-relaxed text-ink">{{ recipe.danger }}</p>
              </div>

              <div
                v-if="recipe.missing.length"
                class="mb-3 flex items-start gap-2 rounded-md border border-warning-500/40 bg-warning-500/5 p-2.5"
              >
                <UIcon name="i-lucide-circle-help" class="mt-0.5 size-4 shrink-0 text-warning-500" />
                <p class="text-xs leading-relaxed text-ink">
                  Il manque {{ recipe.missing.join(', ') }} : complétez le champ ci-dessus, la commande se met à jour.
                </p>
              </div>

              <!-- Commandes -->
              <div class="overflow-hidden rounded-lg border border-line bg-canvas">
                <div
                  v-for="(command, position) in recipe.commands"
                  :key="position"
                  class="group flex items-start gap-2 px-3 py-2"
                  :class="{ 'border-t border-line': position > 0 }"
                >
                  <span class="mt-0.5 select-none font-mono text-xs text-accent">$</span>
                  <code class="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-ink">{{ command }}</code>
                  <button
                    type="button"
                    class="opacity-0 transition group-hover:opacity-100"
                    title="Copier cette ligne"
                    @click="copy(command)"
                  >
                    <UIcon name="i-lucide-copy" class="size-3.5 text-ink-dim hover:text-accent" />
                  </button>
                </div>
              </div>

              <!-- Note -->
              <p v-if="recipe.note" class="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
                <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0 text-info-500" />
                {{ recipe.note }}
              </p>

              <!-- Vérifier / revenir en arrière -->
              <div v-if="recipe.verify || recipe.undo" class="mt-3 grid gap-2 sm:grid-cols-2">
                <div v-if="recipe.verify" class="rounded-md border border-line bg-canvas p-2.5">
                  <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Vérifier</p>
                  <button
                    type="button"
                    class="mt-1 block w-full break-all text-left font-mono text-[11px] text-ink-muted transition hover:text-accent"
                    @click="copy(recipe.verify!, 'Vérification')"
                  >
                    {{ recipe.verify }}
                  </button>
                </div>

                <div v-if="recipe.undo" class="rounded-md border border-line bg-canvas p-2.5">
                  <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Revenir en arrière</p>
                  <button
                    type="button"
                    class="mt-1 block w-full break-all text-left font-mono text-[11px] text-ink-muted transition hover:text-accent"
                    @click="copy(recipe.undo!, 'Annulation')"
                  >
                    {{ recipe.undo }}
                  </button>
                </div>
              </div>

              <!-- Décomposition -->
              <div v-if="explanations.length" class="mt-3 border-t border-line pt-3">
                <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Ce que fait chaque élément</p>
                <div class="mt-1.5 space-y-1">
                  <p
                    v-for="item in explanations"
                    :key="item.token"
                    class="flex flex-wrap items-baseline gap-x-2 text-xs"
                  >
                    <code class="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-accent">{{ item.token }}</code>
                    <span class="text-ink-muted">{{ item.meaning }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Intention comprise, mais pas sur cette plateforme -->
          <div
            v-else-if="primary && !recipe"
            class="rounded-xl border border-warning-500/40 bg-warning-500/5 p-4"
          >
            <p class="flex items-center gap-2 text-sm text-ink">
              <UIcon name="i-lucide-circle-slash" class="size-4 shrink-0 text-warning-500" />
              « {{ primary.intent.label }} » n'a pas d'équivalent direct sur {{ currentPlatform.short }}.
            </p>
            <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span class="text-xs text-ink-dim">Disponible sur :</span>
              <button
                v-for="id in primary.availableOn"
                :key="id"
                type="button"
                class="rounded border border-line px-2 py-0.5 text-[11px] text-ink-muted transition hover:border-accent/60 hover:text-accent"
                @click="platform = id"
              >
                {{ findPlatform(id)?.short }}
              </button>
            </div>
          </div>

          <!-- Rien compris -->
          <div v-else-if="query.trim()" class="rounded-xl border border-line bg-surface p-6 text-center">
            <UIcon name="i-lucide-search-x" class="mx-auto size-6 text-ink-dim" />
            <p class="mt-2 text-sm text-ink">Je ne sais pas traduire cette demande.</p>
            <p class="mt-1 text-xs text-ink-dim">
              Le traducteur repose sur un catalogue de {{ INTENTS.length }} intentions, pas sur un modèle de langue :
              il préfère se taire plutôt que d'inventer une commande d'administration.
            </p>
            <UButton
              class="mt-3"
              icon="i-lucide-book-marked"
              color="neutral"
              variant="outline"
              size="sm"
              label="Voir ce qu'il sait faire"
              @click="tab = 'catalog'"
            />
          </div>

          <!-- Autres lectures possibles -->
          <div v-if="alternatives.length" class="rounded-xl border border-line bg-surface">
            <p class="border-b border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
              Autres lectures possibles
            </p>
            <div class="divide-y divide-line">
              <button
                v-for="item in alternatives"
                :key="item.intent.id"
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-raised"
                @click="ask(item.intent.examples[0] ?? query)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block text-xs text-ink">{{ item.intent.label }}</span>
                  <span class="block font-mono text-[10px] text-ink-dim">
                    {{ item.intent.platforms[platform]?.commands[0] ?? 'pas d\'équivalent ici' }}
                  </span>
                </span>
                <span class="shrink-0 font-mono text-[10px] text-ink-dim">
                  {{ Math.round(item.confidence * 100) }} %
                </span>
              </button>
            </div>
          </div>

          <!-- Historique -->
          <div v-if="history.length" class="rounded-xl border border-line bg-surface p-3">
            <p class="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-dim">Demandes récentes</p>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="item in history"
                :key="item"
                type="button"
                class="rounded border border-line px-2 py-0.5 text-[11px] text-ink-muted transition hover:border-accent/60 hover:text-accent"
                @click="ask(item)"
              >
                {{ item }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- ==================================================== Catalogue -->
      <template #catalog>
        <div class="mt-4 space-y-4">
          <div class="rounded-xl border border-line bg-surface p-3">
            <UInput
              v-model="catalogFilter"
              icon="i-lucide-search"
              placeholder="chercher une action, un mot-clé…"
              class="w-full"
            />

            <div class="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                class="rounded border px-2 py-0.5 text-[11px] transition"
                :class="catalogCategory === null ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-dim hover:text-ink'"
                @click="catalogCategory = null"
              >
                Tout
              </button>
              <button
                v-for="item in CATEGORIES"
                :key="item"
                type="button"
                class="rounded border px-2 py-0.5 text-[11px] transition"
                :class="catalogCategory === item ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-dim hover:text-ink'"
                @click="catalogCategory = item"
              >
                {{ item }}
              </button>
            </div>
          </div>

          <div v-for="[category, list] in byCategory" :key="category" class="rounded-xl border border-line bg-surface">
            <p class="border-b border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
              {{ category }} <span class="text-ink-dim/60">({{ list.length }})</span>
            </p>

            <div class="divide-y divide-line">
              <div v-for="intent in list" :key="intent.id" class="px-3 py-2.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm text-ink">{{ intent.label }}</span>
                  <span class="flex flex-wrap gap-1">
                    <span
                      v-for="id in (Object.keys(intent.platforms) as PlatformId[])"
                      :key="id"
                      class="rounded bg-raised px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-dim"
                      :title="findPlatform(id)?.label"
                    >{{ findPlatform(id)?.short }}</span>
                  </span>
                </div>

                <div class="mt-1.5 flex flex-wrap gap-1">
                  <button
                    v-for="example in intent.examples"
                    :key="example"
                    type="button"
                    class="rounded border border-line px-2 py-0.5 text-left font-mono text-[10px] text-ink-muted transition hover:border-accent/60 hover:text-accent"
                    @click="ask(example)"
                  >
                    {{ example }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p v-if="!byCategory.length" class="rounded-xl border border-line bg-surface px-3 py-10 text-center text-sm text-ink-dim">
            Rien ne correspond à cette recherche.
          </p>
        </div>
      </template>
    </UTabs>
  </div>
</template>
