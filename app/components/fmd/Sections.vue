<script setup lang="ts">
import { normalize } from '~~/shared/fmd'

const { sections, flows, addSection, deleteSection } = useFmd()

const newName = ref('')

function create() {
  if (!normalize(newName.value)) return
  addSection(newName.value)
  newName.value = ''
}

const countFor = (sectionId: string) =>
  flows.value.filter(flow => flow.sectionId === sectionId).length
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-medium text-ink">Sections</h3>

    <div class="flex gap-1">
      <UInput
        v-model="newName"
        placeholder="Nom de la section"
        size="sm"
        class="min-w-0 flex-1"
        @keydown.enter="create"
      />
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        aria-label="Ajouter la section"
        @click="create"
      />
    </div>

    <div v-if="sections.length" class="space-y-1">
      <div
        v-for="section in sections"
        :key="section.id"
        class="flex items-center gap-2 rounded-md border border-line bg-raised px-2 py-1.5"
      >
        <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: section.color }" />
        <span class="min-w-0 flex-1 truncate text-sm text-ink">{{ section.name }}</span>
        <UBadge :label="String(countFor(section.id))" size="sm" variant="subtle" color="neutral" />
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="ghost"
          size="xs"
          :aria-label="`Supprimer ${section.name}`"
          @click="deleteSection(section.id)"
        />
      </div>
    </div>

    <p v-else class="text-sm text-ink-dim">Aucune section définie.</p>
  </div>
</template>
