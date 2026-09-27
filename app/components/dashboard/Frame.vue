<script setup lang="ts">
import { specOf, type WidgetInstance } from '~~/shared/dashboard'

const props = defineProps<{
  widget: WidgetInstance
  editing: boolean
  cell: { width: number, height: number, gap: number }
}>()

const emit = defineEmits<{
  moveStart: [PointerEvent]
  resizeStart: [PointerEvent]
  remove: []
  configure: []
}>()

const spec = computed(() => specOf(props.widget.type))

/** Position absolue en pixels, dérivée de la géométrie de la grille. */
const style = computed(() => {
  const { width, height, gap } = props.cell
  return {
    left: `${props.widget.x * (width + gap)}px`,
    top: `${props.widget.y * (height + gap)}px`,
    width: `${props.widget.w * width + (props.widget.w - 1) * gap}px`,
    height: `${props.widget.h * height + (props.widget.h - 1) * gap}px`
  }
})
</script>

<template>
  <div
    class="absolute flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-[left,top,width,height] duration-150"
    :style="style"
  >
    <header
      class="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2"
      :class="editing ? 'cursor-grab active:cursor-grabbing select-none' : ''"
      @pointerdown="editing && emit('moveStart', $event)"
    >
      <UIcon :name="spec?.icon ?? 'i-lucide-square'" class="size-3.5 shrink-0 text-accent" />
      <h3 class="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-wider text-ink-muted">
        {{ widget.options?.title || spec?.label }}
      </h3>

      <template v-if="editing">
        <UButton
          v-if="spec?.scope"
          icon="i-lucide-settings-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Configurer le widget"
          @pointerdown.stop
          @click="emit('configure')"
        />
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="ghost"
          size="xs"
          aria-label="Retirer le widget"
          @pointerdown.stop
          @click="emit('remove')"
        />
      </template>
    </header>

    <div class="min-h-0 flex-1 overflow-auto p-3">
      <slot />
    </div>

    <!-- Poignée de redimensionnement -->
    <button
      v-if="editing"
      type="button"
      class="absolute bottom-0 right-0 flex size-5 cursor-nwse-resize items-center justify-center text-ink-dim hover:text-accent"
      aria-label="Redimensionner"
      @pointerdown.stop="emit('resizeStart', $event)"
    >
      <svg viewBox="0 0 10 10" class="size-2.5 fill-current">
        <path d="M9 1v8H1z" opacity=".45" />
      </svg>
    </button>
  </div>
</template>
