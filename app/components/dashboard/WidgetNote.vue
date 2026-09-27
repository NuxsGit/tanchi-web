<script setup lang="ts">
import type { WidgetInstance } from '~~/shared/dashboard'

const props = defineProps<{ widget: WidgetInstance }>()
const { updateOptions } = useDashboard()

const text = ref(props.widget.options?.text ?? '')

// La note est enregistrée avec la grille : on temporise pour ne pas écrire
// à chaque frappe.
let timer: ReturnType<typeof setTimeout> | undefined
watch(text, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => updateOptions(props.widget.id, { text: value }), 700)
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <textarea
    v-model="text"
    class="size-full resize-none rounded-md border border-line bg-canvas p-2.5 text-xs text-ink outline-none transition placeholder:text-ink-dim focus:border-accent/60"
    placeholder="Notes, rappels, commandes à retenir…"
  />
</template>
