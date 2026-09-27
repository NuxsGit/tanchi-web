<script setup lang="ts">
import type { WidgetInstance } from '~~/shared/dashboard'

const props = defineProps<{ widget: WidgetInstance }>()
const { data } = useDashboard()

const members = computed(() => {
  const all = (data.value?.members ?? []) as Record<string, string | number | null>[]
  const teamId = props.widget.options?.teamId ?? data.value?.teams[0]?.id
  return all.filter(member => member.teamId === teamId)
})

const roleLabel: Record<string, string> = {
  owner: 'Propriétaire', admin: 'Admin', member: 'Membre'
}
</script>

<template>
  <div v-if="members.length" class="space-y-1.5">
    <div
      v-for="member in members"
      :key="String(member.userId)"
      class="flex items-center gap-2.5 rounded-md border border-line bg-canvas px-2.5 py-1.5"
    >
      <UAvatar :src="(member.avatar as string) || undefined" :alt="String(member.username)" size="2xs" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-xs text-ink">{{ member.username }}</p>
        <p class="font-mono text-[10px] text-ink-dim">{{ roleLabel[String(member.role)] }}</p>
      </div>
      <span
        class="shrink-0 rounded bg-raised px-1.5 font-mono text-[10px]"
        :class="Number(member.openTasks) > 0 ? 'text-accent' : 'text-ink-dim'"
        :title="`${member.openTasks} tâche(s) ouverte(s)`"
      >{{ member.openTasks }}</span>
    </div>
  </div>

  <p v-else class="py-6 text-center text-xs text-ink-dim">Aucune équipe sélectionnée.</p>
</template>
