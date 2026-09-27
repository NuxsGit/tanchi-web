<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { statusLabel, type Flow } from '~~/shared/fmd'

const {
  flows, displayedFlows, tableQuery, selectedFlowIds,
  hasConflict, isSelected, sectionOf,
  toggleFlowSelection, toggleAllSelection,
  moveFlow, updateFlowStatus, editFlow, duplicateFlow, deleteFlow
} = useFmd()

const columns: TableColumn<Flow>[] = [
  { id: 'select', header: '' },
  { accessorKey: 'ruleName', header: 'Rule Name' },
  { accessorKey: 'source', header: 'Src' },
  { accessorKey: 'nomSource', header: 'Nom source' },
  { accessorKey: 'destination', header: 'Dst' },
  { accessorKey: 'nomDestination', header: 'Nom destination' },
  { accessorKey: 'application', header: 'App' },
  { accessorKey: 'protocol', header: 'Port/Protocol' },
  { accessorKey: 'action', header: 'Action' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions' }
]

const allSelected = computed(() =>
  displayedFlows.value.length > 0 && displayedFlows.value.every(flow => isSelected(flow.id))
)

/** Position réelle dans la matrice (et non dans la vue filtrée). */
const indexInMatrix = (flow: Flow) => flows.value.findIndex(item => item.id === flow.id)

const statusColor = (status: Flow['status']) =>
  status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'neutral'

// Surlignage par ligne : conflit, statut, sélection — et liseré de section.
const tableMeta = computed(() => ({
  class: {
    tr: (row: { original: Flow }) => [
      'border-l-2',
      sectionOf(row.original) ? '' : 'border-l-transparent',
      hasConflict(row.original) ? 'bg-warning-500/5' : '',
      row.original.status === 'APPROVED' ? 'bg-success-500/5' : '',
      row.original.status === 'REJECTED' ? 'opacity-60' : '',
      isSelected(row.original.id) ? 'bg-accent-soft' : ''
    ].filter(Boolean).join(' ')
  },
  style: {
    tr: (row: { original: Flow }) => ({
      borderLeftColor: sectionOf(row.original)?.color ?? 'transparent'
    })
  }
}))
</script>

<template>
  <UCard class="bg-surface ring-1 ring-line" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-medium text-ink">Matrice</h2>
          <p class="mt-0.5 text-sm text-ink-dim">
            {{ displayedFlows.length }} sur {{ flows.length }} flux
            <span v-if="selectedFlowIds.length"> · {{ selectedFlowIds.length }} sélectionné(s)</span>
          </p>
        </div>
        <UInput
          v-model="tableQuery"
          icon="i-lucide-search"
          placeholder="Rechercher dans les flux"
          size="sm"
          class="w-full max-w-xs"
        />
      </div>
    </template>

    <div class="overflow-x-auto">
      <UTable
        :data="displayedFlows"
        :columns="columns"
        :meta="tableMeta"
        class="w-full"
        :ui="{
          td: 'px-2 py-2 text-xs align-middle',
          th: 'px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim'
        }"
      >
        <template #select-header>
          <UCheckbox
            :model-value="allSelected"
            aria-label="Tout sélectionner"
            @update:model-value="value => toggleAllSelection(Boolean(value))"
          />
        </template>

        <template #select-cell="{ row }">
          <div class="flex items-center gap-2">
            <UCheckbox
              :model-value="isSelected(row.original.id)"
              :aria-label="`Sélectionner ${row.original.ruleName || row.original.source}`"
              @update:model-value="value => toggleFlowSelection(row.original.id, Boolean(value))"
            />
            <span class="text-[10px] text-ink-dim">{{ row.index + 1 }}</span>
          </div>
        </template>

        <template #ruleName-cell="{ row }">
          <span class="text-ink-muted">{{ row.original.ruleName || '—' }}</span>
        </template>

        <template #source-cell="{ row }">
          <div>
            <span class="font-medium text-ink">{{ row.original.source }}</span>
            <p v-if="row.original.natSrc" class="text-[10px] text-ink-dim">→ {{ row.original.natSrc }}</p>
          </div>
        </template>

        <template #nomSource-cell="{ row }">
          <span class="text-ink-muted">{{ row.original.nomSource || '—' }}</span>
        </template>

        <template #destination-cell="{ row }">
          <div>
            <span class="font-medium text-ink">{{ row.original.destination }}</span>
            <p v-if="row.original.natDst" class="text-[10px] text-ink-dim">→ {{ row.original.natDst }}</p>
          </div>
        </template>

        <template #nomDestination-cell="{ row }">
          <span class="text-ink-muted">{{ row.original.nomDestination || '—' }}</span>
        </template>

        <template #application-cell="{ row }">
          <span class="text-ink-muted">{{ row.original.application || '—' }}</span>
        </template>

        <template #protocol-cell="{ row }">
          <span class="font-mono text-ink-muted">{{ row.original.protocol }}</span>
        </template>

        <template #action-cell="{ row }">
          <span
            class="font-semibold"
            :class="row.original.action === 'DENY' ? 'text-error-500' : 'text-success-500'"
          >
            {{ row.original.action }}
          </span>
        </template>

        <template #status-cell="{ row }">
          <div class="flex flex-wrap items-center gap-1">
            <UBadge
              :label="statusLabel(row.original.status)"
              :color="statusColor(row.original.status)"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="hasConflict(row.original)"
              label="CONFLIT"
              color="warning"
              variant="subtle"
              size="sm"
            />
          </div>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center gap-0.5">
            <UButton
              icon="i-lucide-arrow-up"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Monter"
              :disabled="indexInMatrix(row.original) <= 0"
              @click="moveFlow(row.original.id, 'up')"
            />
            <UButton
              icon="i-lucide-arrow-down"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Descendre"
              :disabled="indexInMatrix(row.original) >= flows.length - 1"
              @click="moveFlow(row.original.id, 'down')"
            />
            <UButton
              icon="i-lucide-check"
              color="success"
              variant="ghost"
              size="xs"
              aria-label="Approuver"
              @click="updateFlowStatus(row.original.id, 'APPROVED')"
            />
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="ghost"
              size="xs"
              aria-label="Refuser"
              @click="updateFlowStatus(row.original.id, 'REJECTED')"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Modifier"
              @click="editFlow(row.original)"
            />
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Dupliquer"
              @click="duplicateFlow(row.original.id)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              aria-label="Supprimer"
              @click="deleteFlow(row.original.id)"
            />
          </div>
        </template>

        <template #empty>
          <p class="py-10 text-center text-sm text-ink-dim">Aucun flux dans cette matrice.</p>
        </template>
      </UTable>
    </div>
  </UCard>
</template>
