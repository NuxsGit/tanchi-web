<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { CRON_PRESETS, parseCron } from '~~/shared/configlab/cron'
import { FLAG_LABELS, REGEX_PRESETS, analyseRegex } from '~~/shared/configlab/regex'
import { SAMPLES, convert, validate, type ServerFlavour } from '~~/shared/configlab/webserver'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'ConfigLab — Tanchi Web' })

const toast = useToast()

async function copy(value: string, label = 'Contenu') {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} copié`, color: 'success' })
  } catch {
    toast.add({ title: 'Copie impossible', color: 'error' })
  }
}

/* --------------------------------------------------------------- Cron */

const cronInput = ref('*/15 * * * *')

/** Recalculé à chaque frappe : l'analyse est purement locale. */
const cron = computed(() => parseCron(cronInput.value))

/* -------------------------------------------------------------- Regex */

const regexPattern = ref('^(\\w+)@([\\w-]+)\\.([a-z]{2,})$')
const regexFlags = ref('i')
const regexSample = ref('contact@tanchi.io')

const regex = computed(() => analyseRegex(regexPattern.value, regexFlags.value, regexSample.value))

const availableFlags = ['g', 'i', 'm', 's', 'u']

function toggleFlag(flag: string) {
  regexFlags.value = regexFlags.value.includes(flag)
    ? regexFlags.value.replace(flag, '')
    : regexFlags.value + flag
}

/** Découpe l'échantillon pour surligner les correspondances. */
const highlighted = computed(() => {
  const text = regexSample.value
  const matches = regex.value.matches
  if (!matches.length) return [{ text, match: false }]

  const parts: { text: string, match: boolean }[] = []
  let cursor = 0

  for (const item of matches) {
    if (item.index > cursor) parts.push({ text: text.slice(cursor, item.index), match: false })
    parts.push({ text: item.value, match: true })
    cursor = item.index + item.value.length
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
})

const tokenColor: Record<string, string> = {
  'ancre': 'text-warning-500',
  'classe': 'text-info-500',
  'quantificateur': 'text-accent',
  'groupe': 'text-success-500',
  'échappement': 'text-info-500',
  'littéral': 'text-ink',
  'alternative': 'text-warning-500'
}

/* --------------------------------------------------------- Serveur web */

const direction = ref<ServerFlavour>('nginx')
const source = ref(SAMPLES.nginx)

const converted = computed(() => convert(source.value, direction.value))
const validation = computed(() => validate(source.value, direction.value))
const targetValidation = computed(() =>
  validate(converted.value.output, direction.value === 'nginx' ? 'apache' : 'nginx')
)

const targetLabel = computed(() => (direction.value === 'nginx' ? 'Apache' : 'Nginx'))
const sourceLabel = computed(() => (direction.value === 'nginx' ? 'Nginx' : 'Apache'))

function swapDirection() {
  direction.value = direction.value === 'nginx' ? 'apache' : 'nginx'
  source.value = SAMPLES[direction.value]
}

function loadSample() {
  source.value = SAMPLES[direction.value]
}

const severityIcon: Record<string, string> = {
  error: 'i-lucide-circle-x',
  warning: 'i-lucide-triangle-alert'
}

/* ------------------------------------------------------------ Onglets */

const tab = ref('cron')

const tabs: TabsItem[] = [
  { value: 'cron', slot: 'cron', label: 'Cron', icon: 'i-lucide-clock' },
  { value: 'regex', slot: 'regex', label: 'Regex', icon: 'i-lucide-regex' },
  { value: 'web', slot: 'web', label: 'Nginx ↔ Apache', icon: 'i-lucide-arrow-left-right' }
]
</script>

<template>
  <div class="space-y-4">
    <!-- En-tête -->
    <header class="overflow-hidden rounded-xl border border-line bg-surface">
      <div class="flex items-center justify-between border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
        <div class="flex items-center gap-2">
          <NuxtLink to="/apps" class="transition hover:text-ink">applications</NuxtLink>
          <span>/</span>
          <span class="text-accent">configlab</span>
        </div>
        <span>analyse locale, rien n'est envoyé</span>
      </div>

      <div class="flex items-center gap-2.5 p-4">
        <span class="flex size-9 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
          <UIcon name="i-lucide-flask-conical" class="size-4.5 text-accent" />
        </span>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-ink">Tanchi ConfigLab</h1>
          <p class="text-xs text-ink-dim">
            Validation instantanée et explication en clair de vos règles cron, regex et serveur web
          </p>
        </div>
      </div>
    </header>

    <UTabs v-model="tab" :items="tabs" :unmount-on-hide="false" variant="link" class="w-full">
      <!-- --------------------------------------------------------- Cron -->
      <template #cron>
        <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div class="space-y-4">
            <UCard class="bg-surface ring-1 ring-line">
              <UFormField label="Expression cron" hint="minute heure jour mois jour-semaine, ou une macro @daily">
                <UInput
                  v-model="cronInput"
                  size="xl"
                  class="w-full font-mono"
                  placeholder="*/15 * * * *"
                  :color="cron.valid ? undefined : 'error'"
                />
              </UFormField>

              <!-- Verdict immédiat -->
              <div
                class="mt-3 flex items-start gap-2 rounded-md border p-3"
                :class="cron.valid
                  ? 'border-success-500/30 bg-success-500/5'
                  : 'border-error-500/30 bg-error-500/5'"
              >
                <UIcon
                  :name="cron.valid ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                  class="mt-0.5 size-4 shrink-0"
                  :class="cron.valid ? 'text-success-500' : 'text-error-500'"
                />
                <div class="min-w-0">
                  <p v-if="cron.valid" class="text-sm text-ink">
                    S'exécute <strong class="text-accent">{{ cron.summary }}</strong>.
                  </p>
                  <p v-for="error in cron.errors" :key="error" class="text-sm text-error-500">
                    {{ error }}
                  </p>
                  <p v-if="cron.macro && cron.expanded !== '—'" class="mt-1 font-mono text-[11px] text-ink-dim">
                    {{ cron.macro }} équivaut à {{ cron.expanded }}
                  </p>
                </div>
              </div>
            </UCard>

            <!-- Décomposition champ par champ -->
            <UCard v-if="cron.fields.length" class="bg-surface ring-1 ring-line" :ui="{ body: 'p-0 sm:p-0' }">
              <template #header>
                <h2 class="font-medium text-ink">Champ par champ</h2>
              </template>

              <div class="divide-y divide-line">
                <div
                  v-for="field in cron.fields"
                  :key="field.field.name"
                  class="flex items-center gap-3 px-4 py-2"
                >
                  <code class="w-16 shrink-0 rounded bg-raised px-1.5 py-0.5 text-center font-mono text-xs text-accent">
                    {{ field.raw }}
                  </code>
                  <span class="w-32 shrink-0 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
                    {{ field.field.name }}
                  </span>
                  <span class="min-w-0 flex-1 text-sm text-ink-muted">{{ field.explanation }}</span>
                  <span
                    v-if="!field.wildcard"
                    class="shrink-0 font-mono text-[10px] text-ink-dim"
                    :title="field.values.join(', ')"
                  >
                    {{ field.values.length }} valeur(s)
                  </span>
                </div>
              </div>
            </UCard>

            <UCard v-if="cron.nextRuns.length" class="bg-surface ring-1 ring-line">
              <template #header>
                <h2 class="font-medium text-ink">Cinq prochaines exécutions</h2>
              </template>

              <ol class="space-y-1">
                <li
                  v-for="(run, index) in cron.nextRuns"
                  :key="run"
                  class="flex items-center gap-3 font-mono text-sm"
                >
                  <span class="w-4 text-ink-dim">{{ index + 1 }}</span>
                  <span class="text-ink">{{ run }}</span>
                </li>
              </ol>
            </UCard>
          </div>

          <UCard class="bg-surface ring-1 ring-line">
            <template #header>
              <h2 class="font-medium text-ink">Fréquences courantes</h2>
            </template>

            <div class="space-y-1">
              <button
                v-for="preset in CRON_PRESETS"
                :key="preset.expression"
                type="button"
                class="w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-left transition hover:border-accent/60"
                @click="cronInput = preset.expression"
              >
                <p class="text-xs text-ink">{{ preset.label }}</p>
                <p class="mt-0.5 font-mono text-[10px] text-accent">{{ preset.expression }}</p>
              </button>
            </div>
          </UCard>
        </div>
      </template>

      <!-- -------------------------------------------------------- Regex -->
      <template #regex>
        <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div class="space-y-4">
            <UCard class="bg-surface ring-1 ring-line">
              <UFormField label="Motif">
                <UInput
                  v-model="regexPattern"
                  size="xl"
                  class="w-full font-mono"
                  :color="regex.valid ? undefined : 'error'"
                />
              </UFormField>

              <div class="mt-3 flex flex-wrap items-center gap-1">
                <button
                  v-for="flag in availableFlags"
                  :key="flag"
                  type="button"
                  class="rounded border px-2 py-0.5 font-mono text-[11px] transition"
                  :class="regexFlags.includes(flag)
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-ink-dim hover:text-ink'"
                  :title="FLAG_LABELS[flag]"
                  @click="toggleFlag(flag)"
                >
                  {{ flag }}
                </button>
                <span class="ml-2 text-[11px] text-ink-dim">
                  {{ regexFlags.split('').map(f => FLAG_LABELS[f]).filter(Boolean).join(' · ') || 'aucune option' }}
                </span>
              </div>

              <p v-if="regex.error" class="mt-3 flex items-center gap-1.5 text-sm text-error-500">
                <UIcon name="i-lucide-circle-x" class="size-4 shrink-0" />
                {{ regex.error }}
              </p>
              <p v-else class="mt-3 flex items-center gap-1.5 text-sm text-success-500">
                <UIcon name="i-lucide-circle-check" class="size-4 shrink-0" />
                Motif valide · {{ regex.groupCount }} groupe(s) capturant(s)
              </p>
            </UCard>

            <!-- Décomposition du motif -->
            <UCard v-if="regex.tokens.length" class="bg-surface ring-1 ring-line" :ui="{ body: 'p-0 sm:p-0' }">
              <template #header>
                <h2 class="font-medium text-ink">Lecture du motif</h2>
              </template>

              <div class="divide-y divide-line">
                <div
                  v-for="(token, index) in regex.tokens"
                  :key="`${token.index}-${index}`"
                  class="flex items-start gap-3 px-4 py-1.5"
                >
                  <code
                    class="shrink-0 rounded bg-raised px-1.5 py-0.5 font-mono text-xs"
                    :class="tokenColor[token.kind]"
                  >{{ token.raw }}</code>
                  <span class="min-w-0 flex-1 text-sm text-ink-muted">{{ token.explanation }}</span>
                  <span class="shrink-0 font-mono text-[10px] uppercase text-ink-dim">{{ token.kind }}</span>
                </div>
              </div>
            </UCard>

            <!-- Banc d'essai -->
            <UCard class="bg-surface ring-1 ring-line">
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <h2 class="font-medium text-ink">Banc d'essai</h2>
                  <UBadge
                    :label="`${regex.matches.length} correspondance(s)`"
                    :color="regex.matches.length ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  />
                </div>
              </template>

              <UTextarea v-model="regexSample" :rows="3" class="w-full font-mono" placeholder="Texte à tester" />

              <div class="mt-3 rounded-md border border-line bg-canvas p-3 font-mono text-sm leading-relaxed">
                <span
                  v-for="(part, index) in highlighted"
                  :key="index"
                  :class="part.match ? 'rounded bg-accent-soft px-0.5 text-accent' : 'text-ink-muted'"
                >{{ part.text }}</span>
              </div>

              <div v-if="regex.matches.length" class="mt-3 space-y-1.5">
                <div
                  v-for="(match, index) in regex.matches.slice(0, 10)"
                  :key="index"
                  class="rounded-md border border-line bg-canvas px-2.5 py-1.5"
                >
                  <p class="font-mono text-xs text-accent">« {{ match.value }} » à la position {{ match.index }}</p>
                  <div v-if="match.groups.length" class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span
                      v-for="group in match.groups"
                      :key="group.name"
                      class="font-mono text-[10px] text-ink-dim"
                    >
                      {{ group.name }} : <span class="text-ink-muted">{{ group.value ?? '—' }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </UCard>
          </div>

          <UCard class="bg-surface ring-1 ring-line">
            <template #header>
              <h2 class="font-medium text-ink">Motifs types</h2>
            </template>

            <div class="space-y-1">
              <button
                v-for="preset in REGEX_PRESETS"
                :key="preset.label"
                type="button"
                class="w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-left transition hover:border-accent/60"
                @click="regexPattern = preset.pattern; regexFlags = preset.flags; regexSample = preset.sample"
              >
                <p class="text-xs text-ink">{{ preset.label }}</p>
                <p class="mt-0.5 truncate font-mono text-[10px] text-accent">{{ preset.pattern }}</p>
              </button>
            </div>
          </UCard>
        </div>
      </template>

      <!-- -------------------------------------------------- Serveur web -->
      <template #web>
        <div class="mt-4 space-y-4">
          <UCard class="bg-surface ring-1 ring-line">
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-2">
                <UBadge :label="sourceLabel" color="primary" variant="subtle" size="lg" />
                <UButton
                  icon="i-lucide-arrow-left-right"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  aria-label="Inverser le sens"
                  @click="swapDirection"
                />
                <UBadge :label="targetLabel" color="neutral" variant="subtle" size="lg" />
              </div>

              <div class="flex items-center gap-3 text-xs">
                <span class="flex items-center gap-1.5" :class="validation.valid ? 'text-success-500' : 'text-error-500'">
                  <UIcon :name="validation.valid ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-3.5" />
                  {{ validation.valid ? 'Source valide' : `${validation.issues.filter(i => i.severity === 'error').length} erreur(s)` }}
                </span>
                <span class="font-mono text-ink-dim">
                  {{ converted.translated }}/{{ converted.total }} directives converties
                </span>
              </div>

              <div class="ml-auto flex gap-2">
                <UButton icon="i-lucide-file-code" color="neutral" variant="ghost" size="xs" label="Exemple" @click="loadSample" />
                <UButton icon="i-lucide-copy" color="primary" variant="soft" size="xs" label="Copier le résultat" @click="copy(converted.output, targetLabel)" />
              </div>
            </div>
          </UCard>

          <div class="grid gap-4 lg:grid-cols-2">
            <UCard class="bg-surface ring-1 ring-line">
              <template #header>
                <h2 class="font-medium text-ink">{{ sourceLabel }}</h2>
              </template>

              <UTextarea
                v-model="source"
                :rows="18"
                class="w-full font-mono"
                :ui="{ base: 'text-[12px] leading-relaxed' }"
              />
            </UCard>

            <UCard class="bg-surface ring-1 ring-line">
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <h2 class="font-medium text-ink">{{ targetLabel }}</h2>
                  <UBadge
                    :label="targetValidation.valid ? 'structure valide' : 'à vérifier'"
                    :color="targetValidation.valid ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  />
                </div>
              </template>

              <pre class="max-h-96 overflow-auto rounded-md border border-line bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink-muted">{{ converted.output }}</pre>
            </UCard>
          </div>

          <!-- Constats de validation -->
          <UCard v-if="validation.issues.length || converted.issues.length" class="bg-surface ring-1 ring-line">
            <template #header>
              <h2 class="font-medium text-ink">Constats</h2>
            </template>

            <div class="space-y-1.5">
              <div
                v-for="(issue, index) in validation.issues"
                :key="`v${index}`"
                class="flex items-start gap-2 rounded-md border border-line border-l-2 bg-canvas px-2.5 py-1.5"
                :class="issue.severity === 'error' ? 'border-l-error-500' : 'border-l-warning-500'"
              >
                <UIcon
                  :name="severityIcon[issue.severity]!"
                  class="mt-0.5 size-3.5 shrink-0"
                  :class="issue.severity === 'error' ? 'text-error-500' : 'text-warning-500'"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-ink">Ligne {{ issue.line }} — {{ issue.message }}</p>
                  <p v-if="issue.hint" class="mt-0.5 text-[11px] text-ink-dim">{{ issue.hint }}</p>
                </div>
              </div>

              <div
                v-for="(issue, index) in converted.issues"
                :key="`c${index}`"
                class="flex items-start gap-2 rounded-md border border-line border-l-2 border-l-info-500 bg-canvas px-2.5 py-1.5"
              >
                <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0 text-info-500" />
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-ink">Ligne {{ issue.line }} non convertie</p>
                  <p class="mt-0.5 font-mono text-[11px] text-ink-dim">{{ issue.text }}</p>
                  <p class="mt-0.5 text-[11px] text-ink-dim">{{ issue.reason }}</p>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </template>
    </UTabs>
  </div>
</template>
