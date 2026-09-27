<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import {
  allocateVlsm,
  cidrToString,
  describe,
  findConflicts,
  normalizePlan,
  parseCidr,
  prefixForHosts,
  split,
  summarize,
  usableHosts,
  type SubnetEntry,
  type SubnetPlan
} from '~~/shared/subnet'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'SubNet — Tanchi Web' })

const toast = useToast()

/* --------------------------------------------------------- Calculateur */

const input = ref('192.168.1.0/24')
const info = computed(() => describe(input.value))

/** Raccourcis de préfixe : l'essentiel du quotidien tient en une ligne. */
const quickPrefixes = [30, 29, 28, 27, 26, 25, 24, 23, 22, 20, 16, 8]

function setPrefix(prefix: number) {
  const cidr = parseCidr(input.value)
  if (!cidr) return
  input.value = cidrToString({ address: cidr.address, prefix })
}

async function copy(value: string, label = 'Valeur') {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} copié`, description: value, color: 'success' })
  } catch {
    toast.add({ title: 'Copie impossible', color: 'error' })
  }
}

const rows = computed(() => {
  const data = info.value
  if (!data) return []
  return [
    { label: 'Réseau', value: data.network },
    { label: 'Masque', value: data.mask },
    { label: 'Masque inverse', value: data.wildcard },
    { label: 'Diffusion', value: data.broadcast },
    { label: 'Première adresse', value: data.firstHost ?? '—' },
    { label: 'Dernière adresse', value: data.lastHost ?? '—' },
    { label: 'Adresses attribuables', value: data.usableHosts.toLocaleString('fr-FR') },
    { label: 'Adresses totales', value: data.totalAddresses.toLocaleString('fr-FR') },
    { label: 'Bloc parent', value: data.parent ?? '—' }
  ]
})

const scopeColor: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  'privée': 'success',
  'publique': 'warning',
  'loopback': 'neutral',
  'lien-local': 'info',
  'multicast': 'info',
  'réservée': 'error'
}

/* -------------------------------------------------------- Découpage */

const splitPrefix = ref(26)

const splitResult = computed(() => {
  const cidr = parseCidr(input.value)
  if (!cidr || splitPrefix.value < cidr.prefix) return null
  return split(cidr, splitPrefix.value, 256)
})

const splitItems = computed(() =>
  Array.from({ length: 33 }, (_, index) => index)
    .filter(prefix => prefix >= (info.value?.prefix ?? 0))
    .map(prefix => ({
      label: `/${prefix} · ${usableHosts(prefix).toLocaleString('fr-FR')} hôtes`,
      value: prefix
    }))
)

/* ---------------------------------------------------- Dimensionnement */

interface Need { id: string; name: string; hosts: number }

const parent = ref('10.0.0.0/22')
const needs = ref<Need[]>([
  { id: 'n1', name: 'Postes', hosts: 200 },
  { id: 'n2', name: 'Serveurs', hosts: 100 },
  { id: 'n3', name: 'Wi-Fi', hosts: 50 },
  { id: 'n4', name: 'Liaison inter-routeurs', hosts: 2 }
])

function addNeed() {
  needs.value.push({ id: `n${Date.now().toString(36)}`, name: '', hosts: 10 })
}

function removeNeed(id: string) {
  needs.value = needs.value.filter(need => need.id !== id)
}

const vlsm = computed(() => {
  const cidr = parseCidr(parent.value)
  if (!cidr) return null
  return allocateVlsm(cidr, needs.value.filter(need => need.hosts > 0).map(need => ({
    name: need.name.trim() || 'Sans nom',
    hosts: need.hosts
  })))
})

const occupancy = computed(() => {
  if (!vlsm.value) return 0
  return Math.round((vlsm.value.usedAddresses / vlsm.value.totalAddresses) * 100)
})

function exportVlsm() {
  if (!vlsm.value) return
  const header = 'Nom,CIDR,Masque,Première,Dernière,Diffusion,Disponibles,Demandées'
  const lines = vlsm.value.allocations.map(item =>
    [item.name, item.cidr, item.mask, item.firstHost, item.lastHost, item.broadcast, item.usableHosts, item.hosts].join(',')
  )
  copy([header, ...lines].join('\n'), 'Tableau CSV')
}

/** Bascule les attributions VLSM dans le plan enregistré. */
function pushToPlan() {
  if (!vlsm.value) return

  for (const allocation of vlsm.value.allocations) {
    plan.value.entries.push({
      id: `s${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: allocation.name,
      cidr: allocation.cidr
    })
  }

  toast.add({ title: `${vlsm.value.allocations.length} réseaux ajoutés au plan`, color: 'success' })
  tab.value = 'plan'
}

/* ------------------------------------------------- Plan d'adressage */

const doc = useDocument<SubnetPlan>('subnet')
const plan = ref<SubnetPlan>({ entries: [] })
const scope = ref<'user' | 'team'>('user')
const teamId = ref<number | null>(null)
const { teams, ensure } = useTeams()

const scopeRef = computed(() => ({ scope: scope.value, teamId: teamId.value ?? undefined }))

const scopeItems = computed(() => [
  { label: 'Personnel', value: 'user' },
  ...teams.value.map(team => ({ label: `Équipe · ${team.name}`, value: `team:${team.id}` }))
])

const scopeModel = computed({
  get: () => (scope.value === 'team' && teamId.value ? `team:${teamId.value}` : 'user'),
  set: (value: string) => {
    if (value === 'user') {
      scope.value = 'user'
      teamId.value = null
    } else {
      scope.value = 'team'
      teamId.value = Number(value.split(':')[1])
    }
    void load()
  }
})

async function load() {
  try {
    const document = await doc.load(scopeRef.value)
    plan.value = document.data ? normalizePlan(document.data) : { entries: [] }
  } catch {
    plan.value = { entries: [] }
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

watch(plan, () => {
  clearTimeout(timer)
  timer = setTimeout(() => doc.save(scopeRef.value, plan.value), 900)
}, { deep: true })

onBeforeUnmount(() => clearTimeout(timer))
onMounted(async () => {
  await Promise.all([load(), ensure()])
})

const newEntry = reactive({ name: '', cidr: '', vlan: '' })

function addEntry() {
  const cidr = parseCidr(newEntry.cidr)
  if (!cidr) {
    toast.add({ title: 'Bloc invalide', description: 'Exemple : 10.0.0.0/24', color: 'error' })
    return
  }

  plan.value.entries.push({
    id: `s${Date.now().toString(36)}`,
    name: newEntry.name.trim() || 'Sans nom',
    cidr: cidrToString(cidr),
    vlan: Number(newEntry.vlan) > 0 ? Number(newEntry.vlan) : undefined
  })

  newEntry.name = ''
  newEntry.cidr = ''
  newEntry.vlan = ''
}

function removeEntry(id: string) {
  plan.value.entries = plan.value.entries.filter(entry => entry.id !== id)
}

const conflicts = computed(() => findConflicts(plan.value.entries))

const planSummary = computed(() => {
  const cidrs = plan.value.entries.map(entry => parseCidr(entry.cidr)).filter(Boolean)
  if (!cidrs.length) return null
  const block = summarize(cidrs as never)
  return block ? cidrToString(block) : null
})

const planTotal = computed(() =>
  plan.value.entries.reduce((sum, entry) => {
    const cidr = parseCidr(entry.cidr)
    return sum + (cidr ? usableHosts(cidr.prefix) : 0)
  }, 0)
)

function detail(entry: SubnetEntry) {
  return describe(entry.cidr)
}

/* -------------------------------------------------------------- Onglets */

const tab = ref('calc')

const tabs: TabsItem[] = [
  { value: 'calc', slot: 'calc', label: 'Calculateur', icon: 'i-lucide-calculator' },
  { value: 'vlsm', slot: 'vlsm', label: 'Dimensionnement', icon: 'i-lucide-ruler' },
  { value: 'split', slot: 'split', label: 'Découpage', icon: 'i-lucide-scissors' },
  { value: 'plan', slot: 'plan', label: 'Plan d\'adressage', icon: 'i-lucide-list-tree' }
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
          <span class="text-accent">subnet</span>
        </div>
        <span>{{ doc.savedLabel.value }}</span>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 p-4">
        <div class="flex items-center gap-2.5">
          <span class="flex size-9 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-accent/30">
            <UIcon name="i-lucide-calculator" class="size-4.5 text-accent" />
          </span>
          <div>
            <h1 class="text-lg font-semibold tracking-tight text-ink">Tanchi SubNet</h1>
            <p class="text-xs text-ink-dim">Masques, plages et découpage CIDR sans mémo ni ligne de commande</p>
          </div>
        </div>

        <USelect v-model="scopeModel" :items="scopeItems" icon="i-lucide-users" size="sm" class="w-52" />
      </div>
    </header>

    <UTabs v-model="tab" :items="tabs" :unmount-on-hide="false" variant="link" class="w-full">
      <!-- ------------------------------------------------- Calculateur -->
      <template #calc>
        <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="space-y-4">
            <UCard class="bg-surface ring-1 ring-line">
              <UFormField label="Adresse ou bloc" hint="10.0.0.0/24, 10.0.0.5 255.255.255.0, ou une adresse seule">
                <UInput
                  v-model="input"
                  size="xl"
                  class="w-full font-mono"
                  placeholder="192.168.1.0/24"
                  :color="info ? undefined : 'error'"
                />
              </UFormField>

              <div class="mt-3 flex flex-wrap gap-1">
                <button
                  v-for="prefix in quickPrefixes"
                  :key="prefix"
                  type="button"
                  class="rounded border px-2 py-0.5 font-mono text-[11px] transition"
                  :class="info?.prefix === prefix
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-ink-dim hover:border-line-strong hover:text-ink'"
                  :title="`${usableHosts(prefix).toLocaleString('fr-FR')} adresses attribuables`"
                  @click="setPrefix(prefix)"
                >
                  /{{ prefix }}
                </button>
              </div>

              <p v-if="!info" class="mt-3 text-sm text-error-500">
                Bloc non reconnu. Attendu : une adresse IPv4, éventuellement suivie d'un préfixe.
              </p>
            </UCard>

            <UCard v-if="info" class="bg-surface ring-1 ring-line" :ui="{ body: 'p-0 sm:p-0' }">
              <div class="divide-y divide-line">
                <button
                  v-for="row in rows"
                  :key="row.label"
                  type="button"
                  class="group flex w-full items-center justify-between gap-4 px-4 py-2 text-left transition hover:bg-raised"
                  @click="copy(row.value, row.label)"
                >
                  <span class="text-sm text-ink-muted">{{ row.label }}</span>
                  <span class="flex items-center gap-2">
                    <span class="font-mono text-sm text-ink">{{ row.value }}</span>
                    <UIcon name="i-lucide-copy" class="size-3 text-ink-dim opacity-0 transition group-hover:opacity-100" />
                  </span>
                </button>
              </div>
            </UCard>
          </div>

          <div v-if="info" class="space-y-4">
            <UCard class="bg-surface ring-1 ring-line">
              <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Bloc</p>
              <p class="mt-1 font-mono text-xl font-semibold text-accent">{{ info.cidr }}</p>

              <div class="mt-3 flex flex-wrap gap-1.5">
                <UBadge :label="info.scope" :color="scopeColor[info.scope]" variant="subtle" size="sm" />
                <UBadge :label="`Classe ${info.class}`" color="neutral" variant="subtle" size="sm" />
                <UBadge :label="`/${info.prefix}`" color="neutral" variant="subtle" size="sm" />
              </div>

              <p class="mt-4 font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                Binaire — réseau | hôte
              </p>
              <p class="mt-1 break-all font-mono text-[11px] leading-relaxed text-ink-muted">
                {{ info.binary }}
              </p>
            </UCard>

            <UCard class="bg-surface ring-1 ring-line">
              <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Capacité</p>
              <p class="mt-1 text-3xl font-semibold text-ink">
                {{ info.usableHosts.toLocaleString('fr-FR') }}
              </p>
              <p class="text-xs text-ink-dim">adresses attribuables</p>

              <p v-if="info.prefix === 31" class="mt-3 text-[11px] leading-snug text-ink-muted">
                Un /31 est une liaison point à point : les deux adresses servent, sans réseau ni diffusion (RFC 3021).
              </p>
              <p v-else-if="info.prefix === 32" class="mt-3 text-[11px] leading-snug text-ink-muted">
                Un /32 désigne un hôte unique, typiquement une adresse de bouclage.
              </p>
            </UCard>
          </div>
        </div>
      </template>

      <!-- --------------------------------------------- Dimensionnement -->
      <template #vlsm>
        <div class="mt-4 space-y-4">
          <UCard class="bg-surface ring-1 ring-line">
            <div class="flex flex-wrap items-end gap-3">
              <UFormField label="Bloc à découper" class="min-w-56">
                <UInput v-model="parent" size="lg" class="w-full font-mono" placeholder="10.0.0.0/22" />
              </UFormField>

              <div v-if="vlsm" class="flex-1">
                <p class="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                  <span>Occupation</span>
                  <span>{{ occupancy }} % · {{ vlsm.usedAddresses.toLocaleString('fr-FR') }}/{{ vlsm.totalAddresses.toLocaleString('fr-FR') }}</span>
                </p>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="occupancy > 90 ? 'bg-warning-500' : 'bg-accent-fill'"
                    :style="{ width: `${Math.min(100, occupancy)}%` }"
                  />
                </div>
              </div>

              <UButton icon="i-lucide-plus" color="neutral" variant="outline" size="sm" label="Besoin" @click="addNeed" />
            </div>

            <!-- Besoins exprimés en nombre de machines -->
            <div class="mt-4 space-y-1.5">
              <div
                v-for="need in needs"
                :key="need.id"
                class="grid grid-cols-[minmax(0,1fr)_6rem_5rem_2rem] items-center gap-2"
              >
                <UInput v-model="need.name" placeholder="Nom du réseau" size="sm" />
                <UInput v-model.number="need.hosts" type="number" size="sm" :ui="{ base: 'font-mono' }" />
                <span class="font-mono text-[11px] text-ink-dim">
                  → /{{ prefixForHosts(need.hosts || 1) }}
                </span>
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Retirer ${need.name}`"
                  @click="removeNeed(need.id)"
                />
              </div>
              <p class="pt-1 font-mono text-[10px] text-ink-dim">nom · machines · préfixe déduit</p>
            </div>
          </UCard>

          <UCard v-if="vlsm" class="bg-surface ring-1 ring-line" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="font-medium text-ink">Attribution</h2>
                <div class="flex gap-2">
                  <UButton icon="i-lucide-copy" color="neutral" variant="outline" size="xs" label="Copier en CSV" @click="exportVlsm" />
                  <UButton icon="i-lucide-list-plus" color="primary" size="xs" label="Ajouter au plan" @click="pushToPlan" />
                </div>
              </div>
            </template>

            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-dim">
                    <th class="px-3 py-2">Réseau</th>
                    <th class="px-3 py-2">CIDR</th>
                    <th class="px-3 py-2">Masque</th>
                    <th class="px-3 py-2">Plage utilisable</th>
                    <th class="px-3 py-2">Diffusion</th>
                    <th class="px-3 py-2 text-right">Dispo</th>
                    <th class="px-3 py-2 text-right">Perdues</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="allocation in vlsm.allocations"
                    :key="allocation.cidr"
                    class="border-b border-line text-xs transition hover:bg-raised"
                  >
                    <td class="px-3 py-2 font-medium text-ink">{{ allocation.name }}</td>
                    <td class="px-3 py-2 font-mono text-accent">{{ allocation.cidr }}</td>
                    <td class="px-3 py-2 font-mono text-ink-muted">{{ allocation.mask }}</td>
                    <td class="px-3 py-2 font-mono text-ink-muted">
                      {{ allocation.firstHost }} – {{ allocation.lastHost }}
                    </td>
                    <td class="px-3 py-2 font-mono text-ink-dim">{{ allocation.broadcast }}</td>
                    <td class="px-3 py-2 text-right font-mono text-ink">{{ allocation.usableHosts }}</td>
                    <td
                      class="px-3 py-2 text-right font-mono"
                      :class="allocation.waste > allocation.hosts ? 'text-warning-500' : 'text-ink-dim'"
                    >
                      {{ allocation.waste }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <template #footer>
              <div class="space-y-2">
                <div v-if="vlsm.rejected.length" class="rounded-md border border-error-500/30 bg-error-500/5 p-2">
                  <p class="text-xs font-medium text-error-500">Demandes non satisfaites</p>
                  <p
                    v-for="item in vlsm.rejected"
                    :key="item.name"
                    class="mt-0.5 text-[11px] text-ink-muted"
                  >
                    {{ item.name }} ({{ item.hosts }} machines) — {{ item.reason }}
                  </p>
                </div>

                <div v-if="vlsm.free.length">
                  <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Blocs restants</p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <button
                      v-for="block in vlsm.free"
                      :key="block"
                      type="button"
                      class="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted transition hover:border-accent hover:text-accent"
                      @click="copy(block, 'Bloc libre')"
                    >
                      {{ block }}
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </UCard>
        </div>
      </template>

      <!-- ---------------------------------------------------- Découpage -->
      <template #split>
        <div class="mt-4 space-y-4">
          <UCard class="bg-surface ring-1 ring-line">
            <div class="flex flex-wrap items-end gap-3">
              <UFormField label="Bloc" class="min-w-56">
                <UInput v-model="input" size="lg" class="w-full font-mono" />
              </UFormField>
              <UFormField label="Découper en" class="w-56">
                <USelect v-model="splitPrefix" :items="splitItems" size="lg" class="w-full" />
              </UFormField>
              <p v-if="splitResult" class="pb-2 font-mono text-xs text-ink-dim">
                {{ splitResult.total.toLocaleString('fr-FR') }} sous-réseaux
                <span v-if="splitResult.truncated"> · {{ splitResult.subnets.length }} affichés</span>
              </p>
            </div>
          </UCard>

          <div v-if="splitResult?.subnets.length" class="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            <button
              v-for="subnet in splitResult.subnets"
              :key="subnet.address"
              type="button"
              class="rounded-md border border-line bg-surface px-2.5 py-1.5 text-left transition hover:border-accent/60"
              @click="copy(cidrToString(subnet), 'Sous-réseau')"
            >
              <p class="font-mono text-xs text-accent">{{ cidrToString(subnet) }}</p>
              <p class="mt-0.5 font-mono text-[10px] text-ink-dim">
                {{ describe(subnet)?.firstHost }} – {{ describe(subnet)?.lastHost }}
              </p>
            </button>
          </div>

          <UCard v-else class="bg-surface ring-1 ring-line">
            <p class="py-6 text-center text-sm text-ink-dim">
              Choisissez un préfixe plus long que celui du bloc pour le découper.
            </p>
          </UCard>
        </div>
      </template>

      <!-- ---------------------------------------------- Plan d'adressage -->
      <template #plan>
        <div class="mt-4 space-y-4">
          <UAlert
            v-if="conflicts.length"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`${conflicts.length} chevauchement(s) dans le plan`"
            :description="conflicts.map(c => `${c.a.name} (${c.a.cidr}) recouvre ${c.b.name} (${c.b.cidr})`).join(' · ')"
          />

          <UCard class="bg-surface ring-1 ring-line">
            <div class="grid grid-cols-[minmax(0,1fr)_10rem_5rem_auto] items-end gap-2">
              <UFormField label="Nom" size="xs">
                <UInput v-model="newEntry.name" placeholder="VLAN Serveurs" size="sm" class="w-full" />
              </UFormField>
              <UFormField label="Bloc" size="xs">
                <UInput
                  v-model="newEntry.cidr"
                  placeholder="10.0.10.0/24"
                  size="sm"
                  class="w-full font-mono"
                  @keydown.enter="addEntry"
                />
              </UFormField>
              <UFormField label="VLAN" size="xs">
                <UInput v-model="newEntry.vlan" type="number" placeholder="10" size="sm" class="w-full" />
              </UFormField>
              <UButton icon="i-lucide-plus" color="primary" size="sm" label="Ajouter" @click="addEntry" />
            </div>
          </UCard>

          <UCard v-if="plan.entries.length" class="bg-surface ring-1 ring-line" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 class="font-medium text-ink">{{ plan.entries.length }} réseaux</h2>
                  <p class="mt-0.5 font-mono text-[11px] text-ink-dim">
                    {{ planTotal.toLocaleString('fr-FR') }} adresses attribuables
                    <span v-if="planSummary"> · agrégat {{ planSummary }}</span>
                  </p>
                </div>
                <UBadge
                  v-if="scope === 'team'"
                  label="Partagé avec l'équipe"
                  color="primary"
                  variant="subtle"
                  size="sm"
                />
              </div>
            </template>

            <div class="divide-y divide-line">
              <div
                v-for="entry in plan.entries"
                :key="entry.id"
                class="flex flex-wrap items-center gap-3 px-4 py-2"
              >
                <span class="min-w-32 flex-1 truncate text-sm text-ink">{{ entry.name }}</span>
                <span class="font-mono text-xs text-accent">{{ entry.cidr }}</span>
                <UBadge v-if="entry.vlan" :label="`VLAN ${entry.vlan}`" size="sm" variant="subtle" color="neutral" />
                <span class="font-mono text-[11px] text-ink-dim">
                  {{ detail(entry)?.firstHost }} – {{ detail(entry)?.lastHost }}
                </span>
                <span class="font-mono text-[11px] text-ink-muted">
                  {{ detail(entry)?.usableHosts.toLocaleString('fr-FR') }} hôtes
                </span>
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Copier"
                  @click="copy(entry.cidr, entry.name)"
                />
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Retirer ${entry.name}`"
                  @click="removeEntry(entry.id)"
                />
              </div>
            </div>
          </UCard>

          <UCard v-else class="bg-surface ring-1 ring-line">
            <div class="py-10 text-center">
              <UIcon name="i-lucide-list-tree" class="mx-auto size-7 text-ink-dim" />
              <p class="mt-3 text-sm text-ink-muted">
                Aucun réseau enregistré. Ajoutez-en un, ou générez-les depuis l'onglet Dimensionnement.
              </p>
            </div>
          </UCard>
        </div>
      </template>
    </UTabs>
  </div>
</template>
