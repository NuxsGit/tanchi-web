<script setup lang="ts">
import { CPU_PRESETS, MEDIA, findCatalogItem, type Connector } from '~~/shared/topology/catalog'
import { dataPortCount, effectivePorts, slotUsage } from '~~/shared/topology/model'

const topo = useTopology()
const { selectedNode, linksOfSelected, board, selectedNodeId, selectedLink } = topo

const nodeOf = (id: string) => board.value.nodes.find(node => node.id === id)

const spec = computed(() => (selectedNode.value ? findCatalogItem(selectedNode.value.type) : undefined))

/* ------------------------------------------------------------- Ports */

const CONNECTORS: Connector[] = [
  'rj45', 'sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28', 'qsfp-dd',
  'lc', 'sc', 'mpo', 'coax', 'wireless', 'power', 'serial'
]

const connectorItems = CONNECTORS.map(value => ({ label: value, value }))

const ports = computed(() => (selectedNode.value ? effectivePorts(selectedNode.value) : []))
const portTotal = computed(() => (selectedNode.value ? dataPortCount(selectedNode.value) : 0))

/** Le nœud suit-il encore la fiche catalogue ? */
const isCustomised = computed(() => Boolean(selectedNode.value?.config.ports?.length))

function commitPorts(next: { connector: Connector, count: number, speedGbps: number }[]) {
  if (!selectedNode.value) return
  topo.setPorts(selectedNode.value.id, next)
}

function updatePort(index: number, patch: Partial<{ connector: Connector, count: number, speedGbps: number }>) {
  const next = ports.value.map((port, i) => (i === index ? { ...port, ...patch } : { ...port }))
  commitPorts(next as never)
}

function addPortGroup() {
  commitPorts([...ports.value.map(port => ({ ...port })), { connector: 'rj45', count: 24, speedGbps: 1 }] as never)
}

function removePortGroup(index: number) {
  commitPorts(ports.value.filter((_, i) => i !== index).map(port => ({ ...port })) as never)
}

function resetPorts() {
  if (!selectedNode.value) return
  topo.updateConfig(selectedNode.value.id, { ports: undefined })
}

/* -------------------------------------------------------------- CPU */

const cpuItems = computed(() => [
  { label: '— aucun —', value: '__none__' },
  ...CPU_PRESETS.map(cpu => ({
    label: `${cpu.vendor} ${cpu.label} · ${cpu.cores}c/${cpu.threads}t`,
    value: cpu.id
  }))
])

const cpuModel = computed({
  get: () => {
    const label = selectedNode.value?.config.cpu
    return CPU_PRESETS.find(cpu => cpu.label === label)?.id ?? '__none__'
  },
  set: (value: string) => {
    if (!selectedNode.value) return
    const preset = CPU_PRESETS.find(cpu => cpu.id === value)
    topo.updateConfig(selectedNode.value.id, {
      cpu: value === '__none__' ? undefined : preset?.label,
      cores: preset?.cores
    })
  }
})

const mediumItems = MEDIA.map(medium => ({
  label: `${medium.label} · ${medium.maxSpeedGbps || '—'} Gb/s · ${medium.maxLengthM} m`,
  value: medium.id
}))

const nodeName = (id: string) => board.value.nodes.find(node => node.id === id)?.label ?? '—'

const isCompute = computed(() =>
  ['compute', 'virtualisation', 'storage'].includes(spec.value?.category ?? '')
)

/* --------------------------------------------------------- Services */

const newService = reactive({ name: '', port: '', protocol: 'tcp' as 'tcp' | 'udp' })

function addService() {
  if (!selectedNode.value || !newService.name.trim() || !newService.port) return

  const services = [...(selectedNode.value.config.services ?? [])]
  services.push({ name: newService.name.trim(), port: Number(newService.port), protocol: newService.protocol })

  topo.updateConfig(selectedNode.value.id, { services })
  newService.name = ''
  newService.port = ''
}

function removeService(index: number) {
  if (!selectedNode.value) return
  const services = [...(selectedNode.value.config.services ?? [])]
  services.splice(index, 1)
  topo.updateConfig(selectedNode.value.id, { services })
}
</script>

<template>
  <!-- Une liaison sélectionnée prend la main sur l'inspecteur -->
  <div v-if="selectedLink" class="flex h-full flex-col">
    <header class="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon name="i-lucide-cable" class="size-4 shrink-0 text-accent" />
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-ink">Liaison</p>
          <p class="truncate font-mono text-[10px] text-ink-dim">
            {{ nodeOf(selectedLink.from)?.label }} → {{ nodeOf(selectedLink.to)?.label }}
          </p>
        </div>
      </div>
      <div class="flex shrink-0 gap-0.5">
        <UButton
          icon="i-lucide-unlink" color="error" variant="ghost" size="xs"
          aria-label="Supprimer la liaison"
          @click="topo.removeLink(selectedLink.id); topo.selectLink(null)"
        />
        <UButton
          icon="i-lucide-x" color="neutral" variant="ghost" size="xs"
          aria-label="Fermer" @click="topo.selectLink(null)"
        />
      </div>
    </header>

    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <UFormField label="Support" size="xs">
        <USelect
          :model-value="selectedLink.medium"
          :items="mediumItems"
          size="sm"
          class="w-full"
          @update:model-value="value => topo.updateLink(selectedLink!.id, { medium: value as never })"
        />
      </UFormField>

      <div class="grid grid-cols-2 gap-2">
        <UFormField label="Débit (Gb/s)" size="xs">
          <UInput
            :model-value="selectedLink.speedGbps"
            type="number"
            size="sm"
            class="w-full"
            @update:model-value="value => topo.updateLink(selectedLink!.id, { speedGbps: Number(value) || 1 })"
          />
        </UFormField>
        <UFormField label="Longueur (m)" size="xs">
          <UInput
            :model-value="selectedLink.lengthM"
            type="number"
            size="sm"
            class="w-full"
            @update:model-value="value => topo.updateLink(selectedLink!.id, { lengthM: Number(value) || 0 })"
          />
        </UFormField>
      </div>

      <UFormField label="Libellé" hint="optionnel" size="xs">
        <UInput
          :model-value="selectedLink.label ?? ''"
          placeholder="LACP, lien de secours…"
          size="sm"
          class="w-full"
          @update:model-value="value => topo.updateLink(selectedLink!.id, { label: String(value) })"
        />
      </UFormField>

      <div class="rounded-md border border-line bg-raised p-2">
        <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">Extrémités</p>
        <p class="mt-1 font-mono text-[11px] text-ink-muted">
          {{ selectedLink.fromPort ?? 'port non précisé' }} → {{ selectedLink.toPort ?? 'port non précisé' }}
        </p>
      </div>
    </div>
  </div>

  <div v-else-if="selectedNode" class="flex h-full flex-col">
    <header class="flex shrink-0 items-start justify-between gap-2 border-b border-line px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon :name="spec?.icon ?? 'i-lucide-box'" class="size-4 shrink-0 text-accent" />
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-ink">{{ selectedNode.label }}</p>
          <p class="truncate font-mono text-[10px] uppercase tracking-wider text-ink-dim">
            {{ spec?.label }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 gap-0.5">
        <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" aria-label="Dupliquer" @click="topo.duplicateNode(selectedNode.id)" />
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" aria-label="Supprimer" @click="topo.removeNode(selectedNode.id)" />
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Fermer" @click="selectedNodeId = null" />
      </div>
    </header>

    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <UFormField label="Nom" size="xs">
        <UInput
          :model-value="selectedNode.label"
          size="sm"
          class="w-full"
          @update:model-value="value => topo.updateNode(selectedNode!.id, { label: String(value) })"
        />
      </UFormField>

      <div class="grid grid-cols-2 gap-2">
        <UFormField label="Modèle" size="xs">
          <UInput
            :model-value="selectedNode.config.model ?? ''"
            placeholder="C9300-48P"
            size="sm"
            class="w-full"
            @update:model-value="value => topo.updateConfig(selectedNode!.id, { model: String(value) })"
          />
        </UFormField>
        <UFormField label="Position baie" size="xs">
          <UInput
            :model-value="selectedNode.config.rackUnit ?? ''"
            placeholder="U12"
            size="sm"
            class="w-full"
            @update:model-value="value => topo.updateConfig(selectedNode!.id, { rackUnit: String(value) })"
          />
        </UFormField>
        <UFormField label="Adresse IP" size="xs">
          <UInput
            :model-value="selectedNode.config.ip ?? ''"
            placeholder="10.0.0.10"
            size="sm"
            class="w-full"
            @update:model-value="value => topo.updateConfig(selectedNode!.id, { ip: String(value) })"
          />
        </UFormField>
        <UFormField label="VLAN" size="xs">
          <UInput
            :model-value="selectedNode.config.vlan ?? ''"
            type="number"
            placeholder="10"
            size="sm"
            class="w-full"
            @update:model-value="value => topo.updateConfig(selectedNode!.id, { vlan: Number(value) || undefined })"
          />
        </UFormField>
      </div>

      <!-- Connectique paramétrable -->
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <p class="font-mono text-[10px] uppercase tracking-wider text-ink-dim">
            Ports · {{ portTotal }} au total
          </p>
          <div class="flex items-center gap-1">
            <UBadge
              v-if="isCustomised"
              label="personnalisé"
              size="sm"
              variant="subtle"
              color="primary"
            />
            <UButton
              v-if="isCustomised"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Revenir au catalogue"
              title="Revenir à la fiche catalogue"
              @click="resetPorts"
            />
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Ajouter un groupe de ports"
              @click="addPortGroup"
            />
          </div>
        </div>

        <div v-if="ports.length" class="space-y-1">
          <div
            v-for="(port, index) in ports"
            :key="index"
            class="grid grid-cols-[3.2rem_1fr_3.5rem_1.5rem] items-center gap-1"
          >
            <UInput
              :model-value="port.count"
              type="number"
              size="xs"
              :ui="{ base: 'text-[11px]' }"
              aria-label="Nombre de ports"
              @update:model-value="value => updatePort(index, { count: Math.max(0, Number(value) || 0) })"
            />
            <USelect
              :model-value="port.connector"
              :items="connectorItems"
              size="xs"
              @update:model-value="value => updatePort(index, { connector: value as Connector })"
            />
            <UInput
              :model-value="port.speedGbps"
              type="number"
              size="xs"
              :ui="{ base: 'text-[11px]' }"
              aria-label="Débit en Gb/s"
              @update:model-value="value => updatePort(index, { speedGbps: Number(value) || 0 })"
            />
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="ghost"
              size="xs"
              aria-label="Retirer ce groupe"
              @click="removePortGroup(index)"
            />
            <span
              class="col-span-4 -mt-0.5 font-mono text-[9px]"
              :class="slotUsage(board.links, selectedNode!.id, `${port.connector}#${index}`) > port.count
                ? 'text-error-500' : 'text-ink-dim'"
            >
              {{ slotUsage(board.links, selectedNode!.id, `${port.connector}#${index}`) }}/{{ port.count }} occupé(s)
            </span>
          </div>
          <p class="pt-0.5 font-mono text-[9px] text-ink-dim">nombre · connecteur · Gb/s</p>
        </div>

        <p v-else class="text-[11px] text-ink-dim">
          Aucun port. Ajoutez-en un pour pouvoir câbler cet équipement.
        </p>
      </div>

      <!-- Fiche machine -->
      <template v-if="isCompute">
        <USeparator label="Machine" :ui="{ label: 'text-[10px] uppercase tracking-wider' }" />

        <UFormField label="Processeur" size="xs">
          <USelect v-model="cpuModel" :items="cpuItems" size="sm" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-3 gap-2">
          <UFormField label="RAM Go" size="xs">
            <UInput
              :model-value="selectedNode.config.ramGb ?? ''"
              type="number"
              size="sm"
              class="w-full"
              @update:model-value="value => topo.updateConfig(selectedNode!.id, { ramGb: Number(value) || undefined })"
            />
          </UFormField>
          <UFormField label="Disque To" size="xs">
            <UInput
              :model-value="selectedNode.config.storageTb ?? ''"
              type="number"
              size="sm"
              class="w-full"
              @update:model-value="value => topo.updateConfig(selectedNode!.id, { storageTb: Number(value) || undefined })"
            />
          </UFormField>
          <UFormField label="Cœurs" size="xs">
            <UInput
              :model-value="selectedNode.config.cores ?? ''"
              type="number"
              size="sm"
              class="w-full"
              @update:model-value="value => topo.updateConfig(selectedNode!.id, { cores: Number(value) || undefined })"
            />
          </UFormField>
        </div>

        <UFormField label="Système" size="xs">
          <UInput
            :model-value="selectedNode.config.os ?? ''"
            placeholder="Debian 13, ESXi 8…"
            size="sm"
            class="w-full"
            @update:model-value="value => topo.updateConfig(selectedNode!.id, { os: String(value) })"
          />
        </UFormField>
      </template>

      <!-- Services exposés -->
      <USeparator label="Services" :ui="{ label: 'text-[10px] uppercase tracking-wider' }" />

      <div v-if="selectedNode.config.services?.length" class="space-y-1">
        <div
          v-for="(service, index) in selectedNode.config.services"
          :key="`${service.name}-${index}`"
          class="flex items-center gap-2 rounded border border-line bg-raised px-2 py-1"
        >
          <span class="min-w-0 flex-1 truncate text-[11px] text-ink">{{ service.name }}</span>
          <span class="shrink-0 font-mono text-[10px] text-ink-dim">
            {{ service.port }}/{{ service.protocol.toUpperCase() }}
          </span>
          <UButton icon="i-lucide-x" color="error" variant="ghost" size="xs" :aria-label="`Retirer ${service.name}`" @click="removeService(index)" />
        </div>
      </div>
      <p v-else class="text-[11px] text-ink-dim">Aucun service déclaré.</p>

      <div class="grid grid-cols-[1fr_3.5rem_3.5rem] gap-1">
        <UInput v-model="newService.name" placeholder="Service" size="xs" />
        <UInput v-model="newService.port" placeholder="443" size="xs" />
        <USelect
          v-model="newService.protocol"
          :items="[{ label: 'TCP', value: 'tcp' }, { label: 'UDP', value: 'udp' }]"
          size="xs"
        />
      </div>
      <UButton size="xs" color="neutral" variant="outline" block label="Ajouter" @click="addService" />

      <!-- Liaisons -->
      <USeparator label="Liaisons" :ui="{ label: 'text-[10px] uppercase tracking-wider' }" />

      <div v-if="linksOfSelected.length" class="space-y-2">
        <div
          v-for="link in linksOfSelected"
          :key="link.id"
          class="space-y-1 rounded-md border border-line bg-raised p-1.5"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0 truncate text-[11px] text-ink">
              → {{ nodeName(link.from === selectedNode.id ? link.to : link.from) }}
            </span>
            <UButton icon="i-lucide-unlink" color="error" variant="ghost" size="xs" aria-label="Supprimer la liaison" @click="topo.removeLink(link.id)" />
          </div>

          <USelect
            :model-value="link.medium"
            :items="mediumItems"
            size="xs"
            class="w-full"
            @update:model-value="value => topo.updateLink(link.id, { medium: value as never })"
          />

          <div class="grid grid-cols-2 gap-1">
            <UInput
              :model-value="link.speedGbps"
              type="number"
              size="xs"
              aria-label="Débit Gb/s"
              :ui="{ base: 'text-[11px]' }"
              @update:model-value="value => topo.updateLink(link.id, { speedGbps: Number(value) || 1 })"
            />
            <UInput
              :model-value="link.lengthM"
              type="number"
              size="xs"
              aria-label="Longueur en mètres"
              :ui="{ base: 'text-[11px]' }"
              @update:model-value="value => topo.updateLink(link.id, { lengthM: Number(value) || 0 })"
            />
          </div>
          <p class="font-mono text-[9px] text-ink-dim">Gb/s · mètres</p>
        </div>
      </div>
      <p v-else class="text-[11px] text-ink-dim">
        Aucune liaison. Utilisez la pastille en haut à droite du composant.
      </p>
    </div>
  </div>
</template>
