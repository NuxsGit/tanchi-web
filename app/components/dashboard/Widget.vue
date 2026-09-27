<script setup lang="ts">
import type { WidgetInstance } from '~~/shared/dashboard'

defineProps<{ widget: WidgetInstance }>()
</script>

<template>
  <DashboardWidgetTasksMine v-if="widget.type === 'tasks-mine'" />
  <DashboardWidgetTasksBoard v-else-if="widget.type === 'tasks-board'" :widget="widget" />
  <DashboardWidgetTeamProjects v-else-if="widget.type === 'team-projects'" :widget="widget" />
  <DashboardWidgetTeamMembers v-else-if="widget.type === 'team-members'" :widget="widget" />
  <DashboardWidgetFmd v-else-if="widget.type === 'fmd-summary'" />
  <DashboardWidgetShortcuts v-else-if="widget.type === 'shortcuts'" />
  <DashboardWidgetNote v-else-if="widget.type === 'note'" :widget="widget" />
</template>
