<script setup lang="ts">
const {
  diagramQuery, diagramStatus, diagramAction, selectedRelationKey,
  relationGroups, selectedRelation, diagramGraph, hasConflict
} = useFmd()

const statusItems = [
  { label: 'Actifs', value: 'ACTIVE' },
  { label: 'Validés', value: 'APPROVED' },
  { label: 'Pending', value: 'PENDING' }
]

const actionItems = [
  { label: 'Toutes', value: 'ALL' },
  { label: 'ALLOW', value: 'ALLOW' },
  { label: 'DENY', value: 'DENY' }
]

/** Reka UI refuse un SelectItem de valeur vide. */
const NO_RELATION = '__none__'

const relationItems = computed(() =>
  relationGroups.value.length
    ? relationGroups.value.map(relation => ({
        label: `${relation.source} → ${relation.destination} (${relation.flows.length})`,
        value: relation.key
      }))
    : [{ label: 'Aucun lien', value: NO_RELATION }]
)

const relationModel = computed({
  get: () => selectedRelationKey.value || NO_RELATION,
  set: (value: string) => { selectedRelationKey.value = value === NO_RELATION ? '' : value }
})

// Sélectionne le premier lien disponible dès que la liste change.
watch(relationGroups, (groups) => {
  if (!groups.length) {
    selectedRelationKey.value = ''
    return
  }
  if (!groups.some(relation => relation.key === selectedRelationKey.value)) {
    selectedRelationKey.value = groups[0]!.key
  }
}, { immediate: true })

const legend = [
  { label: 'Validé', color: '#10b98e' },
  { label: 'Pending', color: '#8fa3bc' },
  { label: 'Deny', color: '#dc2626' },
  { label: 'Conflit', color: '#f59e0b' }
]

/** Couleur d'un lien : deny prioritaire, puis tout-validé, sinon neutre. */
function edgeColor(relation: { flows: { action: string, status: string }[] }) {
  if (relation.flows.some(flow => flow.action === 'DENY')) return '#dc2626'
  if (relation.flows.every(flow => flow.status === 'APPROVED')) return '#10b98e'
  return '#8fa3bc'
}

function edgePath(source: { x: number, y: number }, destination: { x: number, y: number }) {
  const midX = (source.x + destination.x) / 2
  return `M ${source.x + 110} ${source.y} C ${midX - 120} ${source.y}, ${midX + 120} ${destination.y}, ${destination.x - 110} ${destination.y}`
}

const node = (key: string) => diagramGraph.value.nodeMap.get(key)
</script>

<template>
  <UCard class="bg-surface ring-1 ring-line">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-medium text-ink">Diagramme des flux</h2>
        <div class="flex flex-wrap items-center gap-3">
          <span v-for="item in legend" :key="item.label" class="flex items-center gap-1.5 text-xs text-ink-muted">
            <span class="size-2 rounded-full" :style="{ backgroundColor: item.color }" />
            {{ item.label }}
          </span>
        </div>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <UFormField label="Objet">
        <UInput
          v-model="diagramQuery"
          placeholder="Filtrer source ou destination"
          size="sm"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Statut">
        <USelect v-model="diagramStatus" :items="statusItems" size="sm" class="w-full" />
      </UFormField>
      <UFormField label="Action">
        <USelect v-model="diagramAction" :items="actionItems" size="sm" class="w-full" />
      </UFormField>
      <UFormField label="Lien">
        <USelect v-model="relationModel" :items="relationItems" size="sm" class="w-full" />
      </UFormField>
    </div>

    <!-- Détail du lien sélectionné -->
    <div class="mt-4 rounded-lg border border-line bg-raised p-3">
      <template v-if="selectedRelation">
        <p class="text-sm font-medium text-ink">
          {{ selectedRelation.source }} → {{ selectedRelation.destination }}
        </p>
        <p class="text-xs text-ink-dim">
          {{ selectedRelation.flows.length }} flux actif{{ selectedRelation.flows.length > 1 ? 's' : '' }}
        </p>

        <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            v-for="flow in selectedRelation.flows"
            :key="flow.id"
            class="rounded-md border-l-2 border-line bg-surface p-2"
            :class="flow.action === 'DENY'
              ? 'border-l-error-500'
              : flow.status === 'PENDING' ? 'border-l-ink-dim' : 'border-l-success-500'"
          >
            <p class="text-xs font-medium text-ink">
              {{ flow.application || 'Application libre' }} — {{ flow.protocol }}
            </p>
            <p class="mt-0.5 text-[11px] text-ink-dim">
              {{ flow.status }} | {{ flow.fromZone }} → {{ flow.toZone }} | {{ flow.action }}
            </p>
            <UBadge
              v-if="hasConflict(flow)"
              label="CONFLIT"
              color="warning"
              variant="subtle"
              size="sm"
              class="mt-1"
            />
            <p v-if="flow.comment" class="mt-1 text-[11px] text-ink-muted">{{ flow.comment }}</p>
          </div>
        </div>
      </template>
      <p v-else class="text-sm text-ink-dim">Aucun lien sélectionné.</p>
    </div>

    <!-- Graphe nodal -->
    <div class="mt-4 overflow-x-auto rounded-lg border border-line bg-raised">
      <svg
        v-if="relationGroups.length"
        class="w-full min-w-[720px]"
        :viewBox="`0 0 ${diagramGraph.width} ${diagramGraph.height}`"
        role="img"
        aria-label="Diagramme des flux"
      >
        <defs>
          <linearGradient id="fmdEdgeSelected" x1="0" x2="1">
            <stop offset="0%" stop-color="#34E1BC" />
            <stop offset="100%" stop-color="#5B8CFF" />
          </linearGradient>
        </defs>

        <g
          v-for="relation in relationGroups"
          :key="relation.key"
          class="cursor-pointer"
          @click="selectedRelationKey = relation.key"
        >
          <template v-if="node(`source:${relation.source}`) && node(`destination:${relation.destination}`)">
            <path
              :d="edgePath(node(`source:${relation.source}`)!, node(`destination:${relation.destination}`)!)"
              fill="none"
              :stroke="relation.key === selectedRelationKey ? 'url(#fmdEdgeSelected)' : edgeColor(relation)"
              :stroke-width="relation.key === selectedRelationKey ? 3 : 1.75"
              :opacity="relation.key === selectedRelationKey ? 1 : 0.65"
            />
            <rect
              :x="(node(`source:${relation.source}`)!.x + node(`destination:${relation.destination}`)!.x) / 2 - 38"
              :y="(node(`source:${relation.source}`)!.y + node(`destination:${relation.destination}`)!.y) / 2 - 15"
              width="76"
              height="30"
              rx="15"
              class="fill-[var(--t-surface)] stroke-[var(--t-line-strong)]"
            />
            <text
              :x="(node(`source:${relation.source}`)!.x + node(`destination:${relation.destination}`)!.x) / 2"
              :y="(node(`source:${relation.source}`)!.y + node(`destination:${relation.destination}`)!.y) / 2 + 4"
              text-anchor="middle"
              class="fill-[var(--t-ink-muted)] text-[12px]"
            >
              {{ relation.flows.length }} flux
            </text>
          </template>
        </g>

        <g v-for="name in diagramGraph.sourceNames" :key="`source:${name}`">
          <rect
            :x="node(`source:${name}`)!.x - 110"
            :y="node(`source:${name}`)!.y - 26"
            width="220"
            height="52"
            rx="18"
            class="stroke-[var(--t-line-strong)]"
            :class="selectedRelation?.source === name ? 'fill-[var(--t-accent-soft)]' : 'fill-[var(--t-surface)]'"
          />
          <text
            :x="node(`source:${name}`)!.x"
            :y="node(`source:${name}`)!.y + 5"
            text-anchor="middle"
            class="fill-[var(--t-ink)] text-[13px] font-medium"
          >
            {{ name }}
          </text>
        </g>

        <g v-for="name in diagramGraph.destinationNames" :key="`destination:${name}`">
          <rect
            :x="node(`destination:${name}`)!.x - 110"
            :y="node(`destination:${name}`)!.y - 26"
            width="220"
            height="52"
            rx="18"
            class="stroke-[var(--t-line-strong)]"
            :class="selectedRelation?.destination === name ? 'fill-[var(--t-accent-soft)]' : 'fill-[var(--t-surface)]'"
          />
          <text
            :x="node(`destination:${name}`)!.x"
            :y="node(`destination:${name}`)!.y + 5"
            text-anchor="middle"
            class="fill-[var(--t-ink)] text-[13px] font-medium"
          >
            {{ name }}
          </text>
        </g>
      </svg>

      <p v-else class="py-16 text-center text-sm text-ink-dim">
        Aucun flux à afficher dans le diagramme.
      </p>
    </div>
  </UCard>
</template>
