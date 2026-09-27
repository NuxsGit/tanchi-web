<script setup lang="ts">
import {
  ADMIN_LABELS, CAST_LABELS, MAC_FORMATS, MAC_SAMPLE, REGISTRY_LABELS,
  extractMacs, formatMac,
  type MacAnalysis, type MacCase, type MacFormat
} from '~~/shared/mac'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'MacChecker — Tanchi Web' })

const toast = useToast()

interface OuiMatch {
  vendor: string
  registry: string
  prefix: string
  delegated: boolean
}

/* ---------------------------------------------------------------- Saisie */

const raw = ref(MAC_SAMPLE)

/** L'analyse est locale : elle suit la frappe sans aller-retour serveur. */
const parsed = computed(() => extractMacs(raw.value))

const valid = computed(() => parsed.value.filter(item => item.valid))
const invalid = computed(() => parsed.value.filter(item => !item.valid))

/* ----------------------------------------------------------- Constructeur */

const vendors = ref<Record<string, OuiMatch | null>>({})
const registry = ref<{ updated: string, size: number } | null>(null)
const resolving = ref(false)

let lookupTimer: ReturnType<typeof setTimeout> | null = null

async function resolve() {
  const missing = [...new Set(
    valid.value
      .filter(item => item.administration === 'universelle')
      .map(item => item.normalized)
  )].filter(address => !(address in vendors.value))

  if (!missing.length) return

  resolving.value = true
  try {
    const response = await $fetch<{ results: Record<string, OuiMatch | null>, registry: { updated: string, size: number } }>(
      '/api/mac/lookup',
      { method: 'POST', body: { addresses: missing.slice(0, 2000) } }
    )
    vendors.value = { ...vendors.value, ...response.results }
    registry.value = response.registry
  } catch {
    toast.add({ title: 'Registre injoignable', description: 'Le type d\'adresse reste analysé.', color: 'warning' })
  } finally {
    resolving.value = false
  }
}

watch(parsed, () => {
  if (lookupTimer) clearTimeout(lookupTimer)
  lookupTimer = setTimeout(resolve, 350)
}, { immediate: true })

onBeforeUnmount(() => {
  if (lookupTimer) clearTimeout(lookupTimer)
})

/* -------------------------------------------------------------- Affichage */

const format = ref<MacFormat>('colon')
const casing = ref<MacCase>('lower')
const dedupe = ref(true)
const sort = ref<'source' | 'vendor' | 'address' | 'type'>('source')

const SORTS = [
  { value: 'source', label: 'Ordre de saisie' },
  { value: 'vendor', label: 'Constructeur' },
  { value: 'address', label: 'Adresse' },
  { value: 'type', label: 'Type' }
] as const

interface Row {
  analysis: MacAnalysis
  /** Nombre d'apparitions dans la saisie. */
  count: number
  lines: number[]
}

const rows = computed<Row[]>(() => {
  const list: Row[] = []
  const seen = new Map<string, Row>()

  for (const analysis of valid.value) {
    const existing = seen.get(analysis.normalized)

    if (existing && dedupe.value) {
      existing.count++
      existing.lines.push(analysis.line)
      continue
    }

    const row: Row = { analysis, count: 1, lines: [analysis.line] }
    if (!existing) seen.set(analysis.normalized, row)
    list.push(row)
  }

  const sorted = [...list]
  if (sort.value === 'address') {
    sorted.sort((a, b) => a.analysis.normalized.localeCompare(b.analysis.normalized))
  } else if (sort.value === 'vendor') {
    sorted.sort((a, b) =>
      vendorName(a.analysis).localeCompare(vendorName(b.analysis), 'fr')
      || a.analysis.normalized.localeCompare(b.analysis.normalized))
  } else if (sort.value === 'type') {
    sorted.sort((a, b) =>
      typeKey(a.analysis).localeCompare(typeKey(b.analysis))
      || a.analysis.normalized.localeCompare(b.analysis.normalized))
  }

  return sorted
})

function vendorName(analysis: MacAnalysis): string {
  if (analysis.administration === 'locale') return 'Adresse locale'
  const match = vendors.value[analysis.normalized]
  if (match === undefined) return '…'
  return match?.vendor ?? 'Préfixe non référencé'
}

function typeKey(analysis: MacAnalysis): string {
  return `${analysis.cast}-${analysis.administration}`
}

function display(analysis: MacAnalysis): string {
  return formatMac(analysis.bytes, format.value, casing.value)
}

/* --------------------------------------------------------------- Synthèse */

const summary = computed(() => {
  const list = rows.value.map(row => row.analysis)
  const universal = list.filter(item => item.administration === 'universelle')

  const brands = new Set(
    universal
      .map(item => vendors.value[item.normalized]?.vendor)
      .filter((name): name is string => Boolean(name))
  )

  return {
    total: parsed.value.length,
    unique: rows.value.length,
    invalid: invalid.value.length,
    unicast: list.filter(item => item.cast === 'unicast').length,
    multicast: list.filter(item => item.cast === 'multicast').length,
    broadcast: list.filter(item => item.cast === 'broadcast').length,
    local: list.filter(item => item.administration === 'locale').length,
    brands: brands.size
  }
})

/* --------------------------------------------------------------- Actions */

async function copy(value: string, label = 'Contenu') {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} copié`, color: 'success' })
  } catch {
    toast.add({ title: 'Copie impossible', color: 'error' })
  }
}

/** Réécrit la saisie dans le format retenu : c'est le « formatage en un clic ». */
function rewriteInput() {
  if (!rows.value.length) return
  raw.value = rows.value.map(row => display(row.analysis)).join('\n')
  toast.add({ title: 'Saisie reformatée', description: MAC_FORMATS.find(item => item.id === format.value)?.label, color: 'success' })
}

function copyAll() {
  copy(rows.value.map(row => display(row.analysis)).join('\n'), `${rows.value.length} adresse(s)`)
}

function copyCsv() {
  const header = 'adresse;constructeur;registre;portee;administration;particularite'
  const lines = rows.value.map(row => {
    const item = row.analysis
    const match = vendors.value[item.normalized]
    return [
      display(item),
      vendorName(item),
      match ? REGISTRY_LABELS[match.registry]?.label ?? '' : '',
      CAST_LABELS[item.cast].label,
      ADMIN_LABELS[item.administration].label,
      item.special?.label ?? item.virtual ?? ''
    ].map(field => field.replace(/;/g, ',')).join(';')
  })

  copy([header, ...lines].join('\n'), 'Rapport CSV')
}

const expanded = ref(new Set<string>())

function toggle(normalized: string) {
  const next = new Set(expanded.value)
  if (next.has(normalized)) next.delete(normalized)
  else next.add(normalized)
  expanded.value = next
}

const castColor: Record<string, 'neutral' | 'info' | 'warning'> = {
  unicast: 'neutral',
  multicast: 'info',
  broadcast: 'warning'
}
</script>

<template>
  <div class="space-y-4">
    <!-- En-tête -->
    <header class="overflow-hidden rounded-xl border border-line bg-surface">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
        <div class="flex items-center gap-2">
          <NuxtLink to="/apps" class="transition hover:text-ink">applications</NuxtLink>
          <span>/</span>
          <span class="text-accent">macchecker</span>
        </div>
        <span v-if="registry">
          registre IEEE · {{ registry.size.toLocaleString('fr-FR') }} préfixes · {{ registry.updated }}
        </span>
        <span v-else>registre IEEE embarqué</span>
      </div>

      <div class="flex items-center gap-2.5 p-4">
        <span class="flex size-9 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
          <UIcon name="i-lucide-scan-search" class="size-4.5 text-accent" />
        </span>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-ink">Tanchi MacChecker</h1>
          <p class="text-xs text-ink-dim">
            Collez des adresses MAC en vrac : constructeur, nature de l'adresse et reformatage en un clic
          </p>
        </div>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <!-- ----------------------------------------------------- Saisie -->
      <div class="space-y-4">
        <div class="rounded-xl border border-line bg-surface">
          <div class="flex items-center justify-between border-b border-line px-3 py-2">
            <h2 class="text-sm font-medium text-ink">Adresses</h2>
            <div class="flex gap-1">
              <UButton
                icon="i-lucide-file-text"
                color="neutral"
                variant="ghost"
                size="xs"
                label="Exemple"
                @click="raw = MAC_SAMPLE"
              />
              <UButton
                icon="i-lucide-eraser"
                color="neutral"
                variant="ghost"
                size="xs"
                label="Vider"
                @click="raw = ''"
              />
            </div>
          </div>

          <div class="p-3">
            <UTextarea
              v-model="raw"
              :rows="14"
              class="w-full font-mono"
              :ui="{ base: 'text-[12px] leading-relaxed' }"
              placeholder="00:1B:44:11:3A:B7&#10;0050.56c0.0008&#10;… ou collez une sortie de arp -a"
            />
            <p class="mt-2 text-[11px] leading-relaxed text-ink-dim">
              Tous les formats sont acceptés, mélangés, dans n'importe quel ordre.
              Une sortie de commande est ratissée ligne par ligne.
            </p>
          </div>
        </div>

        <!-- Synthèse -->
        <div class="rounded-xl border border-line bg-surface p-3">
          <p class="font-mono text-[11px] uppercase tracking-wider text-ink-dim">Synthèse</p>

          <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <span class="text-ink-muted">Adresses lues</span>
            <span class="text-right font-mono text-ink">{{ summary.total }}</span>

            <span class="text-ink-muted">Distinctes</span>
            <span class="text-right font-mono text-ink">{{ summary.unique }}</span>

            <span class="text-ink-muted">Unicast</span>
            <span class="text-right font-mono text-ink">{{ summary.unicast }}</span>

            <span class="text-ink-muted">Multicast</span>
            <span class="text-right font-mono text-ink">{{ summary.multicast }}</span>

            <span v-if="summary.broadcast" class="text-ink-muted">Diffusion</span>
            <span v-if="summary.broadcast" class="text-right font-mono text-ink">{{ summary.broadcast }}</span>

            <span class="text-ink-muted">Adresses locales</span>
            <span class="text-right font-mono text-ink">{{ summary.local }}</span>

            <span class="text-ink-muted">Constructeurs</span>
            <span class="text-right font-mono text-ink">{{ summary.brands }}</span>

            <template v-if="summary.invalid">
              <span class="text-error-500">Illisibles</span>
              <span class="text-right font-mono text-error-500">{{ summary.invalid }}</span>
            </template>
          </div>
        </div>

        <!-- Entrées rejetées -->
        <div v-if="invalid.length" class="rounded-xl border border-line bg-surface">
          <p class="border-b border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-error-500">
            Non reconnues
          </p>
          <div class="divide-y divide-line">
            <div v-for="(item, position) in invalid.slice(0, 12)" :key="position" class="px-3 py-2">
              <p class="truncate font-mono text-xs text-ink">{{ item.input }}</p>
              <p class="mt-0.5 text-[11px] text-ink-dim">Ligne {{ item.line }} — {{ item.error }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ---------------------------------------------------- Rapport -->
      <div class="space-y-4">
        <!-- Formatage -->
        <div class="rounded-xl border border-line bg-surface p-3">
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex flex-wrap gap-1">
              <button
                v-for="item in MAC_FORMATS"
                :key="item.id"
                type="button"
                class="rounded-md border px-2.5 py-1 text-left transition"
                :class="format === item.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-line hover:border-accent/50'"
                :title="item.hint"
                @click="format = item.id"
              >
                <span class="block font-mono text-[11px]" :class="format === item.id ? 'text-accent' : 'text-ink-muted'">
                  {{ item.sample }}
                </span>
                <span class="block text-[10px] text-ink-dim">{{ item.label }}</span>
              </button>
            </div>

            <div class="flex overflow-hidden rounded-md border border-line">
              <button
                type="button"
                class="px-2.5 py-1 font-mono text-[11px] transition"
                :class="casing === 'lower' ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:text-ink'"
                @click="casing = 'lower'"
              >
                ab
              </button>
              <button
                type="button"
                class="px-2.5 py-1 font-mono text-[11px] transition"
                :class="casing === 'upper' ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:text-ink'"
                @click="casing = 'upper'"
              >
                AB
              </button>
            </div>

            <div class="ml-auto flex flex-wrap gap-1.5">
              <UButton
                icon="i-lucide-wand-sparkles"
                color="primary"
                variant="soft"
                size="xs"
                label="Reformater la saisie"
                :disabled="!rows.length"
                @click="rewriteInput"
              />
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="outline"
                size="xs"
                label="Copier"
                :disabled="!rows.length"
                @click="copyAll"
              />
              <UButton
                icon="i-lucide-table"
                color="neutral"
                variant="outline"
                size="xs"
                label="CSV"
                :disabled="!rows.length"
                @click="copyCsv"
              />
            </div>
          </div>
        </div>

        <!-- Tableau -->
        <div class="overflow-hidden rounded-xl border border-line bg-surface">
          <div class="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <h2 class="text-sm font-medium text-ink">
              Rapport
              <span class="font-mono text-xs text-ink-dim">({{ rows.length }})</span>
            </h2>

            <UIcon v-if="resolving" name="i-lucide-loader-circle" class="size-3.5 animate-spin text-ink-dim" />

            <div class="ml-auto flex items-center gap-2">
              <label class="flex items-center gap-1.5 text-[11px] text-ink-dim">
                <input v-model="dedupe" type="checkbox" class="accent-current">
                Fusionner les doublons
              </label>

              <div class="flex overflow-hidden rounded-md border border-line">
                <button
                  v-for="item in SORTS"
                  :key="item.value"
                  type="button"
                  class="px-2 py-1 text-[11px] transition"
                  :class="sort === item.value ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:text-ink'"
                  @click="sort = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </div>

          <p v-if="!rows.length" class="px-3 py-10 text-center text-sm text-ink-dim">
            Aucune adresse pour l'instant.
          </p>

          <div v-else class="divide-y divide-line">
            <div v-for="row in rows" :key="`${row.analysis.normalized}-${row.analysis.line}`">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-raised"
                @click="toggle(row.analysis.normalized)"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-3.5 shrink-0 text-ink-dim transition-transform"
                  :class="{ 'rotate-90': expanded.has(row.analysis.normalized) }"
                />

                <!-- Adresse -->
                <span class="w-44 shrink-0 font-mono text-xs text-ink">
                  {{ display(row.analysis) }}
                  <span v-if="row.count > 1" class="ml-1 text-[10px] text-accent">×{{ row.count }}</span>
                </span>

                <!-- Constructeur -->
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-xs"
                    :class="row.analysis.administration === 'locale' ? 'italic text-ink-dim' : 'text-ink-muted'"
                  >
                    {{ vendorName(row.analysis) }}
                  </span>
                  <span
                    v-if="row.analysis.special || row.analysis.virtual"
                    class="block truncate text-[10px] text-accent"
                  >
                    {{ row.analysis.special?.label ?? row.analysis.virtual }}
                  </span>
                </span>

                <!-- Étiquettes -->
                <span class="flex shrink-0 items-center gap-1">
                  <UBadge
                    :label="CAST_LABELS[row.analysis.cast].label"
                    :color="castColor[row.analysis.cast]"
                    variant="subtle"
                    size="sm"
                  />
                  <UBadge
                    :label="ADMIN_LABELS[row.analysis.administration].label"
                    :color="row.analysis.administration === 'locale' ? 'warning' : 'success'"
                    variant="subtle"
                    size="sm"
                  />
                  <UBadge
                    v-if="row.analysis.bits === 64"
                    label="EUI-64"
                    color="info"
                    variant="subtle"
                    size="sm"
                  />
                </span>
              </button>

              <!-- Détail -->
              <div v-if="expanded.has(row.analysis.normalized)" class="border-t border-line bg-canvas px-3 py-3 pl-9">
                <div class="grid gap-3 sm:grid-cols-2">
                  <!-- Découpage -->
                  <div>
                    <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Découpage</p>
                    <div class="mt-1.5 space-y-1 text-xs">
                      <p class="flex justify-between gap-2">
                        <span class="text-ink-muted">Préfixe constructeur</span>
                        <span class="font-mono text-ink">{{ row.analysis.oui }}</span>
                      </p>
                      <p class="flex justify-between gap-2">
                        <span class="text-ink-muted">Partie interface</span>
                        <span class="font-mono text-ink">{{ row.analysis.nic }}</span>
                      </p>
                      <p v-if="vendors[row.analysis.normalized]" class="flex justify-between gap-2">
                        <span class="text-ink-muted">Registre</span>
                        <span class="font-mono text-ink">
                          {{ REGISTRY_LABELS[vendors[row.analysis.normalized]!.registry]?.label }}
                          ({{ REGISTRY_LABELS[vendors[row.analysis.normalized]!.registry]?.bits }} bits)
                        </span>
                      </p>
                      <p v-if="row.lines.length" class="flex justify-between gap-2">
                        <span class="text-ink-muted">Ligne(s)</span>
                        <span class="font-mono text-ink">{{ row.lines.join(', ') }}</span>
                      </p>
                    </div>
                  </div>

                  <!-- Nature -->
                  <div>
                    <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Nature</p>
                    <div class="mt-1.5 space-y-1.5 text-xs leading-relaxed text-ink-muted">
                      <p>{{ CAST_LABELS[row.analysis.cast].detail }}</p>
                      <p>{{ ADMIN_LABELS[row.analysis.administration].detail }}</p>
                      <p v-if="row.analysis.special" class="text-accent">
                        {{ row.analysis.special.label }} — {{ row.analysis.special.detail }}
                      </p>
                      <p v-if="row.analysis.virtual">
                        Préfixe employé par {{ row.analysis.virtual }}.
                      </p>
                      <p v-if="vendors[row.analysis.normalized]?.delegated" class="text-warning-500">
                        Bloc redécoupé par l'IEEE : le sous-bloc de cette adresse n'est pas dans l'instantané embarqué.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Dérivations -->
                <div v-if="row.analysis.derived.length" class="mt-3 border-t border-line pt-3">
                  <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Correspondances</p>
                  <div class="mt-1.5 space-y-1.5">
                    <div
                      v-for="item in row.analysis.derived"
                      :key="item.label"
                      class="flex flex-wrap items-baseline gap-x-2 text-xs"
                    >
                      <span class="text-ink-muted">{{ item.label }}</span>
                      <button
                        type="button"
                        class="font-mono text-accent transition hover:underline"
                        @click.stop="copy(item.value, item.label)"
                      >
                        {{ item.value }}
                      </button>
                      <span v-if="item.hint" class="w-full text-[10px] text-ink-dim">{{ item.hint }}</span>
                    </div>
                  </div>
                </div>

                <!-- Tous les formats -->
                <div class="mt-3 border-t border-line pt-3">
                  <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Formats</p>
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      v-for="item in MAC_FORMATS"
                      :key="item.id"
                      type="button"
                      class="rounded border border-line bg-surface px-2 py-1 font-mono text-[11px] text-ink-muted transition hover:border-accent/60 hover:text-accent"
                      :title="`Copier — ${item.label}`"
                      @click.stop="copy(formatMac(row.analysis.bytes, item.id, casing), item.label)"
                    >
                      {{ formatMac(row.analysis.bytes, item.id, casing) }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
