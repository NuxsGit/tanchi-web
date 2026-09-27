<script setup lang="ts">
const { themeId, scheme, applyThemeId } = useTheme()
const { user } = useAuth()

// La palette enregistrée sur le compte est appliquée ici, en contexte de
// composant : `useTheme()` dépend de `useColorMode()`, indisponible dans un
// middleware de route.
watch(() => user.value?.theme, (id) => {
  if (id) applyThemeId(id)
}, { immediate: true })

// Attributs de `<html>` : palette (`data-theme`) et schéma clair/sombre.
// Même valeur que celle écrite par le module color-mode, donc pas de saut
// à l'hydratation.
useHead({
  htmlAttrs: {
    'data-theme': () => themeId.value,
    'class': () => scheme.value,
    'style': () => `color-scheme: ${scheme.value}`
  }
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <!-- `keepalive` conserve les pages déjà visitées en mémoire : le retour
           au dashboard est instantané et l'état local (recherche, filtres,
           onglets, formulaires) est préservé. -->
      <NuxtPage :keepalive="{ max: 6 }" />
    </NuxtLayout>
  </UApp>
</template>
