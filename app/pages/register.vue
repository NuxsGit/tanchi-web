<script setup lang="ts">
import type { FormSubmitEvent, FormError } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })

interface RegisterState {
  username: string
  email: string
  password: string
  confirmPassword: string
}

const { register } = useAuth()
const toast = useToast()

const loading = ref(false)
const showPassword = ref(false)
const state = reactive<RegisterState>({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const validate = (s: RegisterState): FormError[] => {
  const errors: FormError[] = []
  if (!s.username) errors.push({ name: 'username', message: 'Le nom d\'utilisateur est requis.' })
  else if (s.username.length < 3) errors.push({ name: 'username', message: '3 caractères minimum.' })
  if (!s.email) errors.push({ name: 'email', message: 'L\'email est requis.' })
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) errors.push({ name: 'email', message: 'Format d\'email invalide.' })
  if (!s.password) errors.push({ name: 'password', message: 'Le mot de passe est requis.' })
  else if (s.password.length < 8) errors.push({ name: 'password', message: '8 caractères minimum.' })
  if (!s.confirmPassword) errors.push({ name: 'confirmPassword', message: 'Veuillez confirmer le mot de passe.' })
  else if (s.confirmPassword !== s.password) errors.push({ name: 'confirmPassword', message: 'Les mots de passe ne correspondent pas.' })
  return errors
}

async function onSubmit(event: FormSubmitEvent<RegisterState>) {
  loading.value = true
  try {
    await register(event.data.username, event.data.email, event.data.password)
    toast.add({ title: 'Compte créé', description: 'Votre control center est prêt.', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Inscription impossible',
      description: apiError(error, 'Une erreur est survenue.'),
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
          <h1 class="text-xl font-semibold text-ink">Créer un compte</h1>
          <p class="mt-1 text-sm text-ink-muted">Quelques secondes suffisent pour démarrer.</p>
        </template>

        <UForm :state="state" :validate="validate" class="space-y-5" @submit="onSubmit">
          <UFormField label="Nom d'utilisateur" name="username" required>
            <UInput
              v-model="state.username"
              autocomplete="username"
              placeholder="sysadmin"
              icon="i-lucide-user"
              size="lg"
              class="w-full"
            />
          </UFormField>

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

          <UFormField label="Mot de passe" name="password" hint="8 caractères minimum" required>
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
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

          <UFormField label="Confirmation du mot de passe" name="confirmPassword" required>
            <UInput
              v-model="state.confirmPassword"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              icon="i-lucide-shield-check"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            color="primary"
            :loading="loading"
            label="Créer un compte"
          />
        </UForm>

        <template #footer>
          <p class="text-center text-sm text-ink-muted">
            Déjà un compte ?
            <NuxtLink to="/login" class="font-medium text-accent transition hover:text-accent">
              Se connecter
            </NuxtLink>
          </p>
        </template>
      </UCard>
    </div>
  </div>
</template>
