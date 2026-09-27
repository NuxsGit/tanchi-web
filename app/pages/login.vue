<script setup lang="ts">
import type { FormSubmitEvent, FormError } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })

interface LoginState {
  email: string
  password: string
}

const { login } = useAuth()
const toast = useToast()

const loading = ref(false)
const showPassword = ref(false)
const state = reactive<LoginState>({
  email: '',
  password: ''
})

const validate = (s: LoginState): FormError[] => {
  const errors: FormError[] = []
  if (!s.email) errors.push({ name: 'email', message: 'L\'email est requis.' })
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) errors.push({ name: 'email', message: 'Format d\'email invalide.' })
  if (!s.password) errors.push({ name: 'password', message: 'Le mot de passe est requis.' })
  else if (s.password.length < 8) errors.push({ name: 'password', message: '8 caractères minimum.' })
  return errors
}

async function onSubmit(event: FormSubmitEvent<LoginState>) {
  loading.value = true
  try {
    await login(event.data.email, event.data.password)
    toast.add({ title: 'Connexion réussie', description: 'Bienvenue sur votre control center.', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Connexion refusée',
      description: apiError(error, 'Email ou mot de passe incorrect.'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <NuxtLink to="/" class="mb-8 flex items-center justify-center gap-2">
        <span class="flex size-9 items-center justify-center rounded-md bg-accent-soft ring-1 ring-accent/40">
          <UIcon name="i-lucide-server-cog" class="size-5 text-accent" />
        </span>
        <span class="text-lg font-semibold tracking-tight">Tanchi Web</span>
      </NuxtLink>

      <UCard class="bg-surface ring-1 ring-line">
        <template #header>
          <h1 class="text-xl font-semibold text-ink">Connexion</h1>
          <p class="mt-1 text-sm text-ink-muted">Accédez à votre control center.</p>
        </template>

        <UForm :state="state" :validate="validate" class="space-y-5" @submit="onSubmit">
          <UFormField label="Email" name="email" required>
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="email"
              placeholder="admin@tanchi.io"
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Mot de passe" name="password" required>
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              icon="i-lucide-lock"
              size="lg"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            color="primary"
            :loading="loading"
            label="Se connecter"
          />
        </UForm>

        <template #footer>
          <p class="text-center text-sm text-ink-muted">
            Pas encore de compte ?
            <NuxtLink to="/register" class="font-medium text-accent transition hover:text-accent">
              S'inscrire
            </NuxtLink>
          </p>
        </template>
      </UCard>
    </div>
  </div>
</template>
