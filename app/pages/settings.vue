<script setup lang="ts">
import type { TableColumn, TabsItem, FormError, FormSubmitEvent } from '@nuxt/ui'
import type { PublicApiKey } from '~~/server/utils/keys'
import type { ColorModeName } from '~~/shared/themes'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { user, applyUser } = useAuth()
const { themeId, themes, family, families, mode, setFamily } = useTheme()
const toast = useToast()

// `slot` est la clé lue par UTabs pour résoudre les templates ci-dessous.
const tabs: TabsItem[] = [
  { value: 'profile', slot: 'profile', label: 'Profil', icon: 'i-lucide-user' },
  { value: 'security', slot: 'security', label: 'Sécurité', icon: 'i-lucide-shield' },
  { value: 'appearance', slot: 'appearance', label: 'Apparence', icon: 'i-lucide-palette' },
  { value: 'api', slot: 'api', label: 'Clés API', icon: 'i-lucide-key-round' }
]

const activeTab = ref('profile')

/* ------------------------------------------------------------------- Profil */

interface ProfileState {
  username: string
  email: string
}

const profileState = reactive<ProfileState>({
  username: user.value?.username ?? '',
  email: user.value?.email ?? ''
})

const avatar = ref<string>(user.value?.avatar ?? '')
const avatarInput = ref<HTMLInputElement>()
const profileLoading = ref(false)

watch(user, (value) => {
  if (!value) return
  profileState.username = value.username
  profileState.email = value.email
  avatar.value = value.avatar ?? ''
})

const validateProfile = (s: ProfileState): FormError[] => {
  const errors: FormError[] = []
  if (!s.username) errors.push({ name: 'username', message: 'Le nom d\'utilisateur est requis.' })
  else if (s.username.length < 3) errors.push({ name: 'username', message: '3 caractères minimum.' })
  if (!s.email) errors.push({ name: 'email', message: 'L\'email est requis.' })
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) errors.push({ name: 'email', message: 'Format d\'email invalide.' })
  return errors
}

function onAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    toast.add({ title: 'Fichier trop volumineux', description: '2 Mo maximum.', color: 'error' })
    return
  }

  // Encodé en data-URL : la base locale stocke l'avatar avec le compte.
  const reader = new FileReader()
  reader.onload = () => {
    avatar.value = String(reader.result)
    toast.add({ title: 'Avatar prêt', description: 'Enregistrez pour confirmer.', color: 'info' })
  }
  reader.readAsDataURL(file)
}

async function onProfileSubmit(event: FormSubmitEvent<ProfileState>) {
  profileLoading.value = true
  try {
    const { user: updated } = await $fetch('/api/account/profile', {
      method: 'PATCH',
      body: { ...event.data, avatar: avatar.value || null }
    })
    applyUser(updated)
    toast.add({ title: 'Profil enregistré', description: 'Vos informations ont été mises à jour.', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Enregistrement impossible', description: apiError(error, 'Une erreur est survenue.'), color: 'error' })
  } finally {
    profileLoading.value = false
  }
}

/* ----------------------------------------------------------------- Sécurité */

interface SecurityState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const securityState = reactive<SecurityState>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const securityLoading = ref(false)
const twoFactorEnabled = ref(user.value?.twoFactor ?? false)
const twoFactorPending = ref(false)

watch(user, value => { twoFactorEnabled.value = value?.twoFactor ?? false })

const validateSecurity = (s: SecurityState): FormError[] => {
  const errors: FormError[] = []
  if (!s.currentPassword) errors.push({ name: 'currentPassword', message: 'Mot de passe actuel requis.' })
  if (!s.newPassword) errors.push({ name: 'newPassword', message: 'Nouveau mot de passe requis.' })
  else if (s.newPassword.length < 8) errors.push({ name: 'newPassword', message: '8 caractères minimum.' })
  else if (s.newPassword === s.currentPassword) errors.push({ name: 'newPassword', message: 'Choisissez un mot de passe différent.' })
  if (!s.confirmPassword) errors.push({ name: 'confirmPassword', message: 'Veuillez confirmer.' })
  else if (s.confirmPassword !== s.newPassword) errors.push({ name: 'confirmPassword', message: 'Les mots de passe ne correspondent pas.' })
  return errors
}

async function onSecuritySubmit(event: FormSubmitEvent<SecurityState>) {
  securityLoading.value = true
  try {
    await $fetch('/api/account/password', {
      method: 'PATCH',
      body: {
        currentPassword: event.data.currentPassword,
        newPassword: event.data.newPassword
      }
    })
    securityState.currentPassword = ''
    securityState.newPassword = ''
    securityState.confirmPassword = ''
    toast.add({ title: 'Mot de passe mis à jour', description: 'Vos autres sessions ont été révoquées.', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Mise à jour refusée', description: apiError(error, 'Vérifiez votre mot de passe actuel.'), color: 'error' })
  } finally {
    securityLoading.value = false
  }
}

async function onTwoFactorToggle(enabled: boolean) {
  twoFactorPending.value = true
  try {
    const { user: updated } = await $fetch('/api/account/preferences', {
      method: 'PATCH',
      body: { twoFactor: enabled }
    })
    applyUser(updated)
    toast.add({
      title: enabled ? '2FA activée' : '2FA désactivée',
      description: enabled
        ? 'Un code TOTP sera demandé à chaque connexion.'
        : 'Votre compte est protégé par mot de passe uniquement.',
      color: enabled ? 'success' : 'warning'
    })
  } catch (error) {
    twoFactorEnabled.value = !enabled
    toast.add({ title: 'Action impossible', description: apiError(error, 'Une erreur est survenue.'), color: 'error' })
  } finally {
    twoFactorPending.value = false
  }
}

/* ---------------------------------------------------------------- Apparence */

const modeOptions = [
  { value: 'dark', label: 'Sombre', icon: 'i-lucide-moon' },
  { value: 'light', label: 'Clair', icon: 'i-lucide-sun' },
  { value: 'system', label: 'Système', icon: 'i-lucide-monitor' }
] as const

/** Persiste la palette résolue (famille × mode) sur le compte. */
async function persistAppearance() {
  await nextTick()
  try {
    const { user: updated } = await $fetch('/api/account/preferences', {
      method: 'PATCH',
      body: { theme: themeId.value, colorMode: mode.value }
    })
    applyUser(updated)
  } catch {
    // La préférence reste active localement via les cookies.
    toast.add({ title: 'Apparence appliquée localement', color: 'info' })
  }
}

async function onModeSelect(value: ColorModeName) {
  mode.value = value
  toast.add({ title: 'Mode appliqué', description: modeOptions.find(m => m.value === value)?.label, color: 'success' })
  await persistAppearance()
}

async function onFamilySelect(value: string) {
  setFamily(value)
  toast.add({ title: 'Palette appliquée', description: families.find(f => f.id === value)?.label, color: 'success' })
  await persistAppearance()
}

/* ----------------------------------------------------------------- Clés API */

const { keys, pending: keysPending, refresh, create, reveal, revoke } = useApiKeys()

// Non bloquant : la page s'affiche immédiatement, le tableau se remplit après.
// Avec `keepalive`, ce chargement n'a lieu qu'à la première visite.
onMounted(() => {
  if (!keys.value.length) refresh()
})

const apiColumns: TableColumn<PublicApiKey>[] = [
  { accessorKey: 'name', header: 'Nom de la clé' },
  { accessorKey: 'masked', header: 'Clé' },
  { accessorKey: 'createdAt', header: 'Création' },
  { accessorKey: 'lastUsed', header: 'Dernier accès' },
  { id: 'actions', header: '' }
]

const createModalOpen = ref(false)
const newKeyName = ref('')
const creatingKey = ref(false)
const revealedSecret = ref('')

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
const formatDate = (value: string | null) => (value ? dateFormat.format(new Date(`${value}Z`)) : 'jamais')

async function createApiKey() {
  if (!newKeyName.value.trim()) {
    toast.add({ title: 'Nom requis', description: 'Donnez un nom à votre clé API.', color: 'error' })
    return
  }

  creatingKey.value = true
  try {
    const { secret } = await create(newKeyName.value.trim())
    revealedSecret.value = secret
    newKeyName.value = ''
    toast.add({
      title: 'Clé générée',
      description: 'Copiez-la maintenant, elle ne sera plus affichée en clair.',
      color: 'success'
    })
  } catch (error) {
    toast.add({ title: 'Génération impossible', description: apiError(error, 'Une erreur est survenue.'), color: 'error' })
  } finally {
    creatingKey.value = false
  }
}

function closeCreateModal() {
  createModalOpen.value = false
  revealedSecret.value = ''
  newKeyName.value = ''
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Copié', description: label, color: 'success' })
  } catch {
    toast.add({ title: 'Copie impossible', description: 'Le presse-papiers est indisponible.', color: 'error' })
  }
}

async function copyKey(key: PublicApiKey) {
  try {
    await copyText(await reveal(key.id), key.name)
  } catch (error) {
    toast.add({ title: 'Copie impossible', description: apiError(error, 'Clé introuvable.'), color: 'error' })
  }
}

async function revokeKey(key: PublicApiKey) {
  try {
    await revoke(key.id)
    toast.add({ title: 'Clé révoquée', description: `${key.name} n'a plus accès à l'API.`, color: 'error' })
  } catch (error) {
    toast.add({ title: 'Révocation impossible', description: apiError(error, 'Une erreur est survenue.'), color: 'error' })
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-ink">Paramètres du système &amp; compte</h1>
      <p class="mt-1 text-sm text-ink-muted">
        Profil, sécurité, apparence et accès programmatique à votre control center.
      </p>
    </div>

    <!-- `unmount-on-hide` désactivé : les onglets restent montés, le passage
         de l'un à l'autre est instantané et l'état des formulaires survit. -->
    <UTabs
      v-model="activeTab"
      :items="tabs"
      variant="link"
      :unmount-on-hide="false"
      class="w-full"
    >
      <!-- ------------------------------------------------------- Profil -->
      <template #profile>
        <UCard class="mt-6 bg-surface ring-1 ring-line">
          <template #header>
            <h2 class="font-medium text-ink">Informations du profil</h2>
            <p class="mt-1 text-sm text-ink-dim">Visible par les autres membres de votre organisation.</p>
          </template>

          <div class="mb-6 flex items-center gap-5">
            <UAvatar :src="avatar || undefined" :alt="profileState.username" size="3xl" />
            <div class="space-y-2">
              <div class="flex gap-2">
                <UButton
                  icon="i-lucide-upload"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  label="Téléverser un avatar"
                  @click="avatarInput?.click()"
                />
                <UButton
                  v-if="avatar"
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="Retirer"
                  @click="avatar = ''"
                />
              </div>
              <p class="text-xs text-ink-dim">PNG, JPG ou WebP — 2 Mo maximum.</p>
              <input
                ref="avatarInput"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                @change="onAvatarChange"
              >
            </div>
          </div>

          <UForm
            :state="profileState"
            :validate="validateProfile"
            class="space-y-5"
            @submit="onProfileSubmit"
          >
            <UFormField label="Pseudo / Nom d'utilisateur" name="username" required>
              <UInput v-model="profileState.username" icon="i-lucide-user" size="lg" class="w-full" />
            </UFormField>

            <UFormField label="Adresse email" name="email" required>
              <UInput v-model="profileState.email" type="email" icon="i-lucide-mail" size="lg" class="w-full" />
            </UFormField>

            <div class="flex justify-end">
              <UButton
                type="submit"
                color="primary"
                size="lg"
                :loading="profileLoading"
                label="Enregistrer les modifications"
              />
            </div>
          </UForm>
        </UCard>
      </template>

      <!-- ----------------------------------------------------- Sécurité -->
      <template #security>
        <div class="mt-6 space-y-6">
          <UCard class="bg-surface ring-1 ring-line">
            <template #header>
              <h2 class="font-medium text-ink">Changer le mot de passe</h2>
              <p class="mt-1 text-sm text-ink-dim">Toutes vos autres sessions seront déconnectées.</p>
            </template>

            <UForm
              :state="securityState"
              :validate="validateSecurity"
              class="space-y-5"
              @submit="onSecuritySubmit"
            >
              <UFormField label="Mot de passe actuel" name="currentPassword" required>
                <UInput
                  v-model="securityState.currentPassword"
                  type="password"
                  autocomplete="current-password"
                  icon="i-lucide-lock"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Nouveau mot de passe" name="newPassword" hint="8 caractères minimum" required>
                <UInput
                  v-model="securityState.newPassword"
                  type="password"
                  autocomplete="new-password"
                  icon="i-lucide-key"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Confirmation" name="confirmPassword" required>
                <UInput
                  v-model="securityState.confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  icon="i-lucide-shield-check"
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <div class="flex justify-end">
                <UButton
                  type="submit"
                  color="primary"
                  size="lg"
                  :loading="securityLoading"
                  label="Mettre à jour le mot de passe"
                />
              </div>
            </UForm>
          </UCard>

          <UCard class="bg-surface ring-1 ring-line">
            <div class="flex items-start justify-between gap-6">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="font-medium text-ink">Authentification à double facteur</h2>
                  <UBadge
                    :label="twoFactorEnabled ? 'Activée' : 'Désactivée'"
                    :color="twoFactorEnabled ? 'success' : 'neutral'"
                    variant="subtle"
                    size="sm"
                  />
                </div>
                <p class="mt-2 max-w-lg text-sm text-ink-muted">
                  Exigez un code TOTP à usage unique en plus de votre mot de passe.
                  Fortement recommandé pour les comptes disposant d'un accès shell.
                </p>
              </div>
              <USwitch
                v-model="twoFactorEnabled"
                size="lg"
                :disabled="twoFactorPending"
                aria-label="Activer la 2FA"
                @update:model-value="onTwoFactorToggle"
              />
            </div>
          </UCard>
        </div>
      </template>

      <!-- ---------------------------------------------------- Apparence -->
      <template #appearance>
        <div class="mt-6 space-y-6">
          <UCard class="bg-surface ring-1 ring-line">
            <template #header>
              <h2 class="font-medium text-ink">Mode d'affichage</h2>
              <p class="mt-1 text-sm text-ink-dim">
                « Système » suit le réglage clair/sombre de votre navigateur.
              </p>
            </template>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                v-for="option in modeOptions"
                :key="option.value"
                type="button"
                class="flex items-center gap-3 rounded-lg border p-4 text-left transition"
                :class="mode === option.value
                  ? 'border-accent bg-accent-soft ring-1 ring-accent/30'
                  : 'border-line hover:border-line-strong hover:bg-raised'"
                @click="onModeSelect(option.value)"
              >
                <UIcon :name="option.icon" class="size-5 shrink-0 text-ink-muted" />
                <span class="flex-1 text-sm font-medium text-ink">{{ option.label }}</span>
                <UIcon
                  v-if="mode === option.value"
                  name="i-lucide-circle-check"
                  class="size-4 text-accent"
                />
              </button>
            </div>
          </UCard>

          <UCard class="bg-surface ring-1 ring-line">
            <template #header>
              <h2 class="font-medium text-ink">Palette</h2>
              <p class="mt-1 text-sm text-ink-dim">
                Chaque palette existe en version sombre et claire ; le mode ci-dessus
                décide laquelle s'applique.
              </p>
            </template>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                v-for="option in families"
                :key="option.id"
                type="button"
                class="rounded-lg border p-4 text-left transition"
                :class="family === option.id
                  ? 'border-accent bg-accent-soft ring-1 ring-accent/30'
                  : 'border-line hover:border-line-strong hover:bg-raised'"
                @click="onFamilySelect(option.id)"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span
                      v-for="variant in themes.filter(t => t.family === option.id)"
                      :key="variant.id"
                      class="flex items-center gap-0.5"
                    >
                      <span
                        v-for="(swatch, i) in variant.preview"
                        :key="i"
                        class="size-4 rounded-full border border-line-strong"
                        :style="{ backgroundColor: swatch }"
                      />
                    </span>
                  </div>
                  <UIcon
                    v-if="family === option.id"
                    name="i-lucide-circle-check"
                    class="size-4 text-accent"
                  />
                </div>

                <p class="mt-3 text-sm font-medium text-ink">{{ option.label }}</p>
                <p class="mt-1 text-xs text-ink-dim">{{ option.description }}</p>
              </button>
            </div>

            <p class="mt-4 text-xs text-ink-dim">
              Palette active : <span class="font-mono text-ink-muted">{{ themeId }}</span>
            </p>
          </UCard>
        </div>
      </template>

      <!-- ----------------------------------------------------- Clés API -->
      <template #api>
        <UCard class="mt-6 bg-surface ring-1 ring-line" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="font-medium text-ink">Clés API</h2>
                <p class="mt-1 text-sm text-ink-dim">
                  Gérez les clés d'accès pour l'API REST et le CLI Tanchi Web.
                </p>
              </div>
              <UButton
                icon="i-lucide-plus"
                color="primary"
                label="Générer une nouvelle clé API"
                @click="createModalOpen = true"
              />
            </div>
          </template>

          <UTable :data="keys" :columns="apiColumns" :loading="keysPending" class="w-full">
            <template #name-cell="{ row }">
              <span class="font-medium text-ink">{{ row.original.name }}</span>
            </template>

            <template #masked-cell="{ row }">
              <span class="font-mono text-xs text-ink-muted">{{ row.original.masked }}</span>
            </template>

            <template #createdAt-cell="{ row }">
              <span class="text-sm text-ink-muted">{{ formatDate(row.original.createdAt) }}</span>
            </template>

            <template #lastUsed-cell="{ row }">
              <span class="text-sm text-ink-muted">{{ formatDate(row.original.lastUsed) }}</span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Copier la clé"
                  @click="copyKey(row.original)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  aria-label="Révoquer la clé"
                  @click="revokeKey(row.original)"
                />
              </div>
            </template>

            <template #empty>
              <p class="py-8 text-center text-sm text-ink-dim">Aucune clé active.</p>
            </template>
          </UTable>
        </UCard>

        <!-- Modale de création -->
        <UModal
          v-model:open="createModalOpen"
          title="Générer une nouvelle clé API"
          @update:open="value => !value && closeCreateModal()"
        >
          <template #body>
            <div v-if="revealedSecret" class="space-y-4">
              <p class="text-sm text-ink-muted">
                Voici votre clé. Elle ne sera plus jamais affichée en clair.
              </p>
              <div class="flex items-center gap-2 rounded-md border border-line bg-raised p-3">
                <code class="min-w-0 flex-1 truncate font-mono text-sm text-ink">{{ revealedSecret }}</code>
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Copier"
                  @click="copyText(revealedSecret, 'Clé API')"
                />
              </div>
            </div>

            <div v-else class="space-y-4">
              <p class="text-sm text-ink-muted">
                La clé complète ne sera affichée qu'une seule fois, au moment de sa création.
              </p>

              <UFormField label="Nom de la clé" name="keyName" hint="Ex. : déploiement staging" required>
                <UInput
                  v-model="newKeyName"
                  placeholder="CI/CD GitHub Actions"
                  icon="i-lucide-tag"
                  size="lg"
                  class="w-full"
                  autofocus
                  @keydown.enter="createApiKey"
                />
              </UFormField>
            </div>
          </template>

          <template #footer>
            <div class="flex w-full justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                :label="revealedSecret ? 'Fermer' : 'Annuler'"
                @click="closeCreateModal"
              />
              <UButton
                v-if="!revealedSecret"
                color="primary"
                icon="i-lucide-key-round"
                :loading="creatingKey"
                label="Générer la clé"
                @click="createApiKey"
              />
            </div>
          </template>
        </UModal>
      </template>
    </UTabs>
  </div>
</template>
