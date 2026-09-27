<template>
  <div class="flex min-h-screen bg-canvas text-ink">
    <AppSidebar />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader />

      <main class="flex-1 space-y-6 p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
