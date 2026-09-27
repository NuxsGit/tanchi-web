<script setup lang="ts">
const { matrices, activeMatrixId, selectMatrix, addMatrix, deleteMatrix, renameMatrix } = useFmd()

const renaming = ref<string | null>(null)
const draftName = ref('')

function startRename(id: string, name: string) {
  renaming.value = id
  draftName.value = name
}

function commitRename() {
  if (renaming.value) renameMatrix(renaming.value, draftName.value)
  renaming.value = null
}

const confirmDelete = ref<string | null>(null)
const matrixToDelete = computed(() => matrices.value.find(m => m.id === confirmDelete.value))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div
      v-for="matrix in matrices"
      :key="matrix.id"
      class="flex items-center gap-1 rounded-md border px-1 transition"
      :class="matrix.id === activeMatrixId
        ? 'border-accent bg-accent-soft'
        : 'border-line bg-surface hover:border-line-strong'"
    >
      <UInput
        v-if="renaming === matrix.id"
        v-model="draftName"
        size="xs"
        autofocus
        class="w-32"
        @blur="commitRename"
        @keydown.enter="commitRename"
        @keydown.esc="renaming = null"
      />
      <button
        v-else
        type="button"
        class="px-2 py-1.5 text-sm"
        :class="matrix.id === activeMatrixId ? 'text-accent' : 'text-ink-muted hover:text-ink'"
        @click="selectMatrix(matrix.id)"
        @dblclick="startRename(matrix.id, matrix.name)"
      >
        {{ matrix.name }}
        <span class="ml-1 text-xs text-ink-dim">{{ matrix.flows.length }}</span>
      </button>

      <UButton
        v-if="matrices.length > 1 && renaming !== matrix.id"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Supprimer ${matrix.name}`"
        @click="confirmDelete = matrix.id"
      />
    </div>

    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      size="sm"
      label="Matrice"
      @click="addMatrix()"
    />

    <UModal
      :open="Boolean(confirmDelete)"
      :title="`Supprimer « ${matrixToDelete?.name} » ?`"
      @update:open="value => !value && (confirmDelete = null)"
    >
      <template #body>
        <p class="text-sm text-ink-muted">
          Les {{ matrixToDelete?.flows.length ?? 0 }} flux de cette matrice seront perdus.
          Cette action est irréversible.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Annuler" @click="confirmDelete = null" />
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            label="Supprimer"
            @click="deleteMatrix(confirmDelete!); confirmDelete = null"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
