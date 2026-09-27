<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const { toolboxTab, selectedFlowIds, saveStatusLabel, flowsHistory, undo, save } = useFmd()

const objectsOpen = ref(false)

const tabs = computed<TabsItem[]>(() => [
  { value: 'composer', slot: 'composer', label: 'Flux', icon: 'i-lucide-plus' },
  { value: 'sections', slot: 'sections', label: 'Sections', icon: 'i-lucide-layers' },
  {
    value: 'bulk',
    slot: 'bulk',
    label: 'Sélect',
    icon: 'i-lucide-list-checks',
    badge: selectedFlowIds.value.length || undefined
  },
  { value: 'export', slot: 'export', label: 'Export', icon: 'i-lucide-arrow-down-up' },
  { value: 'config', slot: 'config', label: 'Config', icon: 'i-lucide-braces' }
])
</script>

<template>
  <UCard
    class="flex h-full min-h-0 flex-col bg-surface ring-1 ring-line"
    :ui="{ header: 'p-2 sm:p-2', body: 'min-h-0 flex-1 overflow-y-auto p-4 sm:p-4', footer: 'p-2 sm:p-2' }"
  >
    <template #header>
      <UTabs
        v-model="toolboxTab"
        :items="tabs"
        :content="false"
        variant="pill"
        size="xs"
        class="w-full"
        :ui="{ list: 'w-full', trigger: 'flex-1 px-1' }"
      />
    </template>

    <FmdComposer v-show="toolboxTab === 'composer'" @open-objects="objectsOpen = true" />
    <FmdSections v-show="toolboxTab === 'sections'" />
    <FmdBulk v-show="toolboxTab === 'bulk'" />
    <FmdExportPanel v-show="toolboxTab === 'export'" />
    <FmdConfigPanel v-show="toolboxTab === 'config'" class="h-full" />

    <template #footer>
      <div class="flex items-center justify-between gap-2 px-1">
        <span class="truncate text-xs text-ink-dim">{{ saveStatusLabel }}</span>
        <div class="flex shrink-0 gap-1">
          <UButton
            icon="i-lucide-undo-2"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="!flowsHistory.length"
            :label="flowsHistory.length ? String(flowsHistory.length) : undefined"
            aria-label="Annuler la dernière action"
            title="Annuler (Ctrl+Z)"
            @click="undo()"
          />
          <UButton
            icon="i-lucide-save"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Sauvegarder maintenant"
            title="Sauvegarder (Ctrl+S)"
            @click="save(false)"
          />
        </div>
      </div>
    </template>

    <FmdObjectsModal v-model:open="objectsOpen" />
  </UCard>
</template>
